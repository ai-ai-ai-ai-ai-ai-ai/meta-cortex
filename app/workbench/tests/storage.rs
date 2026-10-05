use anyhow::{Context, bail};
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::workflow::TaskAssignment;
use meta_cortex_workbench::model::{Event, EventKind, Progress, Task, Workspace};
use meta_cortex_workbench::request::{
    AssignTask, ClaimTask, CreateTask, InitFeature, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::WorkerId;
use meta_cortex_workbench::values::{
    BranchName, Extensions, FeatureId, LeaseSeconds, Note, TaskId, TaskRevision,
};
use meta_cortex_workbench::versions::{
    RecordVersion, StorageVersion, VersionFamily, VersionNumber, VersionParseError,
};
use meta_cortex_workbench::{
    DataDirectory, FeatureCard, Ledger, LedgerError, PageIndex, Workbench,
};
use sea_query::{Iden, Query, SqliteQueryBuilder};
use std::env;
use std::fs;
use std::future;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use tempfile::TempDir;
use tokio::runtime::Builder;
use turso::{Connection, IoBackend};

#[cfg(windows)]
const PERSISTENT_IO: IoBackend = IoBackend::IOCP;
#[cfg(not(windows))]
const PERSISTENT_IO: IoBackend = IoBackend::Default;
use turso::transaction::TransactionBehavior;

// Independent identifiers for compatibility and deliberate-corruption fixtures.
#[derive(Iden)]
enum TaskTable {
    #[iden = "tasks"]
    Table,
    Document,
    Revision,
}

#[derive(Iden)]
enum EventTable {
    #[iden = "events"]
    Table,
    FeatureId,
    TaskId,
    Revision,
    Document,
}

#[derive(Iden)]
enum DatabasePragma {
    UserVersion,
    IntegrityCheck,
}

struct Scenario {
    directory: TempDir,
    data: TempDir,
}

impl Scenario {
    fn create() -> anyhow::Result<Self> {
        let scenario = Self {
            directory: tempfile::tempdir()?,
            data: tempfile::tempdir()?,
        };
        let mut options = git2::RepositoryInitOptions::new();
        options.initial_head("codex/feature");
        let repository = git2::Repository::init_opts(scenario.directory.path(), &options)?;
        let signature = git2::Signature::now("Workbench Test", "workbench@example.invalid")?;
        let tree_id = repository.index()?.write_tree()?;
        let tree = repository.find_tree(tree_id)?;
        repository.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])?;
        Ok(scenario)
    }

    async fn initialize(&self) -> anyhow::Result<Ledger> {
        let workbench = Workbench::discover(self.directory.path())?
            .with_data_directory(DataDirectory::from(self.data.path().to_owned()));
        let mut ledger = workbench
            .initialize(InitFeature {
                feature: FeatureId::try_from("feature".to_owned())?,
                objective: Note::from("Example feature".to_owned()),
                branch: BranchName::try_from("codex/feature".to_owned())?,
                worktree: self.directory.path().to_path_buf(),
            })
            .await?;
        let task = TaskId::try_from("task".to_owned())?;
        let task = CreateTask {
            feature: ledger.info().feature.id,
            task,
            actor: AgentId::Gizmo(GizmoAgent::Gizmo),
            objective: Note::from("Review code".to_owned()),
            acceptance: vec![Note::from("Report findings".to_owned())],
            dependencies: Vec::new(),
            workspace: Workspace::ReadOnly,
            progress: Progress {
                summary: Note::from("Waiting".to_owned()),
                findings: Vec::new(),
                next_steps: vec![Note::from("Review".to_owned())],
                checks: Vec::new(),
                extensions: Extensions::default(),
            },
        };
        ledger.create(task).await?;
        Ok(ledger)
    }

    async fn version(connection: &Connection) -> anyhow::Result<VersionNumber> {
        let mut version = Err(anyhow::anyhow!("missing database version"));
        connection
            .pragma_query(&DatabasePragma::UserVersion.to_string(), |row| {
                version = row
                    .get::<i64>(0)
                    .map(VersionNumber::from)
                    .map_err(Into::into);
                Ok(())
            })
            .await?;
        version
    }

    async fn open(&self) -> Result<Ledger, LedgerError> {
        Workbench::discover(self.directory.path())?
            .with_data_directory(DataDirectory::from(self.data.path().to_owned()))
            .open(FeatureId::try_from("feature".to_owned())?)
            .await
    }
}

#[test]
fn future_database_is_untouched() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let ledger = scenario.initialize().await?;
            let path = ledger.info().path;
            drop(ledger);
            let ledger = scenario.open().await?;
            assert_eq!(ledger.status().await?.len(), 1);
            drop(ledger);
            {
                let db = turso::Builder::new_local(path.to_str().context("path")?)
                    .with_io(PERSISTENT_IO)
                    .experimental_multiprocess_wal(true)
                    .build()
                    .await?;
                let conn = db.connect()?;
                assert_eq!(
                    Scenario::version(&conn).await?,
                    VersionNumber::from(i64::from(StorageVersion::FeatureHistoryV6))
                );
                conn.pragma_update(
                    &DatabasePragma::UserVersion.to_string(),
                    VersionNumber::from(99),
                )
                .await?;
            }
            assert!(matches!(
                scenario.open().await,
                Err(LedgerError::FeatureStorage { source, .. }) if matches!(*source,
                    LedgerError::UnsupportedVersion(VersionParseError::Unsupported {
                        schema: VersionFamily::Database, version
                    }) if version == VersionNumber::from(99))
            ));
            let db = turso::Builder::new_local(path.to_str().context("path")?)
                .with_io(PERSISTENT_IO)
                .experimental_multiprocess_wal(true)
                .build()
                .await?;
            let conn = db.connect()?;
            assert_eq!(Scenario::version(&conn).await?, VersionNumber::from(99));
            anyhow::Ok(())
        })
}

struct InterruptedWriter {
    child: Child,
}
impl Drop for InterruptedWriter {
    fn drop(&mut self) {
        match self.child.kill() {
            Ok(()) => {}
            Err(error) => eprintln!("test child stop: {error}"),
        }
        match self.child.wait() {
            Ok(_) => {}
            Err(error) => eprintln!("test child wait: {error}"),
        }
    }
}

#[test]
fn interrupted_transaction_child() -> anyhow::Result<()> {
    let path = match env::var_os("META_CORTEX_TEST_CRASH_DB") {
        Some(path) => PathBuf::from(path),
        None => return Ok(()),
    };
    let signal = PathBuf::from(env::var_os("META_CORTEX_TEST_CRASH_SIGNAL").context("signal")?);
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let database = turso::Builder::new_local(path.to_str().context("path")?)
                .with_io(PERSISTENT_IO)
                .experimental_multiprocess_wal(true)
                .build()
                .await?;
            let mut connection = database.connect()?;
            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .await?;
            let mut rows = tx
                .query(
                    Query::select()
                        .column(TaskTable::Document)
                        .from(TaskTable::Table)
                        .to_string(SqliteQueryBuilder),
                    (),
                )
                .await?;
            let row = rows.next().await?.context("task")?;
            let mut task: Task = serde_json::from_str(&row.get::<String>(0)?)?;
            drop(rows);
            task.common.revision = TaskRevision::try_from(999)?;
            task.common.objective = Note::from("Uncommitted progress".to_owned());
            tx.execute(
                Query::update()
                    .table(TaskTable::Table)
                    .value(TaskTable::Document, serde_json::to_string(&task)?)
                    .value(TaskTable::Revision, i64::from(task.common.revision))
                    .to_string(SqliteQueryBuilder),
                (),
            )
            .await?;
            let event = Event {
                version: RecordVersion::V1,
                kind: EventKind::Progress,
                actor: AgentId::Development(DevelopmentAgent::RustDev),
                note: task.common.objective.clone(),
                task,
            };
            tx.execute(
                Query::insert()
                    .into_table(EventTable::Table)
                    .columns([
                        EventTable::FeatureId,
                        EventTable::TaskId,
                        EventTable::Revision,
                        EventTable::Document,
                    ])
                    .values([
                        event.task.common.feature.to_string().into(),
                        event.task.common.id.to_string().into(),
                        i64::from(event.task.common.revision).into(),
                        serde_json::to_string(&event)?.into(),
                    ])?
                    .to_string(SqliteQueryBuilder),
                (),
            )
            .await?;
            fs::write(signal, "transaction open")?;
            future::pending::<anyhow::Result<()>>().await
        })
}

#[test]
fn killed_writer_preserves_last_committed_task_and_history() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let mut ledger = scenario.initialize().await?;
            let queued = ledger.status().await?.remove(0).task;
            let claimed = ledger
                .claim(ClaimTask {
                    worker_id: WorkerId::EXAMPLE,
                    feature: queued.common.feature,
                    task: queued.common.id,
                    expected_revision: TaskRevision::INITIAL,
                    agent: AgentId::Development(DevelopmentAgent::RustDev),
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                })
                .await?;
            let path = ledger.info().path;
            drop(ledger);
            let signal = scenario.directory.path().join("writer-ready");
            let writer = InterruptedWriter {
                child: Command::new(env::current_exe()?)
                    .args(["--exact", "interrupted_transaction_child", "--nocapture"])
                    .env("META_CORTEX_TEST_CRASH_DB", &path)
                    .env("META_CORTEX_TEST_CRASH_SIGNAL", &signal)
                    .stdout(Stdio::null())
                    .spawn()?,
            };
            let deadline = Instant::now() + Duration::from_secs(15);
            while !signal.exists() {
                if Instant::now() >= deadline {
                    bail!("child did not open its transaction");
                }
                thread::sleep(Duration::from_millis(10));
            }
            drop(writer);
            let mut ledger = scenario.open().await?;
            assert_eq!(
                i64::from(ledger.status().await?.remove(0).task.common.revision),
                2
            );
            assert_eq!(ledger.history(&claimed.common.id).await?.len(), 2);
            let heartbeat = WorkerUpdate {
                worker_id: WorkerId::EXAMPLE,
                feature: claimed.common.feature,
                task: claimed.common.id,
                expected_revision: claimed.common.revision,
                agent: AgentId::Development(DevelopmentAgent::RustDev),
                attempt: claimed.common.attempt,
                action: WorkerAction::Heartbeat {
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                },
            };
            ledger.update(heartbeat).await?;
            anyhow::Ok(())
        })
}

#[test]
fn open_writer_rejects_schema_advanced_by_another_connection() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let mut ledger = scenario.initialize().await?;
            let path = ledger.info().path;
            let database = turso::Builder::new_local(path.to_str().context("path")?)
                .with_io(PERSISTENT_IO)
                .experimental_multiprocess_wal(true)
                .build()
                .await?;
            let connection = database.connect()?;
            connection
                .pragma_update(
                    &DatabasePragma::UserVersion.to_string(),
                    VersionNumber::from(99),
                )
                .await?;
            let task = ledger.task(&TaskId::try_from("task".to_owned())?).await?;
            let result = ledger
                .claim(ClaimTask {
                    feature: ledger.info().feature.id,
                    task: TaskId::try_from("task".to_owned())?,
                    expected_revision: task.task.common.revision,
                    agent: AgentId::Development(DevelopmentAgent::RustDev),
                    worker_id: WorkerId::try_from(
                        "409766ea-0c85-4db1-9890-ea6d058c78da".to_owned(),
                    )?,
                    ttl_seconds: LeaseSeconds::try_from(3600)?,
                })
                .await;
            assert!(
                result.is_err(),
                "stale writer must reject an unsupported schema"
            );
            assert_eq!(
                ledger
                    .history(&TaskId::try_from("task".to_owned())?)
                    .await?
                    .len(),
                1
            );
            anyhow::Ok(())
        })
}

#[test]
fn features_have_distinct_database_paths() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let first = scenario.initialize().await?;
            let workbench = Workbench::discover(scenario.directory.path())?
                .with_data_directory(DataDirectory::from(scenario.data.path().to_owned()));
            let input = InitFeature {
                feature: FeatureId::try_from("second".to_owned())?,
                objective: Note::from("second".to_owned()),
                branch: first.info().feature.branch,
                worktree: scenario.directory.path().to_owned(),
            };
            let second = workbench.initialize(input).await?;
            assert_ne!(first.info().path, second.info().path);
            assert_eq!(
                second
                    .info()
                    .path
                    .file_name()
                    .and_then(|name| name.to_str()),
                Some("second.db")
            );
            assert_eq!(first.status().await?.len(), 1);
            anyhow::Ok(())
        })
}

struct DurabilityWriter {
    workbench: Workbench,
    prefix: TaskId,
}
impl DurabilityWriter {
    async fn write(&self, index: u32) -> anyhow::Result<()> {
        let feature = FeatureId::try_from("feature".to_owned())?;
        let task = TaskId::try_from(format!("{}-{index}", self.prefix))?;
        self.workbench
            .open(feature.clone())
            .await?
            .create(CreateTask {
                feature: feature.clone(),
                task: task.clone(),
                actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                objective: Note::from("Concurrent task".to_owned()),
                acceptance: vec![Note::from("Persist assignment and history".to_owned())],
                dependencies: Vec::new(),
                workspace: Workspace::ReadOnly,
                progress: Progress {
                    summary: Note::from("Waiting".to_owned()),
                    findings: Vec::new(),
                    next_steps: Vec::new(),
                    checks: Vec::new(),
                    extensions: Extensions::default(),
                },
            })
            .await?;
        self.workbench
            .open(feature.clone())
            .await?
            .assign(AssignTask {
                feature,
                task,
                expected_revision: TaskRevision::INITIAL,
                actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                assignment: TaskAssignment::from(AgentId::Development(DevelopmentAgent::RustDev)),
            })
            .await?;
        Ok(())
    }
}

#[test]
fn durability_writer_child() -> anyhow::Result<()> {
    let project = match env::var_os("META_CORTEX_DURABILITY_PROJECT") {
        Some(path) => PathBuf::from(path),
        None => return Ok(()),
    };
    let data = PathBuf::from(env::var_os("META_CORTEX_DURABILITY_DATA").context("data")?);
    let writer = DurabilityWriter {
        workbench: Workbench::discover(&project)?.with_data_directory(DataDirectory::from(data)),
        prefix: TaskId::try_from(env::var("META_CORTEX_DURABILITY_WRITER")?)?,
    };
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            for index in 0..20 {
                writer.write(index).await?;
            }
            anyhow::Ok(())
        })
}

impl Scenario {
    fn writer(&self, prefix: TaskId) -> anyhow::Result<Child> {
        Ok(Command::new(env::current_exe()?)
            .args(["--exact", "durability_writer_child", "--nocapture"])
            .env("META_CORTEX_DURABILITY_PROJECT", self.directory.path())
            .env("META_CORTEX_DURABILITY_DATA", self.data.path())
            .env("META_CORTEX_DURABILITY_WRITER", prefix.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?)
    }
    async fn observe_during_writes(&self) -> anyhow::Result<()> {
        let workbench = Workbench::discover(self.directory.path())?
            .with_data_directory(DataDirectory::from(self.data.path().to_owned()));
        for _ in 0..200 {
            let catalog = workbench
                .observe()
                .await?
                .summaries(PageIndex::FIRST)
                .await?;
            assert!(matches!(
                catalog.features.records.as_slice(),
                [FeatureCard::Current { .. }]
            ));
        }
        Ok(())
    }
    async fn verify_durable_writes(&self) -> anyhow::Result<()> {
        let ledger = self.open().await?;
        let tasks = ledger.status().await?;
        assert_eq!(tasks.len(), 41);
        for prefix in ["first", "second"] {
            for index in 0..20 {
                let id = TaskId::try_from(format!("{prefix}-{index}"))?;
                let view = ledger.task(&id).await?;
                assert_eq!(view.task.common.revision, TaskRevision::INITIAL.advance()?);
                assert_eq!(ledger.history(&id).await?.len(), 2);
            }
        }
        let path = ledger.info().path;
        drop(ledger);
        let database = turso::Builder::new_local(path.to_str().context("path")?)
            .read_only(true)
            .with_io(PERSISTENT_IO)
            .experimental_multiprocess_wal(true)
            .build()
            .await?;
        let connection = database.connect()?;
        let mut results = Vec::new();
        connection
            .pragma_query(&DatabasePragma::IntegrityCheck.to_string(), |row| {
                results.push(row.get::<String>(0));
                Ok(())
            })
            .await?;
        assert_eq!(results.into_iter().collect::<Result<Vec<_>, _>>()?, ["ok"]);
        Ok(())
    }
}

#[test]
fn concurrent_writers_and_dashboard_reads_preserve_tasks_history_and_integrity()
-> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    let runtime = Builder::new_current_thread().enable_time().build()?;
    drop(runtime.block_on(scenario.initialize())?);
    let writers = [
        scenario.writer(TaskId::try_from("first".to_owned())?)?,
        scenario.writer(TaskId::try_from("second".to_owned())?)?,
    ];
    runtime.block_on(scenario.observe_during_writes())?;
    for writer in writers {
        let output = writer.wait_with_output()?;
        assert!(
            output.status.success(),
            "{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
    runtime.block_on(scenario.verify_durable_writes())
}
