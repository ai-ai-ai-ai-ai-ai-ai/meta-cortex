use anyhow::{Context, bail};
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::{Event, EventKind, Progress, Task, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CreateTask, InitFeature, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    BranchName, Extensions, FeatureId, LeaseSeconds, Note, Revision, TaskId,
};
use meta_cortex_workbench::versions::{
    RecordVersion, StorageVersion, VersionFamily, VersionNumber, VersionParseError,
};
use meta_cortex_workbench::{DataDirectory, Ledger, LedgerError, Workbench};
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
use turso::Connection;
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
                    .experimental_multiprocess_wal(true)
                    .build()
                    .await?;
                let conn = db.connect()?;
                assert_eq!(
                    Scenario::version(&conn).await?,
                    VersionNumber::from(i64::from(StorageVersion::RelationalV3))
                );
                conn.pragma_update(
                    &DatabasePragma::UserVersion.to_string(),
                    VersionNumber::from(99),
                )
                .await?;
            }
            assert!(matches!(
                scenario.open().await,
                Err(LedgerError::UnsupportedVersion(VersionParseError::Unsupported {
                    schema: VersionFamily::Database,
                    version
                })) if version == VersionNumber::from(99)
            ));
            let db = turso::Builder::new_local(path.to_str().context("path")?)
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
            task.revision = Revision::try_from(999)?;
            task.objective = Note::from("Uncommitted progress".to_owned());
            tx.execute(
                Query::update()
                    .table(TaskTable::Table)
                    .value(TaskTable::Document, serde_json::to_string(&task)?)
                    .value(TaskTable::Revision, i64::from(task.revision))
                    .to_string(SqliteQueryBuilder),
                (),
            )
            .await?;
            let event = Event {
                version: RecordVersion::V1,
                kind: EventKind::Progress,
                actor: AgentId::Development(DevelopmentAgent::RustDev),
                note: task.objective.clone(),
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
                        event.task.feature.to_string().into(),
                        event.task.id.to_string().into(),
                        i64::from(event.task.revision).into(),
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
                    feature: queued.feature,
                    task: queued.id,
                    expected_revision: Revision::INITIAL,
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
            assert_eq!(i64::from(ledger.status().await?.remove(0).task.revision), 2);
            assert_eq!(ledger.history(&claimed.id).await?.len(), 2);
            let heartbeat = WorkerUpdate {
                feature: claimed.feature,
                task: claimed.id,
                expected_revision: claimed.revision,
                agent: AgentId::Development(DevelopmentAgent::RustDev),
                attempt: claimed.attempt,
                action: WorkerAction::Heartbeat {
                    ttl_seconds: LeaseSeconds::TEN_MINUTES,
                },
            };
            ledger.update(heartbeat).await?;
            anyhow::Ok(())
        })
}
