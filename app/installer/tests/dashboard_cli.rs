use meta_cortex_visualization::{DashboardMode, DashboardRequest, DashboardView};
use meta_cortex_workbench::agents::{AgentId, GizmoAgent};
use meta_cortex_workbench::model::{Progress, Workspace};
use meta_cortex_workbench::request::{CreateTask, InitFeature, TaskQuery};
use meta_cortex_workbench::values::{BranchName, FeatureId, Note, TaskId};
use meta_cortex_workbench::versions::ProtocolVersion;
use meta_cortex_workbench::{DataDirectory, PageIndex, Workbench};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tokio::runtime::Builder;

#[derive(Serialize)]
struct Request {
    version: ProtocolVersion,
    project: PathBuf,
    operation: Operation,
}
#[derive(Serialize)]
#[serde(tag = "group", content = "command")]
enum Operation {
    Workbench(WorkbenchOperation),
}
#[derive(Serialize)]
#[serde(tag = "name", content = "arguments")]
enum WorkbenchOperation {
    Dashboard(DashboardRequest),
}
#[derive(Deserialize)]
struct Response {
    result: Outcome,
}
#[derive(Deserialize)]
#[serde(tag = "status", content = "data", rename_all = "snake_case")]
enum Outcome {
    Success(Reply),
    Error(Failure),
}
#[derive(Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
enum Reply {
    Dashboard(Report),
}
#[derive(Deserialize)]
struct Report {
    content: Note,
}
#[derive(Deserialize)]
struct Failure {
    message: Note,
}
struct Scenario {
    directory: tempfile::TempDir,
    project: PathBuf,
    data: DataDirectory,
    database: PathBuf,
}
impl Scenario {
    fn new() -> anyhow::Result<Self> {
        let directory = tempfile::tempdir()?;
        let project = directory.path().join("project");
        let mut options = git2::RepositoryInitOptions::new();
        options.initial_head("codex/feature");
        let repository = git2::Repository::init_opts(&project, &options)?;
        let signature = git2::Signature::now("Fixture", "fixture@example.invalid")?;
        let tree = repository.find_tree(repository.index()?.write_tree()?)?;
        repository.commit(Some("HEAD"), &signature, &signature, "fixture", &tree, &[])?;
        let data = DataDirectory::from(directory.path().join("data"));
        let database = Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let workbench = Workbench::discover(&project)?.with_data_directory(data.clone());
                let mut ledger = workbench
                    .initialize(InitFeature {
                        feature: Self::feature()?,
                        objective: Note::from("Recorded feature objective".to_owned()),
                        branch: BranchName::try_from("codex/feature".to_owned())?,
                        worktree: project.clone(),
                    })
                    .await?;
                ledger
                    .create(CreateTask {
                        feature: Self::feature()?,
                        task: Self::task()?,
                        actor: AgentId::Gizmo(GizmoAgent::Gizmo),
                        objective: Note::from("Recorded task objective".to_owned()),
                        acceptance: vec![Note::from("Accept recorded output".to_owned())],
                        dependencies: vec![],
                        workspace: Workspace::ReadOnly,
                        progress: Progress {
                            summary: Note::from("Recorded progress".to_owned()),
                            findings: vec![Note::from("Recorded finding".to_owned())],
                            next_steps: vec![],
                            checks: vec![],
                            extensions: Default::default(),
                        },
                    })
                    .await?;
                Ok::<_, anyhow::Error>(ledger.info().path)
            })?;
        Ok(Self {
            directory,
            project,
            data,
            database,
        })
    }
    fn feature() -> anyhow::Result<FeatureId> {
        Ok(FeatureId::try_from("feature".to_owned())?)
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
    fn request(&self, arguments: DashboardRequest) -> anyhow::Result<PathBuf> {
        let path = self.directory.path().join("request.yaml");
        fs::write(
            &path,
            serde_saphyr::to_string(&Request {
                version: ProtocolVersion::CURRENT,
                project: self.project.clone(),
                operation: Operation::Workbench(WorkbenchOperation::Dashboard(arguments)),
            })?,
        )?;
        Ok(path)
    }
    fn run(&self, arguments: DashboardRequest) -> anyhow::Result<Outcome> {
        let output = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .args(["run", "--request"])
            .arg(self.request(arguments)?)
            .env("META_CORTEX_HOME", self.data.path())
            .output()?;
        let response: Response = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
        match &response.result {
            Outcome::Success(_) => assert!(output.status.success()),
            Outcome::Error(_) => assert_eq!(output.status.code(), Some(2)),
        }
        Ok(response.result)
    }
}
#[test]
fn snapshots_use_typed_transport_and_recorded_content() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    for view in [
        DashboardView::Features,
        DashboardView::Tasks {
            feature: Scenario::feature()?,
        },
        DashboardView::Task {
            query: Scenario::query()?,
        },
        DashboardView::History {
            query: Scenario::query()?,
        },
    ] {
        let outcome = scenario.run(DashboardRequest {
            mode: DashboardMode::Snapshot,
            view,
            page: PageIndex::FIRST,
        })?;
        let Outcome::Success(Reply::Dashboard(report)) = outcome else {
            anyhow::bail!("snapshot failed");
        };
        let text = report.content.to_string();
        assert!(text.contains("recorded ledger data"));
        assert!(text.contains("Git authorship: unrecorded"));
        assert!(
            !text.contains("Fixture"),
            "Git commit author leaked into dashboard"
        );
    }
    let Outcome::Error(failure) = scenario.run(DashboardRequest {
        mode: DashboardMode::Interactive,
        view: DashboardView::Features,
        page: PageIndex::FIRST,
    })?
    else {
        anyhow::bail!("redirected interactive request accepted");
    };
    assert!(failure.message.to_string().contains("requires a terminal"));
    Ok(())
}
enum TerminalInvocation {
    Typed,
    Direct { directory: PathBuf },
}
#[derive(Debug, PartialEq, Eq)]
struct StorageSnapshot {
    identity: Vec<u8>,
    files: Vec<FileSnapshot>,
}
#[derive(Debug, PartialEq, Eq)]
struct FileSnapshot {
    path: PathBuf,
    bytes: Vec<u8>,
}
impl Scenario {
    fn storage_snapshot(&self) -> anyhow::Result<StorageSnapshot> {
        let mut files = Vec::new();
        let directory = self
            .database
            .parent()
            .ok_or_else(|| anyhow::anyhow!("database parent"))?;
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            files.push(FileSnapshot {
                path: entry.path(),
                bytes: fs::read(entry.path())?,
            });
        }
        files.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(StorageSnapshot {
            identity: fs::read(self.project.join(".meta-cortex/repository-id"))?,
            files,
        })
    }
    fn linked_directory(&self) -> anyhow::Result<PathBuf> {
        let directory = self.directory.path().join("linked");
        let repository = git2::Repository::open(&self.project)?;
        let base = repository.head()?.peel_to_commit()?;
        let branch = repository.branch("codex/linked", &base, false)?;
        let mut options = git2::WorktreeAddOptions::new();
        options.reference(Some(branch.get()));
        repository.worktree("linked", &directory, Some(&options))?;
        Ok(directory)
    }
    #[cfg(unix)]
    fn terminal(&self, invocation: TerminalInvocation) -> anyhow::Result<()> {
        let script = r#"
import os, pty, subprocess, sys, termios, time, select, fcntl, struct
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
before = termios.tcgetattr(slave)
env = os.environ.copy(); env['TERM'] = 'xterm-256color'
child = subprocess.Popen([sys.argv[1], *sys.argv[3:]], stdin=slave, stdout=slave, stderr=slave, env=env)
try:
    output = bytearray()
    def capture(stage):
        deadline = time.monotonic() + 1.5
        while time.monotonic() < deadline:
            if select.select([master], [], [], .1)[0]: output.extend(os.read(master, 65536))
        with open(os.path.join(sys.argv[2], stage), 'wb') as file: file.write(output)
    capture('features')
    os.write(master, b'\r'); capture('tasks')
    os.write(master, b'\r'); capture('detail')
    os.write(master, b'h'); capture('history')
    os.write(master, b'\r'); capture('event')
    os.write(master, b'JKnpr')
    os.write(master, b'\x1b'); time.sleep(.1)
    os.write(master, b'q')
    capture('exit')
    child.wait(timeout=15)
    while select.select([master], [], [], .1)[0]: output.extend(os.read(master, 65536))
    assert child.returncode == 0, bytes(output)
    assert termios.tcgetattr(slave) == before, 'terminal flags not restored'
    assert b'\x1b[?1049h' in output and b'\x1b[?1049l' in output, 'alternate screen not restored'
    assert b'Workbench dashboard closed' in output
    print('PTY startup -> features -> tasks -> detail -> history -> event; scroll/page/back/quit; terminal flags and alternate screen restored')
finally:
    if child.poll() is None: child.kill()
    child.wait()
    os.close(master); os.close(slave)
"#;
        let mut command = Command::new("python3");
        command
            .args(["-c", script, env!("CARGO_BIN_EXE_meta-cortex")])
            .arg(self.directory.path())
            .env("META_CORTEX_HOME", self.data.path());
        match invocation {
            TerminalInvocation::Typed => {
                command
                    .current_dir(&self.project)
                    .args(["run", "--request"])
                    .arg(self.request(DashboardRequest {
                        mode: DashboardMode::Interactive,
                        view: DashboardView::Features,
                        page: PageIndex::FIRST,
                    })?);
            }
            TerminalInvocation::Direct { directory } => {
                command.current_dir(directory).arg("dashboard");
            }
        }
        let output = command.output()?;
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        for stage in ["features", "tasks", "detail", "history", "event"] {
            let bytes = fs::read(self.directory.path().join(stage))?;
            let mut parser = vt100::Parser::new(40, 120, 0);
            parser.process(&bytes);
            let screen = parser.screen().contents();
            let expected = match stage {
                "features" => "FEATURES",
                "tasks" => "TASKS",
                "detail" => "Recorded task objective",
                "history" => "HISTORY",
                "event" => "EVENT",
                _ => anyhow::bail!("unknown terminal stage"),
            };
            assert!(screen.contains(expected), "{stage}: {screen}");
            assert!(
                !screen.contains("NoteText("),
                "internal note wrapper rendered"
            );
        }
        eprintln!("{}", String::from_utf8_lossy(&output.stdout));
        Ok(())
    }
}
#[test]
#[cfg(unix)]
fn terminal_startup_navigation_exit_and_restoration() -> anyhow::Result<()> {
    Scenario::new()?.terminal(TerminalInvocation::Typed)
}
#[test]
#[cfg(unix)]
fn direct_dashboard_infers_repository_and_preserves_storage() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    let subdirectory = scenario.project.join("nested/inside");
    fs::create_dir_all(&subdirectory)?;
    let linked = scenario.linked_directory()?;
    let linked_subdirectory = linked.join("nested");
    fs::create_dir_all(&linked_subdirectory)?;
    let before = scenario.storage_snapshot()?;
    for directory in [scenario.project.clone(), subdirectory, linked_subdirectory] {
        scenario.terminal(TerminalInvocation::Direct {
            directory: directory.clone(),
        })?;
        assert_eq!(before, scenario.storage_snapshot()?);
        assert!(!scenario.directory.path().join("request.yaml").exists());
        eprintln!(
            "no-file meta-cortex dashboard from {}; identity/database/sidecars unchanged",
            directory.display()
        );
    }
    Ok(())
}
#[test]
fn dashboard_help_and_repository_errors_need_no_request_file() -> anyhow::Result<()> {
    let executable = env!("CARGO_BIN_EXE_meta-cortex");
    let help = Command::new(executable)
        .args(["dashboard", "--help"])
        .output()?;
    assert!(help.status.success());
    let text = String::from_utf8(help.stdout)?;
    assert!(text.contains("Usage: meta-cortex dashboard"));
    assert!(!text.contains("--request"));
    let outside = tempfile::tempdir()?;
    let data = outside.path().join("unused-data");
    let output = Command::new(executable)
        .arg("dashboard")
        .current_dir(outside.path())
        .env("META_CORTEX_HOME", &data)
        .output()?;
    assert_eq!(output.status.code(), Some(2));
    let response: Response = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
    let Outcome::Error(failure) = response.result else {
        anyhow::bail!("outside repository accepted");
    };
    assert!(failure.message.to_string().contains("Git operation failed"));
    assert!(!data.exists());
    let scenario = Scenario::new()?;
    fs::remove_file(&scenario.database)?;
    let output = Command::new(executable)
        .arg("dashboard")
        .current_dir(&scenario.project)
        .env("META_CORTEX_HOME", scenario.data.path())
        .output()?;
    assert_eq!(output.status.code(), Some(2));
    let response: Response = serde_saphyr::from_str(&String::from_utf8(output.stdout)?)?;
    let Outcome::Error(failure) = response.result else {
        anyhow::bail!("missing ledger accepted");
    };
    assert!(
        failure
            .message
            .to_string()
            .contains("has not been initialized")
    );
    assert!(!scenario.database.exists());
    Ok(())
}
