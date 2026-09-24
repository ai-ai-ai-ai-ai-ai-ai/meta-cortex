use super::{
    Failure, FeatureOperation, LedgerInfo, Operation, Outcome, Reply, Request, RequestYaml,
    Response, State, Task, TaskOperation, TaskView,
};
use anyhow::{Context, bail};
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::{Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CoordinatorAction, CoordinatorUpdate, CreateTask, FeatureQuery, InitFeature,
    TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    Attempt, BranchName, CommitId, Extensions, FeatureId, LeaseSeconds, Note, Revision, TaskId,
};
use meta_cortex_workbench::versions::{ProtocolVersion, StorageVersion};
use std::fs;
use std::io::Write;
use std::os::unix::fs::symlink;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::rc::Rc;
use tempfile::TempDir;

// Setup capabilities describe completed fixture effects, not the mutable database lifecycle.
pub(super) struct Scenario<Setup> {
    directory: TempDir,
    data: Rc<TempDir>,
    state: Setup,
}
pub(super) struct RepositoryReady;
pub(super) struct FeatureReady {
    feature: FeatureId,
    ledger: LedgerInfo,
}
pub(super) struct TaskCreated {
    feature: FeatureReady,
    task: Task,
}

impl<Setup> Scenario<Setup> {
    pub(super) fn seed_tools(&self) -> anyhow::Result<()> {
        for name in ["mise", "bun", "vale"] {
            let output = Command::new("sh")
                .args(["-c", "command -v \"$1\"", "sh", name])
                .output()?;
            assert!(output.status.success(), "missing test tool: {name}");
            let directory = self.data.path().join(name).join("bin");
            fs::create_dir_all(&directory)?;
            symlink(
                String::from_utf8(output.stdout)?.trim(),
                directory.join(name),
            )?;
        }
        Ok(())
    }
}

impl Scenario<RepositoryReady> {
    pub(super) fn create() -> anyhow::Result<Self> {
        let scenario = Self {
            directory: tempfile::tempdir()?,
            data: Rc::new(tempfile::tempdir()?),
            state: RepositoryReady,
        };
        let mut options = git2::RepositoryInitOptions::new();
        options.initial_head("codex/feature");
        let repository = git2::Repository::init_opts(scenario.directory.path(), &options)?;
        let signature = git2::Signature::now("Ledger Test", "ledger@example.invalid")?;
        let tree_id = repository.index()?.write_tree()?;
        let tree = repository.find_tree(tree_id)?;
        repository.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])?;
        Ok(scenario)
    }

    pub(super) fn initialization(&self, feature: FeatureId) -> anyhow::Result<InitFeature> {
        Ok(InitFeature {
            feature,
            objective: Note::from("Example feature".to_owned()),
            branch: BranchName::try_from("codex/feature".to_owned())?,
            worktree: self.directory.path().to_owned(),
        })
    }

    pub(super) fn initialize(self, feature: FeatureId) -> anyhow::Result<Scenario<FeatureReady>> {
        let input = self.initialization(feature)?;
        self.initialize_with(input)
    }

    pub(super) fn initialize_with(
        self,
        input: InitFeature,
    ) -> anyhow::Result<Scenario<FeatureReady>> {
        let feature = input.feature.clone();
        let reply = self
            .client()
            .run(Operation::Feature(FeatureOperation::Initialize(input)))?;
        let Reply::Ledger(ledger) = reply else {
            bail!("unexpected initialization reply: {reply:?}");
        };
        Ok(Scenario {
            directory: self.directory,
            data: self.data,
            state: FeatureReady { feature, ledger },
        })
    }

    pub(super) fn observe(self, feature: FeatureId) -> anyhow::Result<Scenario<FeatureReady>> {
        let reply = self
            .client()
            .run(Operation::Feature(FeatureOperation::Status(FeatureQuery {
                feature: feature.clone(),
            })))?;
        let Reply::Status { ledger, .. } = reply else {
            bail!("unexpected status reply: {reply:?}");
        };
        Ok(Scenario {
            directory: self.directory,
            data: self.data,
            state: FeatureReady { feature, ledger },
        })
    }
}

impl Scenario<FeatureReady> {
    pub(super) fn ledger(&self) -> &LedgerInfo {
        &self.state.ledger
    }
    pub(super) fn status(&self) -> anyhow::Result<Vec<TaskView>> {
        self.client().status(self.state.feature.clone())
    }
    pub(super) fn create_task(self, input: CreateTask) -> anyhow::Result<Scenario<TaskCreated>> {
        if input.feature != self.state.feature {
            bail!("task belongs to another feature");
        }
        let id = input.task.clone();
        let reply = self
            .client()
            .run(Operation::Task(TaskOperation::Create(input)))?;
        let Reply::Task(task) = reply else {
            bail!("unexpected task creation reply: {reply:?}");
        };
        if task.id != id || !matches!(task.state, State::Queued) {
            bail!("unexpected created task: {task:?}");
        }
        Ok(Scenario {
            directory: self.directory,
            data: self.data,
            state: TaskCreated {
                feature: self.state,
                task,
            },
        })
    }
}

impl Scenario<TaskCreated> {
    pub(super) fn created_task(&self) -> &Task {
        &self.state.task
    }
    pub(super) fn status(&self) -> anyhow::Result<Vec<TaskView>> {
        self.client().status(self.state.feature.feature.clone())
    }
}

impl<Setup> Scenario<Setup> {
    pub(super) fn linked(&self, directory: TempDir) -> anyhow::Result<Scenario<RepositoryReady>> {
        git2::Repository::open(directory.path())?;
        Ok(Scenario {
            directory,
            data: self.data.clone(),
            state: RepositoryReady,
        })
    }
    pub(super) fn data_directory(&self) -> &Path {
        self.data.path()
    }

    pub(super) fn path(&self) -> &Path {
        self.directory.path()
    }
    pub(super) fn client(&self) -> Cli<'_> {
        Cli {
            project: self.path(),
            data: self.data.path(),
        }
    }
    pub(super) fn repository(&self) -> anyhow::Result<git2::Repository> {
        Ok(git2::Repository::open(self.directory.path())?)
    }
    pub(super) fn head(&self) -> anyhow::Result<CommitId> {
        let oid = self.repository()?.head()?.peel_to_commit()?.id();
        Ok(CommitId::try_from(oid.to_string())?)
    }
}

// Raw protocol transport remains available for negative and concurrent requests.
pub(super) struct Cli<'a> {
    project: &'a Path,
    data: &'a Path,
}
impl Cli<'_> {
    pub(super) fn request(&self, operation: Operation) -> Request {
        Request {
            version: ProtocolVersion::CURRENT,
            project: self.project.to_owned(),
            operation,
        }
    }
    pub(super) fn start(&self, operation: Operation) -> anyhow::Result<Child> {
        self.start_yaml(RequestYaml::from(serde_saphyr::to_string(
            &self.request(operation),
        )?))
    }
    pub(super) fn start_yaml(&self, request: RequestYaml) -> anyhow::Result<Child> {
        let RequestYaml(text) = request;
        let mut child = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .args(["run", "--request", "-"])
            .env("META_CORTEX_HOME", self.data)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        child
            .stdin
            .take()
            .context("stdin")?
            .write_all(text.as_bytes())?;
        Ok(child)
    }
    pub(super) fn collect(child: Child) -> anyhow::Result<Response> {
        let result = child.wait_with_output()?;
        let text = String::from_utf8(result.stdout)?;
        let response: Response = serde_saphyr::from_str(&text).with_context(|| {
            format!(
                "{text}; stderr: {}",
                String::from_utf8_lossy(&result.stderr)
            )
        })?;
        assert_eq!(response.version, ProtocolVersion::V1);
        match &response.result {
            Outcome::Success(_) => assert_eq!(result.status.code(), Some(0), "{response:?}"),
            Outcome::Error(_) => assert_eq!(result.status.code(), Some(2), "{response:?}"),
        }
        Ok(response)
    }
    pub(super) fn run(&self, operation: Operation) -> anyhow::Result<Reply> {
        match Self::collect(self.start(operation)?)?.result {
            Outcome::Success(reply) => Ok(reply),
            Outcome::Error(error) => bail!("{}: {}", error.code, error.message),
        }
    }
    pub(super) fn failure(&self, operation: Operation) -> anyhow::Result<Failure> {
        match Self::collect(self.start(operation)?)?.result {
            Outcome::Success(reply) => bail!("unexpected success: {reply:?}"),
            Outcome::Error(error) => Ok(error),
        }
    }

    pub(super) fn status(&self, feature: FeatureId) -> anyhow::Result<Vec<TaskView>> {
        let reply = self.run(Operation::Feature(FeatureOperation::Status(FeatureQuery {
            feature,
        })))?;
        let Reply::Status { ledger, tasks } = reply else {
            bail!("unexpected status reply: {reply:?}");
        };
        assert_eq!(ledger.storage_version, StorageVersion::IndexedV2);
        Ok(tasks)
    }
}

pub(super) struct Examples;
impl Examples {
    pub(super) fn task() -> anyhow::Result<CreateTask> {
        let TaskQuery { feature, task } = Self::query()?;
        Ok(CreateTask {
            feature,
            task,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            objective: Note::from("Review code".to_owned()),
            acceptance: vec![Note::from("Report findings".to_owned())],
            dependencies: Vec::new(),
            workspace: Workspace::ReadOnly,
            progress: Self::progress(Note::from("Waiting".to_owned())),
        })
    }
    pub(super) fn progress(summary: Note) -> Progress {
        Progress {
            summary,
            findings: Vec::new(),
            next_steps: Vec::new(),
            checks: Vec::new(),
            extensions: Extensions::default(),
        }
    }
    pub(super) fn claim() -> anyhow::Result<ClaimTask> {
        let TaskQuery { feature, task } = Self::query()?;
        Ok(ClaimTask {
            feature,
            task,
            expected_revision: Revision::INITIAL,
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
        })
    }
    pub(super) fn heartbeat() -> anyhow::Result<WorkerUpdate> {
        let TaskQuery { feature, task } = Self::query()?;
        Ok(WorkerUpdate {
            feature,
            task,
            expected_revision: Revision::INITIAL.advance()?,
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            attempt: Attempt::UNCLAIMED.advance()?,
            action: WorkerAction::Heartbeat {
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
            },
        })
    }
    pub(super) fn coordinate(action: CoordinatorAction) -> anyhow::Result<CoordinatorUpdate> {
        let TaskQuery { feature, task } = Self::query()?;
        Ok(CoordinatorUpdate {
            feature,
            task,
            expected_revision: Revision::INITIAL.advance()?,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            action,
        })
    }
    pub(super) fn query() -> anyhow::Result<TaskQuery> {
        Ok(TaskQuery {
            feature: Self::feature()?.feature,
            task: TaskId::try_from("task".to_owned())?,
        })
    }
    pub(super) fn feature() -> anyhow::Result<FeatureQuery> {
        Ok(FeatureQuery {
            feature: FeatureId::try_from("feature".to_owned())?,
        })
    }
}
