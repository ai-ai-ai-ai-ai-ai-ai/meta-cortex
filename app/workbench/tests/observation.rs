use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::{Phase, Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CreateTask, InitFeature, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{BranchName, FeatureId, LeaseSeconds, Note, Revision, TaskId};
use meta_cortex_workbench::{
    DataDirectory, HistoryPage, LedgerError, Observation, PageEnd, PageIndex, TaskPage, Workbench,
};
use std::collections::HashSet;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};
use std::{env, fs, thread};
use tokio::runtime::{Builder, Runtime};

enum MarkerPresence {
    Present,
    Pending,
}
impl From<bool> for MarkerPresence {
    fn from(present: bool) -> Self {
        match present {
            true => Self::Present,
            false => Self::Pending,
        }
    }
}
enum WriterLifecycle {
    Running,
    Exited(ExitStatus),
}
impl WriterLifecycle {
    // Child is an external mutable process handle required by try_wait.
    fn poll(child: &mut Child) -> io::Result<Self> {
        Ok(match child.try_wait()? {
            Some(status) => Self::Exited(status),
            None => Self::Running,
        })
    }
}

struct Scenario {
    directory: tempfile::TempDir,
    project: PathBuf,
    data: DataDirectory,
    runtime: Runtime,
}
impl Scenario {
    fn new() -> anyhow::Result<Self> {
        let directory = tempfile::tempdir()?;
        let project = directory.path().join("project");
        let repository = git2::Repository::init(&project)?;
        let signature = git2::Signature::now("Fixture", "fixture@example.invalid")?;
        let tree = repository.find_tree(repository.index()?.write_tree()?)?;
        repository.commit(Some("HEAD"), &signature, &signature, "fixture", &tree, &[])?;
        let data = DataDirectory::from(directory.path().join("data"));
        Ok(Self {
            directory,
            project,
            data,
            runtime: Builder::new_current_thread().enable_time().build()?,
        })
    }
    fn workbench(&self) -> anyhow::Result<Workbench> {
        Ok(Workbench::discover(&self.project)?.with_data_directory(self.data.clone()))
    }
    fn feature() -> anyhow::Result<FeatureId> {
        Ok(FeatureId::try_from("fixture".to_owned())?)
    }
    fn task() -> anyhow::Result<TaskId> {
        Ok(TaskId::try_from("task".to_owned())?)
    }
    fn query() -> anyhow::Result<TaskQuery> {
        Ok(TaskQuery {
            feature: Self::feature()?,
            task: Self::task()?,
        })
    }
    fn progress() -> Progress {
        Progress {
            summary: Note::from("recorded progress".to_owned()),
            findings: vec![],
            next_steps: vec![],
            checks: vec![],
            extensions: Default::default(),
        }
    }
    fn initialize(&self) -> anyhow::Result<PathBuf> {
        self.runtime.block_on(async {
            let workbench = self.workbench()?;
            let repository = git2::Repository::open(&self.project)?;
            let branch = BranchName::try_from(repository.head()?.shorthand()?.to_owned())?;
            let mut ledger = workbench
                .initialize(InitFeature {
                    feature: Self::feature()?,
                    objective: Note::from("Observe this feature".to_owned()),
                    branch,
                    worktree: self.project.clone(),
                })
                .await?;
            ledger
                .create(CreateTask {
                    feature: Self::feature()?,
                    task: Self::task()?,
                    actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                    objective: Note::from("Observe this task".to_owned()),
                    acceptance: vec![Note::from("record observations".to_owned())],
                    dependencies: vec![],
                    workspace: Workspace::ReadOnly,
                    progress: Self::progress(),
                })
                .await?;
            Ok(ledger.info().path)
        })
    }
    async fn observe(&self) -> anyhow::Result<Observation> {
        Ok(self.workbench()?.observe().await?)
    }
    fn files(directory: &Path) -> anyhow::Result<Vec<FileSnapshot>> {
        let mut files = Vec::new();
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            files.push(FileSnapshot {
                path: entry.path(),
                bytes: fs::read(entry.path())?,
            });
        }
        files.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(files)
    }
}
#[derive(Debug, PartialEq, Eq)]
struct FileSnapshot {
    path: PathBuf,
    bytes: Vec<u8>,
}

#[test]
fn observation_does_not_initialize_identity_or_database() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    scenario.runtime.block_on(async {
        assert!(matches!(
            scenario.workbench()?.observe().await,
            Err(LedgerError::Uninitialized)
        ));
        Ok::<_, anyhow::Error>(())
    })?;
    assert!(!scenario.project.join(".meta-cortex").exists());
    assert!(!scenario.data.path().exists());
    Ok(())
}
#[test]
fn read_only_observation_preserves_records_history_schema_and_files() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    let path = scenario.initialize()?;
    let parent = path.parent().ok_or_else(|| anyhow::anyhow!("parent"))?;
    let before = Scenario::files(parent)?;
    let identity = fs::read(scenario.project.join(".meta-cortex/repository-id"))?;
    scenario.runtime.block_on(async {
        let observation = scenario.observe().await?;
        for _ in 0..5 {
            let features = observation.features(PageIndex::FIRST).await?;
            assert_eq!(features.records.len(), 1);
            assert_eq!(features.end, PageEnd::Complete);
            let tasks = observation
                .tasks(TaskPage {
                    feature: Scenario::feature()?,
                    page: PageIndex::FIRST,
                })
                .await?;
            assert_eq!(tasks.records.len(), 1);
            let history = observation
                .history(HistoryPage {
                    feature: Scenario::feature()?,
                    task: Scenario::task()?,
                    page: PageIndex::FIRST,
                })
                .await?;
            assert_eq!(history.records.len(), 1);
            assert_eq!(history.records[0].task, tasks.records[0]);
            assert_eq!(
                observation.task(Scenario::query()?).await?,
                tasks.records[0]
            );
            assert!(
                observation
                    .features(PageIndex::FIRST.next())
                    .await?
                    .records
                    .is_empty()
            );
        }
        assert!(matches!(
            observation
                .task(TaskQuery {
                    feature: Scenario::feature()?,
                    task: TaskId::try_from("missing".to_owned())?
                })
                .await,
            Err(LedgerError::NotFound)
        ));
        Ok::<_, anyhow::Error>(())
    })?;
    assert_eq!(before, Scenario::files(parent)?);
    assert_eq!(
        identity,
        fs::read(scenario.project.join(".meta-cortex/repository-id"))?
    );
    Ok(())
}
#[test]
fn observer_and_writer_run_in_distinct_processes() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    let path = scenario.initialize()?;
    let marker = scenario.directory.path().join("writer-started");
    let mut child = Command::new(env::current_exe()?)
        .args(["--exact", "multiprocess_writer", "--nocapture"])
        .env("OBSERVATION_WRITER_PROJECT", &scenario.project)
        .env("OBSERVATION_WRITER_DATA", scenario.data.path())
        .env("OBSERVATION_WRITER_MARKER", &marker)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let started = Instant::now();
    loop {
        match MarkerPresence::from(marker.exists()) {
            MarkerPresence::Present => break,
            MarkerPresence::Pending => {}
        }
        assert!(
            started.elapsed() < Duration::from_secs(30),
            "writer did not start"
        );
        match WriterLifecycle::poll(&mut child)? {
            WriterLifecycle::Exited(status) => anyhow::bail!("writer exited early: {status}"),
            WriterLifecycle::Running => {}
        }
        thread::sleep(Duration::from_millis(10));
    }
    let mut reads = 0;
    let mut revisions = HashSet::new();
    let observation_result = scenario.runtime.block_on(async {
        let observation = scenario.observe().await?;
        loop {
            match WriterLifecycle::poll(&mut child)? {
                WriterLifecycle::Exited(_) => break,
                WriterLifecycle::Running => {}
            }
            let task = observation.task(Scenario::query()?).await?;
            revisions.insert(task.common.revision);
            observation.features(PageIndex::FIRST).await?;
            observation
                .history(HistoryPage {
                    feature: Scenario::feature()?,
                    task: Scenario::task()?,
                    page: PageIndex::FIRST,
                })
                .await?;
            reads += 1;
            thread::sleep(Duration::from_millis(5));
        }
        Ok::<_, anyhow::Error>(())
    });
    let output = child.wait_with_output()?;
    observation_result?;
    assert!(
        output.status.success(),
        "writer failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(reads > 2, "observer did not overlap writer");
    assert!(
        revisions.len() > 2,
        "writer transitions were not visible: {revisions:?}"
    );
    let before = Scenario::files(path.parent().ok_or_else(|| anyhow::anyhow!("parent"))?)?;
    scenario.runtime.block_on(async {
        let observation = scenario.observe().await?;
        let task = observation.task(Scenario::query()?).await?;
        assert_eq!(i64::from(task.common.revision), 32);
        let history = observation
            .history(HistoryPage {
                feature: Scenario::feature()?,
                task: Scenario::task()?,
                page: PageIndex::FIRST,
            })
            .await?;
        assert_eq!(history.records.len(), 32);
        Ok::<_, anyhow::Error>(())
    })?;
    assert_eq!(
        before,
        Scenario::files(path.parent().ok_or_else(|| anyhow::anyhow!("parent"))?)?
    );
    eprintln!(
        "distinct writer PID with {reads} observer sweeps; {} observed revisions; 30 writer transitions committed",
        revisions.len()
    );
    Ok(())
}
#[test]
fn multiprocess_writer() -> anyhow::Result<()> {
    let project = match env::var_os("OBSERVATION_WRITER_PROJECT") {
        Some(path) => PathBuf::from(path),
        None => return Ok(()),
    };
    let data =
        env::var_os("OBSERVATION_WRITER_DATA").ok_or_else(|| anyhow::anyhow!("writer data"))?;
    let marker =
        env::var_os("OBSERVATION_WRITER_MARKER").ok_or_else(|| anyhow::anyhow!("writer marker"))?;
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let workbench = Workbench::discover(&project)?
                .with_data_directory(DataDirectory::from(PathBuf::from(data)));
            let mut ledger = workbench.open(Scenario::feature()?).await?;
            let agent = AgentId::Development(DevelopmentAgent::RustDev);
            let mut task = ledger
                .claim(ClaimTask {
                    feature: Scenario::feature()?,
                    task: Scenario::task()?,
                    expected_revision: Revision::INITIAL,
                    agent,
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                })
                .await?;
            fs::write(marker, "writer running")?;
            for _ in 0..30 {
                task = ledger
                    .update(WorkerUpdate {
                        feature: Scenario::feature()?,
                        task: Scenario::task()?,
                        expected_revision: task.common.revision,
                        agent,
                        attempt: task.common.attempt,
                        action: WorkerAction::Progress {
                            ttl_seconds: LeaseSeconds::TEN_MINUTES,
                            phase: Phase::Working,
                            progress: Scenario::progress(),
                        },
                    })
                    .await?;
                thread::sleep(Duration::from_millis(15));
            }
            Ok::<_, anyhow::Error>(())
        })
}

#[test]
fn database_pages_bound_features_tasks_and_long_history() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    scenario.initialize()?;
    scenario.runtime.block_on(async {
        let workbench = scenario.workbench()?;
        let mut ledger = workbench.open(Scenario::feature()?).await?;
        for index in 0..100 {
            let feature = FeatureId::try_from(format!("feature-{index:03}"))?;
            workbench
                .initialize(InitFeature {
                    feature,
                    objective: Note::from("Page fixture".to_owned()),
                    branch: BranchName::try_from(
                        git2::Repository::open(&scenario.project)?
                            .head()?
                            .shorthand()?
                            .to_owned(),
                    )?,
                    worktree: scenario.project.clone(),
                })
                .await?;
            ledger
                .create(CreateTask {
                    feature: Scenario::feature()?,
                    task: TaskId::try_from(format!("task-{index:03}"))?,
                    actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                    objective: Note::from("Page fixture".to_owned()),
                    acceptance: vec![Note::from("Bound reads".to_owned())],
                    dependencies: vec![],
                    workspace: Workspace::ReadOnly,
                    progress: Scenario::progress(),
                })
                .await?;
        }
        let agent = AgentId::Development(DevelopmentAgent::RustDev);
        let mut task = ledger
            .claim(ClaimTask {
                feature: Scenario::feature()?,
                task: Scenario::task()?,
                expected_revision: Revision::INITIAL,
                agent,
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
            })
            .await?;
        for _ in 0..100 {
            task = ledger
                .update(WorkerUpdate {
                    feature: Scenario::feature()?,
                    task: Scenario::task()?,
                    expected_revision: task.common.revision,
                    agent,
                    attempt: task.common.attempt,
                    action: WorkerAction::Progress {
                        ttl_seconds: LeaseSeconds::TEN_MINUTES,
                        phase: Phase::Working,
                        progress: Scenario::progress(),
                    },
                })
                .await?;
        }
        let observation = scenario.observe().await?;
        let first = observation.features(PageIndex::FIRST).await?;
        let second = observation.features(PageIndex::FIRST.next()).await?;
        assert_eq!(first.records.len(), 100);
        assert_eq!(second.records.len(), 1);
        assert_eq!(first.end, PageEnd::More);
        assert_eq!(second.end, PageEnd::Complete);
        let first = observation
            .tasks(TaskPage {
                feature: Scenario::feature()?,
                page: PageIndex::FIRST,
            })
            .await?;
        let second = observation
            .tasks(TaskPage {
                feature: Scenario::feature()?,
                page: PageIndex::FIRST.next(),
            })
            .await?;
        assert_eq!(first.records.len(), 100);
        assert_eq!(second.records.len(), 1);
        assert_eq!(first.end, PageEnd::More);
        assert_eq!(second.end, PageEnd::Complete);
        let first = observation
            .history(HistoryPage {
                feature: Scenario::feature()?,
                task: Scenario::task()?,
                page: PageIndex::FIRST,
            })
            .await?;
        let second = observation
            .history(HistoryPage {
                feature: Scenario::feature()?,
                task: Scenario::task()?,
                page: PageIndex::FIRST.next(),
            })
            .await?;
        assert_eq!(first.records.len(), 100);
        assert_eq!(second.records.len(), 2);
        assert_eq!(first.end, PageEnd::More);
        assert_eq!(second.end, PageEnd::Complete);
        assert_eq!(first.records[0].task, task);
        assert_eq!(second.records[1].task.common.revision, Revision::INITIAL);
        Ok::<_, anyhow::Error>(())
    })
}
