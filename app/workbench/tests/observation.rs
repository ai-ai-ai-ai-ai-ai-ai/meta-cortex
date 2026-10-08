use meta_cortex_workbench::FeatureCard;
use meta_cortex_workbench::agents::DeliveryAgent;
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::workflow::TaskAssignment;
use meta_cortex_workbench::model::{Phase, Progress, Workspace};
use meta_cortex_workbench::request::{AssignTask, CoordinatorAction, CoordinatorUpdate};
use meta_cortex_workbench::request::{
    ClaimTask, CreateTask, InitFeature, TaskQuery, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::Extensions;
use meta_cortex_workbench::values::WorkerId;
use meta_cortex_workbench::values::{
    BranchName, FeatureId, LeaseSeconds, Note, TaskId, TaskRevision,
};
use meta_cortex_workbench::{
    Blocker, FeatureActivity, FeatureSummary, FlowState, LatestDelivery, RecordedRole,
    WorkflowCondition,
};
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
    async fn summary(&self) -> anyhow::Result<FeatureSummary> {
        let feature = Self::feature()?;
        self.observe()
            .await?
            .summaries(PageIndex::FIRST)
            .await?
            .features
            .records
            .into_iter()
            .find_map(|card| match card {
                FeatureCard::Current { summary } if summary.feature.id == feature => Some(*summary),
                FeatureCard::Current { .. }
                | FeatureCard::UpgradeRequired { .. }
                | FeatureCard::Unavailable { .. } => None,
            })
            .ok_or_else(|| anyhow::anyhow!("fixture summary missing"))
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
            let features = observation.features(PageIndex::FIRST).await?.features;
            assert_eq!(features.records.len(), 1);
            assert_eq!(features.end, PageEnd::Complete);
            let tasks = observation
                .tasks(TaskPage {
                    feature: Scenario::feature()?,
                    page: PageIndex::FIRST,
                })
                .await?;
            assert_eq!(tasks.records.len(), 1);
            let summaries = observation.summaries(PageIndex::FIRST).await?.features;
            assert_eq!(summaries.records.len(), 1);
            let FeatureCard::Current { summary } = &summaries.records[0] else {
                anyhow::bail!("current summary");
            };
            assert_eq!(serde_json::to_value(&summary.totals.counts)?[0]["count"], 1);
            assert_eq!(summary.totals.condition, WorkflowCondition::Waiting);
            assert!(summary.active.is_empty());
            let outcomes = summary
                .outcomes
                .iter()
                .map(|outcome| (outcome.task.clone(), outcome.status))
                .collect::<Vec<_>>();
            assert_eq!(outcomes, [(Scenario::task()?, FlowState::Queued)]);
            assert_eq!(summary.latest_delivery, LatestDelivery::Nothing);

            let workflow = observation.workflow(Scenario::feature()?).await?;
            assert_eq!(workflow.chapters.len(), 1);
            assert_eq!(workflow.chapters[0].entries.len(), 1);
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
                    .features
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
            observation.summaries(PageIndex::FIRST).await?;
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
                    worker_id: WorkerId::EXAMPLE,
                    feature: Scenario::feature()?,
                    task: Scenario::task()?,
                    expected_revision: TaskRevision::INITIAL,
                    agent,
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                })
                .await?;
            fs::write(marker, "writer running")?;
            for _ in 0..30 {
                task = ledger
                    .update(WorkerUpdate {
                        worker_id: WorkerId::EXAMPLE,
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
 worker_id: WorkerId::EXAMPLE,
                feature: Scenario::feature()?,
                task: Scenario::task()?,
                expected_revision: TaskRevision::INITIAL,
                agent,
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
            })
            .await?;
        for _ in 0..100 {
            task = ledger
                .update(WorkerUpdate {
 worker_id: WorkerId::EXAMPLE,
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
        let first = observation.features(PageIndex::FIRST).await?.features;
        let second = observation.features(PageIndex::FIRST.next()).await?.features;
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
        assert_eq!(second.records[1].task.common.revision, TaskRevision::INITIAL);
        let workflow = observation.workflow(Scenario::feature()?).await?;
        assert_eq!(workflow.chapters.len(), 101);
        let chapter = workflow.chapters.iter().find(|chapter| chapter.task.common.id == task.common.id)
            .ok_or_else(|| anyhow::anyhow!("task chapter missing"))?;
        assert_eq!(chapter.entries.len(), 102);
        assert_eq!(chapter.entries.first().ok_or_else(|| anyhow::anyhow!("first event"))?.revision, TaskRevision::INITIAL);
        assert_eq!(chapter.entries.last().ok_or_else(|| anyhow::anyhow!("last event"))?.revision, task.common.revision);
        assert!(matches!(chapter.role, RecordedRole::Recorded { agent: recorded } if recorded == agent));
        let later = observation.summaries(PageIndex::FIRST.next()).await?.features;
        assert_eq!(later.end, PageEnd::Complete);
        assert!(matches!(
            later.records.as_slice(),
            [FeatureCard::Current { summary }] if summary.feature.id == FeatureId::try_from("feature-099".to_owned())?
                && matches!(summary.totals.activity, FeatureActivity::Empty)
        ));
        let summaries = observation.summaries(PageIndex::FIRST).await?.features;
        assert_eq!(summaries.records.len(), 100);
        assert_eq!(summaries.end, PageEnd::More);
        let FeatureCard::Current { summary } = &summaries.records[0] else { anyhow::bail!("current summary"); };
        assert_eq!(summary.feature.id, Scenario::feature()?);
        let totals = &summary.totals;
        let counts = serde_json::to_value(&totals.counts)?;
        assert_eq!(counts[0]["count"], 100);
        assert_eq!(counts[1]["count"], 1);
        assert_eq!(totals.condition, WorkflowCondition::Active);
        assert!(matches!(totals.activity, FeatureActivity::Recorded { first_task_at, last_activity_at }
            if first_task_at == task.common.created_at && last_activity_at == task.common.last_update));
        let active = &summary.active;
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].agent, agent);
        assert_eq!(active[0].status, FlowState::Working);
        assert_eq!(active[0].blocker, Blocker::Unblocked);
        assert_eq!(summary.outcomes.len(), 101);
        assert_eq!(summary.outcomes[0].task, Scenario::task()?);
        assert_eq!(summary.outcomes[0].status, FlowState::Working);
        Ok::<_, anyhow::Error>(())
    })
}

#[test]
fn integrated_work_is_the_latest_delivery_and_replaces_its_inputs_as_outcome() -> anyhow::Result<()>
{
    use meta_cortex_workbench::values::CommitId;
    let scenario = Scenario::new()?;
    scenario.initialize()?;
    scenario.runtime.block_on(async {
        let mut ledger = scenario.workbench()?.open(Scenario::feature()?).await?;
        let repository = git2::Repository::open(&scenario.project)?;
        let head = repository.head()?;
        let commit = CommitId::try_from(head.peel_to_commit()?.id().to_string())?;
        let worker_path = scenario.directory.path().join("worker");
        let worker_reference = repository
            .branch("worker", &head.peel_to_commit()?, false)?
            .into_reference();
        let mut worktree_options = git2::WorktreeAddOptions::new();
        worktree_options.reference(Some(&worker_reference));
        repository.worktree("worker", &worker_path, Some(&worktree_options))?;

        let id = TaskId::try_from("code".to_owned())?;
        let creator = AgentId::Gizmo(GizmoAgent::Gizmo);
        let worker = AgentId::Development(DevelopmentAgent::RustDev);
        let integrator = AgentId::Delivery(DeliveryAgent::IntegrationAgent);
        let mut task = ledger
            .create(CreateTask {
                feature: Scenario::feature()?,
                task: id.clone(),
                actor: creator,
                objective: Note::from("Code evidence".to_owned()),
                acceptance: vec![Note::from(
                    "Record a worker checkpoint and integration".to_owned(),
                )],
                dependencies: vec![],
                workspace: Workspace::Git {
                    branch: BranchName::try_from("worker".to_owned())?,
                    path: worker_path,
                },
                progress: Scenario::progress(),
            })
            .await?;
        task = ledger
            .claim(ClaimTask {
                worker_id: WorkerId::EXAMPLE,
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: task.common.revision,
                agent: worker,
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
            })
            .await?;
        task = ledger
            .update(WorkerUpdate {
                worker_id: WorkerId::EXAMPLE,
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: task.common.revision,
                agent: worker,
                attempt: task.common.attempt,
                action: WorkerAction::Checkpoint {
                    outcomes: Vec::new(),
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                    commit: commit.clone(),
                    progress: Scenario::progress(),
                },
            })
            .await?;
        task = ledger
            .update(WorkerUpdate {
                worker_id: WorkerId::EXAMPLE,
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: task.common.revision,
                agent: worker,
                attempt: task.common.attempt,
                action: WorkerAction::Ready {
                    progress: Scenario::progress(),
                },
            })
            .await?;
        let integrated = ledger
            .coordinate(CoordinatorUpdate {
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: task.common.revision,
                actor: integrator,
                action: CoordinatorAction::Integrate {
                    commit: commit.clone(),
                },
            })
            .await?;
        let release = TaskId::try_from("release".to_owned())?;
        ledger
            .create(CreateTask {
                feature: Scenario::feature()?,
                task: release.clone(),
                actor: creator,
                objective: Note::from("Release the integrated code".to_owned()),
                acceptance: vec![Note::from("Ship".to_owned())],
                dependencies: vec![id.clone()],
                workspace: Workspace::ReadOnly,
                progress: Scenario::progress(),
            })
            .await?;
        let summary = scenario.summary().await?;
        assert_eq!(
            summary.latest_delivery,
            LatestDelivery::Delivered {
                task: id,
                status: FlowState::Integrated,
                at: integrated.common.last_update,
            }
        );
        let outcomes = summary
            .outcomes
            .iter()
            .map(|outcome| outcome.task.clone())
            .collect::<Vec<_>>();
        assert_eq!(outcomes, [release, Scenario::task()?]);
        assert_eq!(serde_json::to_value(&summary.totals.counts)?[4]["count"], 1);
        Ok::<_, anyhow::Error>(())
    })
}

struct ActivityObservation {
    id: TaskId,
    workspace: Workspace,
}
impl Scenario {
    async fn completed_activity(&self, activity: ActivityObservation) -> anyhow::Result<()> {
        let ActivityObservation { id, workspace } = activity;
        let mut ledger = self.workbench()?.open(Self::feature()?).await?;
        let creator = AgentId::Gizmo(GizmoAgent::Gizmo);
        let worker = AgentId::Delivery(DeliveryAgent::PrAgent);
        let progress = Progress {
            extensions: Extensions(serde_json::from_str(
                r#"{"recorded-evidence":{"revision":"kept"},"pr_url":"https://github.com/acme/tool/pull/41"}"#,
            )?),
            ..Scenario::progress()
        };
        let task = ledger
            .create(CreateTask {
                feature: Scenario::feature()?,
                task: id.clone(),
                actor: creator,
                objective: Note::from("Complete recorded activity".to_owned()),
                acceptance: vec![Note::from("Keep ownership and evidence".to_owned())],
                dependencies: vec![],
                workspace: workspace.clone(),
                progress: progress.clone(),
            })
            .await?;
        let assigned = ledger
            .assign(AssignTask {
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: task.common.revision,
                actor: creator,
                assignment: TaskAssignment::from(worker),
            })
            .await?;
        let pull_requests = self.summary().await?.pull_requests;
        assert_eq!(pull_requests.len(), 1);
        assert_eq!(pull_requests[0].url, "https://github.com/acme/tool/pull/41");
        assert_eq!(pull_requests[0].repository, "acme/tool");
        assert_eq!(pull_requests[0].number, 41);
        assert_eq!(pull_requests[0].tasks.first(), Some(&id));
        let claimed = ledger
            .claim(ClaimTask {
                worker_id: WorkerId::EXAMPLE,
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: assigned.common.revision,
                agent: worker,
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
            })
            .await?;
        let ready = ledger
            .update(WorkerUpdate {
                worker_id: WorkerId::EXAMPLE,
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: claimed.common.revision,
                agent: worker,
                attempt: claimed.common.attempt,
                action: WorkerAction::Ready {
                    progress: progress.clone(),
                },
            })
            .await?;
        let completed = ledger
            .coordinate(CoordinatorUpdate {
                feature: Scenario::feature()?,
                task: id.clone(),
                expected_revision: ready.common.revision,
                actor: creator,
                action: CoordinatorAction::Complete,
            })
            .await?;
        let summary = self.summary().await?;
        assert_eq!(
            summary.latest_delivery,
            LatestDelivery::Delivered {
                task: id,
                status: FlowState::Completed,
                at: completed.common.last_update,
            }
        );
        Ok(())
    }
}
#[test]
fn assigned_and_completed_observations_preserve_owners_without_git_evidence() -> anyhow::Result<()>
{
    let scenario = Scenario::new()?;
    scenario.initialize()?;
    scenario.runtime.block_on(async {
        for activity in [
            ActivityObservation {
                id: TaskId::try_from("review".to_owned())?,
                workspace: Workspace::ReadOnly,
            },
            ActivityObservation {
                id: TaskId::try_from("delivery".to_owned())?,
                workspace: Workspace::Feature,
            },
        ] {
            scenario.completed_activity(activity).await?;
        }
        let summary = scenario.summary().await?;
        let count = summary
            .totals
            .counts
            .iter()
            .find(|count| matches!(count.state, FlowState::Completed))
            .ok_or_else(|| anyhow::anyhow!("completed count missing"))?;
        assert_eq!(serde_json::to_value(count)?["count"], 2);
        Ok::<_, anyhow::Error>(())
    })
}

#[test]
fn a_fresh_claim_reports_its_worker_blocker_and_full_activity_bounds() -> anyhow::Result<()> {
    use meta_cortex_workbench::request::StoppedExecution;
    let scenario = Scenario::new()?;
    scenario.initialize()?;
    scenario.runtime.block_on(async {
        let mut ledger = scenario.workbench()?.open(Scenario::feature()?).await?;
        let first_worker = AgentId::Development(DevelopmentAgent::RustDev);
        let next_worker = AgentId::Development(DevelopmentAgent::TypescriptDev);
        let coordinator = AgentId::Gizmo(GizmoAgent::Gizmo);
        let first = ledger.claim(ClaimTask {
 worker_id: WorkerId::EXAMPLE,
            feature: Scenario::feature()?, task: Scenario::task()?,
            expected_revision: TaskRevision::INITIAL, agent: first_worker,
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
        }).await?;
        let progress = ledger.update(WorkerUpdate {
 worker_id: WorkerId::EXAMPLE,
            feature: Scenario::feature()?, task: Scenario::task()?,
            expected_revision: first.common.revision, agent: first_worker,
            attempt: first.common.attempt,
            action: WorkerAction::Progress {
                ttl_seconds: LeaseSeconds::TEN_MINUTES, phase: Phase::Working,
                progress: Progress { summary: Note::from("Storage reads delivered".to_owned()), ..Scenario::progress() },
            },
        }).await?;
        let requeued = ledger.coordinate(CoordinatorUpdate {
            feature: Scenario::feature()?, task: Scenario::task()?,
            expected_revision: progress.common.revision, actor: coordinator,
            action: CoordinatorAction::Requeue {
                reason: Note::from("Continue in frontend".to_owned()),
                previous_execution: StoppedExecution::StoppedOrFinished,
            },
        }).await?;
        let assigned = ledger.assign(AssignTask {
            feature: Scenario::feature()?, task: Scenario::task()?,
            expected_revision: requeued.common.revision, actor: coordinator,
            assignment: TaskAssignment::from(next_worker),
        }).await?;
        let second = ledger.claim(ClaimTask {
 worker_id: WorkerId::EXAMPLE,
            feature: Scenario::feature()?, task: Scenario::task()?,
            expected_revision: assigned.common.revision, agent: next_worker,
            ttl_seconds: LeaseSeconds::TEN_MINUTES,
        }).await?;
        let reason = Note::from("Waiting for the storage review".to_owned());
        let blocked = ledger.update(WorkerUpdate {
 worker_id: WorkerId::EXAMPLE,
            feature: Scenario::feature()?, task: Scenario::task()?,
            expected_revision: second.common.revision, agent: next_worker,
            attempt: second.common.attempt,
            action: WorkerAction::Progress {
                ttl_seconds: LeaseSeconds::TEN_MINUTES,
                phase: Phase::Blocked { reason: reason.clone() },
                progress: Scenario::progress(),
            },
        }).await?;
        let summary = scenario.summary().await?;
        assert_eq!(summary.active.len(), 1);
        assert_eq!(summary.active[0].agent, next_worker);
        assert_eq!(summary.active[0].status, FlowState::Blocked);
        assert_eq!(summary.active[0].blocker, Blocker::Blocked { reason });
        assert_eq!(summary.totals.condition, WorkflowCondition::Attention);
        assert!(matches!(summary.totals.activity, FeatureActivity::Recorded { first_task_at, last_activity_at }
            if first_task_at == first.common.created_at && last_activity_at == blocked.common.last_update));
        Ok::<_, anyhow::Error>(())
    })
}

#[test]
fn empty_feature_has_no_invented_activity_dates() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    scenario.runtime.block_on(async {
        let repository = git2::Repository::open(&scenario.project)?;
        scenario
            .workbench()?
            .initialize(InitFeature {
                feature: Scenario::feature()?,
                objective: Note::from("No tasks yet".to_owned()),
                branch: BranchName::try_from(repository.head()?.shorthand()?.to_owned())?,
                worktree: scenario.project.clone(),
            })
            .await?;
        let summary = scenario.summary().await?;
        assert_eq!(summary.totals.activity, FeatureActivity::Empty);
        assert_eq!(summary.totals.condition, WorkflowCondition::Empty);
        assert!(summary.outcomes.is_empty());
        assert_eq!(summary.latest_delivery, LatestDelivery::Nothing);
        Ok::<_, anyhow::Error>(())
    })
}
