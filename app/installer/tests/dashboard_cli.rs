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
        let scenario = Self {
            directory,
            project,
            data,
        };
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let workbench = Workbench::discover(&scenario.project)?
                    .with_data_directory(scenario.data.clone());
                let mut ledger = workbench
                    .initialize(InitFeature {
                        feature: Self::feature()?,
                        objective: Note::from("Recorded feature objective".to_owned()),
                        branch: BranchName::try_from("codex/feature".to_owned())?,
                        worktree: scenario.project.clone(),
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
                Ok::<_, anyhow::Error>(())
            })?;
        Ok(scenario)
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
#[test]
#[cfg(unix)]
fn terminal_startup_navigation_exit_and_restoration() -> anyhow::Result<()> {
    let scenario = Scenario::new()?;
    let request = scenario.request(DashboardRequest {
        mode: DashboardMode::Interactive,
        view: DashboardView::Features,
        page: PageIndex::FIRST,
    })?;
    let script = r#"
import os, pty, subprocess, sys, termios, time, select, fcntl, struct
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
before = termios.tcgetattr(slave)
env = os.environ.copy(); env['TERM'] = 'xterm-256color'
child = subprocess.Popen([sys.argv[1], 'run', '--request', sys.argv[2]], stdin=slave, stdout=slave, stderr=slave, env=env)
try:
    output = bytearray()
    def capture(stage):
        deadline = time.monotonic() + 1.5
        while time.monotonic() < deadline:
            if select.select([master], [], [], .1)[0]: output.extend(os.read(master, 65536))
        with open(os.path.join(sys.argv[3], stage), 'wb') as file: file.write(output)
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
    let output = Command::new("python3")
        .args(["-c", script, env!("CARGO_BIN_EXE_meta-cortex")])
        .arg(request)
        .arg(scenario.directory.path())
        .env("META_CORTEX_HOME", scenario.data.path())
        .output()?;
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    for stage in ["features", "tasks", "detail", "history", "event"] {
        let bytes = fs::read(scenario.directory.path().join(stage))?;
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
