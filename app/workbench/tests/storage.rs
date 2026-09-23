use anyhow::{Context, bail};
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::{Progress, Workspace};
use meta_cortex_workbench::request::{
    ClaimTask, CreateTask, InitFeature, WorkerAction, WorkerUpdate,
};
use meta_cortex_workbench::values::{
    BranchNameParse, Extensions, FeatureIdParse, LeaseSeconds, Note, Revision, TaskIdParse,
};
use meta_cortex_workbench::versions::{
    StorageVersion, StorageVersionParse, VersionFamily, VersionNumber, VersionParseError,
};
use meta_cortex_workbench::{Ledger, LedgerError, Workbench};
use std::env;
use std::fs;
use std::future;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use tempfile::TempDir;
use tokio::runtime::Builder;

struct Scenario {
    directory: TempDir,
}

impl Scenario {
    fn create() -> anyhow::Result<Self> {
        let scenario = Self {
            directory: tempfile::tempdir()?,
        };
        for args in [
            vec!["init", "-b", "codex/feature"],
            vec!["config", "user.name", "Workbench Test"],
            vec!["config", "user.email", "workbench@example.invalid"],
            vec!["commit", "--allow-empty", "-m", "initial"],
        ] {
            let result = Command::new("git")
                .arg("-C")
                .arg(scenario.directory.path())
                .args(args)
                .output()?;
            assert!(
                result.status.success(),
                "{}",
                String::from_utf8_lossy(&result.stderr)
            );
        }
        Ok(scenario)
    }

    async fn initialize(&self) -> anyhow::Result<Ledger> {
        let workbench = Workbench::discover(self.directory.path())?;
        let mut ledger = workbench
            .initialize(InitFeature {
                feature: match FeatureIdParse::from("feature".to_owned()) {
                    FeatureIdParse::Parsed(value) => value,
                    FeatureIdParse::Invalid(error) => return Err(error.into()),
                },
                objective: Note::from("Example feature".to_owned()),
                branch: match BranchNameParse::from("codex/feature".to_owned()) {
                    BranchNameParse::Parsed(value) => value,
                    BranchNameParse::Invalid(error) => return Err(error.into()),
                },
                worktree: self.directory.path().to_path_buf(),
            })
            .await?;
        let task = match TaskIdParse::from("task".to_owned()) {
            TaskIdParse::Parsed(task) => task,
            TaskIdParse::Invalid(error) => return Err(error.into()),
        };
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

    async fn open(&self) -> Result<Ledger, LedgerError> {
        Workbench::discover(self.directory.path())?
            .open(match FeatureIdParse::from("feature".to_owned()) {
                FeatureIdParse::Parsed(value) => value,
                FeatureIdParse::Invalid(error) => return Err(error.into()),
            })
            .await
    }
}

#[test]
fn older_database_migrates_and_future_database_is_untouched() -> anyhow::Result<()> {
    let scenario = Scenario::create()?;
    Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async {
            let ledger = scenario.initialize().await?;
            let path = ledger.info().path;
            drop(ledger);
            {
                let db = turso::Builder::new_local(path.to_str().context("path")?)
                    .experimental_multiprocess_wal(true)
                    .build()
                    .await?;
                let conn = db.connect()?;
                conn.execute("DROP INDEX events_task_revision", ()).await?;
                conn.execute(
                    &format!("PRAGMA user_version={}", StorageVersion::DocumentsV1),
                    (),
                )
                .await?;
            }
            let ledger = scenario.open().await?;
            assert_eq!(ledger.status().await?.len(), 1);
            drop(ledger);
            {
                let db = turso::Builder::new_local(path.to_str().context("path")?)
                    .experimental_multiprocess_wal(true)
                    .build()
                    .await?;
                let conn = db.connect()?;
                let mut rows = conn.query("PRAGMA user_version", ()).await?;
                assert_eq!(
                    match StorageVersionParse::from(
                        rows.next().await?.context("version")?.get::<i64>(0)?
                    ) {
                        StorageVersionParse::Parsed(value) => value,
                        StorageVersionParse::Invalid(error) => return Err(error.into()),
                    },
                    StorageVersion::IndexedV2
                );
                drop(rows);
                conn.execute("PRAGMA user_version=99", ()).await?;
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
            let mut rows = conn.query("PRAGMA user_version", ()).await?;
            assert_eq!(rows.next().await?.context("version")?.get::<i64>(0)?, 99);
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
            let connection = database.connect()?;
            connection.execute("BEGIN IMMEDIATE", ()).await?;
            connection
                .execute(
                    "UPDATE tasks SET document = 'uncommitted corruption', revision = 999",
                    (),
                )
                .await?;
            connection
                .execute(
                    "INSERT INTO events VALUES ('task', 999, 'uncommitted event')",
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
