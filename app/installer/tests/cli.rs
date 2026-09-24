use anyhow::{Context, bail};
use meta_cortex_workbench::versions::ProtocolVersion;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::rc::Rc;
use tempfile::{Builder, TempDir};
use thiserror::Error;

// This is the CLI's external YAML contract, decoded independently of its writer.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InfoDocument {
    schema_version: ReportSchemaVersion,
    cli_version: ReportVersion,
    framework_version: ReportVersion,
    paths: ReportPaths,
    integrations: Vec<ReportIntegration>,
    models: ReportModels,
    model_availability: ModelAvailability,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(try_from = "u32")]
enum ReportSchemaVersion {
    V3,
}

#[derive(Debug, Error)]
enum ReportSchemaVersionError {
    #[error("unsupported report schema version")]
    Unsupported,
}

impl TryFrom<u32> for ReportSchemaVersion {
    type Error = ReportSchemaVersionError;

    fn try_from(version: u32) -> Result<Self, Self::Error> {
        match version {
            3 => Ok(Self::V3),
            _ => Err(ReportSchemaVersionError::Unsupported),
        }
    }
}

// Independent decoder for the established semantic-release strings in report schema 3.
#[derive(Debug, PartialEq, Eq, Deserialize)]
enum ReportVersion {
    #[serde(rename = "0.6.2")]
    V0_6_2,
    #[serde(rename = "0.7.0")]
    V0_7_0,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
enum Integration {
    Connected,
    Missing,
    Conflict,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
enum ReportHarness {
    Codex,
    Claude,
    Cursor,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportIntegration {
    harness: ReportHarness,
    path: PathBuf,
    status: Integration,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
enum ModelAvailability {
    NotChecked,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportPaths {
    project: PathBuf,
    framework: PathBuf,
    configuration: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportModels {
    #[serde(rename = "gizmo-prime")]
    gizmo_prime: ReportAgent,
    team: ReportTeam,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportTeam {
    gizmo: ReportAgent,
    agent: ReportAgent,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportAgent {
    model: String,
    reasoning_effort: String,
}

#[derive(Serialize)]
struct Request {
    version: ProtocolVersion,
    project: PathBuf,
    operation: Operation,
}
#[derive(Serialize)]
#[serde(tag = "group", content = "command")]
enum Operation {
    Framework(FrameworkOperation),
}
#[derive(Serialize)]
#[serde(tag = "name", content = "arguments")]
enum FrameworkOperation {
    Initialize(Initialization),
    Info(EmptyArguments),
}
#[derive(Serialize)]
struct EmptyArguments {}
#[derive(Serialize)]
struct Initialization {
    bun: ToolSetup,
    vale: ToolSetup,
    harness: Harness,
    instructions: Instructions,
}
#[derive(Clone, Copy, Serialize)]
enum ToolSetup {
    InstallMissing,
    RequireExisting,
}
#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
enum Harness {
    None,
    Codex,
}
#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
enum Instructions {
    Skip,
    Write,
}
#[derive(Deserialize)]
struct Response {
    version: ProtocolVersion,
    result: Outcome,
}
#[derive(Deserialize)]
#[serde(tag = "status", content = "data", rename_all = "snake_case")]
enum Outcome {
    Success(Reply),
    Error(Failure),
}
#[derive(Deserialize)]
struct Failure {
    message: String,
}
#[derive(Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
enum Reply {
    FrameworkInitialized { project: PathBuf },
    FrameworkInfo(Box<InfoDocument>),
}
struct CliScenario {
    project: TempDir,
    data: Rc<TempDir>,
}
impl CliScenario {
    fn create() -> anyhow::Result<Self> {
        let project = Builder::new().prefix("project: # \"雪\" ").tempdir()?;
        git2::Repository::init(project.path())?;
        Ok(Self {
            project,
            data: Rc::new(Builder::new().prefix("cortex data ").tempdir()?),
        })
    }
    fn call(&self, operation: Operation) -> anyhow::Result<Outcome> {
        let request = Request {
            version: ProtocolVersion::V1,
            project: self.project.path().to_owned(),
            operation,
        };
        let mut child = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .args(["run", "--request", "-"])
            .env("META_CORTEX_HOME", self.data.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        child
            .stdin
            .take()
            .context("stdin")?
            .write_all(serde_saphyr::to_string(&request)?.as_bytes())?;
        let output = child.wait_with_output()?;
        assert!(
            output.stderr.is_empty(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let response: Response = serde_saphyr::from_slice(&output.stdout)?;
        assert_eq!(response.version, ProtocolVersion::V1);
        match &response.result {
            Outcome::Success(_) => assert_eq!(output.status.code(), Some(0)),
            Outcome::Error(_) => assert_eq!(output.status.code(), Some(2)),
        }
        Ok(response.result)
    }
    fn initialize(&self, initialization: Initialization) -> anyhow::Result<()> {
        match self.call(Operation::Framework(FrameworkOperation::Initialize(
            initialization,
        )))? {
            Outcome::Success(reply) => match reply {
                Reply::FrameworkInitialized { project } => {
                    assert_eq!(project, self.project.path().canonicalize()?)
                }
                Reply::FrameworkInfo(_) => bail!("expected installation"),
            },
            Outcome::Error(error) => bail!("{}", error.message),
        }
        Ok(())
    }
    fn info(&self) -> anyhow::Result<InfoDocument> {
        match self.call(Operation::Framework(FrameworkOperation::Info(
            EmptyArguments {},
        )))? {
            Outcome::Success(reply) => match reply {
                Reply::FrameworkInfo(info) => Ok(*info),
                Reply::FrameworkInitialized { .. } => bail!("expected information"),
            },
            Outcome::Error(error) => bail!("{}", error.message),
        }
    }
}

#[test]
fn yaml_initialization_preserves_settings_and_reports_project() -> anyhow::Result<()> {
    let scenario = CliScenario::create()?;
    assert!(matches!(
        scenario.call(Operation::Framework(FrameworkOperation::Info(
            EmptyArguments {}
        )))?,
        Outcome::Error(_)
    ));
    assert_eq!(fs::read_dir(scenario.project.path())?.count(), 1);
    scenario.initialize(Initialization {
        bun: ToolSetup::InstallMissing,
        vale: ToolSetup::InstallMissing,
        harness: Harness::Codex,
        instructions: Instructions::Write,
    })?;
    let root = scenario.project.path().canonicalize()?;
    assert!(
        root.join(".meta-cortex/node_modules/effect/AGENTS.md")
            .is_file()
    );
    assert!(!root.join(".agents").exists());
    let config = root.join(".meta-cortex/meta-cortex.toml");
    let customized = format!(
        "# Keep settings\n{}",
        fs::read_to_string(&config)?.replace(
            "[team.agent]\nmodel = \"gpt-6-luna\"\nreasoning_effort = \"max\"",
            "[team.agent]\nmodel = \"gpt-5.6-sol\"\nreasoning_effort = \"high\""
        )
    );
    fs::write(&config, &customized)?;
    let guidance = fs::read(root.join("AGENTS.md"))?;
    scenario.initialize(Initialization {
        bun: ToolSetup::InstallMissing,
        vale: ToolSetup::InstallMissing,
        harness: Harness::Codex,
        instructions: Instructions::Write,
    })?;
    let info = scenario.info()?;
    assert_eq!(info.schema_version, ReportSchemaVersion::V3);
    assert_eq!(info.cli_version, ReportVersion::V0_7_0);
    assert_eq!(
        fs::read_to_string(root.join(".meta-cortex/.version"))?,
        env!("CARGO_PKG_VERSION")
    );
    assert_eq!(info.framework_version, info.cli_version);
    assert_eq!(info.paths.project, root);
    assert_eq!(info.paths.framework, root.join(".meta-cortex"));
    assert_eq!(info.paths.configuration, config);
    assert_eq!(info.integrations.len(), 3);
    let codex = info
        .integrations
        .iter()
        .find(|item| item.harness == ReportHarness::Codex)
        .context("Codex")?;
    assert_eq!(codex.status, Integration::Connected);
    assert_eq!(codex.path, root.join("AGENTS.md"));
    assert_eq!(info.model_availability, ModelAvailability::NotChecked);
    assert_eq!(info.models.team.gizmo, info.models.gizmo_prime);
    assert_eq!(info.models.team.agent.model, "gpt-5.6-sol");
    assert_eq!(info.models.team.agent.reasoning_effort, "high");
    assert_eq!(fs::read_to_string(&config)?, customized);
    assert_eq!(fs::read(root.join("AGENTS.md"))?, guidance);
    fs::remove_file(root.join(".meta-cortex/.version"))?;
    assert!(matches!(
        scenario.call(Operation::Framework(FrameworkOperation::Info(
            EmptyArguments {}
        )))?,
        Outcome::Error(_)
    ));
    fs::write(&config, "broken = [")?;
    assert!(matches!(
        scenario.call(Operation::Framework(FrameworkOperation::Info(
            EmptyArguments {}
        )))?,
        Outcome::Error(_)
    ));
    Ok(())
}

#[test]
fn yaml_initialization_defaults_are_unattended_and_preserve_guidance() -> anyhow::Result<()> {
    let scenario = CliScenario::create()?;
    let guidance = scenario.project.path().join("AGENTS.md");
    fs::write(&guidance, "# Existing instructions\n")?;
    for _ in 0..2 {
        scenario.initialize(Initialization {
            bun: ToolSetup::InstallMissing,
            vale: ToolSetup::InstallMissing,
            harness: Harness::None,
            instructions: Instructions::Skip,
        })?;
        let actual: ReportModels = toml::from_str(&fs::read_to_string(
            scenario
                .project
                .path()
                .join(".meta-cortex/meta-cortex.toml"),
        )?)?;
        let expected: ReportModels =
            toml::from_str(include_str!("../../../cortex/meta-cortex.toml"))?;
        assert_eq!(actual, expected);
        assert_eq!(fs::read_to_string(&guidance)?, "# Existing instructions\n");
        assert!(!scenario.project.path().join(".agents").exists());
        assert!(
            scenario
                .project
                .path()
                .join(".meta-cortex/node_modules/effect/AGENTS.md")
                .is_file()
        );
    }
    Ok(())
}

#[test]
fn missing_bun_fails_before_any_project_writes_and_can_be_retried() -> anyhow::Result<()> {
    let scenario = CliScenario::create()?;
    let request = Request {
        version: ProtocolVersion::V1,
        project: scenario.project.path().to_owned(),
        operation: Operation::Framework(FrameworkOperation::Initialize(Initialization {
            bun: ToolSetup::RequireExisting,
            vale: ToolSetup::RequireExisting,
            harness: Harness::Codex,
            instructions: Instructions::Write,
        })),
    };
    let mut child = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
        .args(["run", "--request", "-"])
        .env("META_CORTEX_HOME", scenario.data.path())
        .env("PATH", scenario.project.path())
        .env("BUN_INSTALL", scenario.project.path().join("bun"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    child
        .stdin
        .take()
        .context("stdin")?
        .write_all(serde_saphyr::to_string(&request)?.as_bytes())?;
    let output = child.wait_with_output()?;
    assert_eq!(output.status.code(), Some(2));
    assert!(output.stderr.is_empty());
    let response: Response = serde_saphyr::from_slice(&output.stdout)?;
    let Outcome::Error(error) = response.result else {
        bail!("expected missing Bun failure")
    };
    assert!(error.message.contains("install Bun"));
    assert_eq!(fs::read_dir(scenario.project.path())?.count(), 1);
    assert!(!scenario.project.path().join("AGENTS.md").exists());
    assert!(!scenario.project.path().join(".agents").exists());
    scenario.initialize(Initialization {
        bun: ToolSetup::InstallMissing,
        vale: ToolSetup::InstallMissing,
        harness: Harness::Codex,
        instructions: Instructions::Write,
    })?;
    assert!(
        scenario
            .project
            .path()
            .join(".meta-cortex/node_modules/effect/AGENTS.md")
            .is_file()
    );
    assert!(scenario.project.path().join("AGENTS.md").is_file());
    Ok(())
}

#[derive(Deserialize)]
struct ToolConfiguration {
    tools: ToolVersions,
}

#[derive(Deserialize)]
struct ToolVersions {
    bun: String,
    vale: String,
}

struct ToolScenario {
    cli: CliScenario,
    tools: TempDir,
    global_installation: TempDir,
    executable: PathBuf,
}

impl ToolScenario {
    fn create() -> anyhow::Result<Self> {
        let tools = Builder::new().prefix("bun tools ").tempdir()?;
        let output = Command::new("bun")
            .args(["-p", "process.execPath"])
            .output()?;
        assert!(output.status.success());
        let scenario = Self {
            cli: CliScenario::create()?,
            tools,
            global_installation: Builder::new().prefix("unused global bun ").tempdir()?,
            executable: PathBuf::from(String::from_utf8(output.stdout)?.trim()),
        };
        symlink("/bin/bash", scenario.tools.path().join("bash"))?;
        fs::write(
            scenario.tools.path().join("curl"),
            r#"#!/bin/sh
test "$6" = "--output" || exit 91
case "$5" in
  https://bun.com/install)
    printf 'downloaded' > "$CORTEX_TEST_DOWNLOAD"
    exec /bin/cp "$CORTEX_TEST_INSTALLER" "$7" ;;
  https://github.com/vale-cli/vale/releases/download/v"$CORTEX_TEST_VALE_RELEASE"/vale_"$CORTEX_TEST_VALE_RELEASE"_*.tar.gz)
    printf 'downloaded' > "$CORTEX_TEST_VALE_DOWNLOAD"
    exec /bin/cp "$CORTEX_TEST_VALE_ARCHIVE" "$7" ;;
  *) exit 90 ;;
esac
"#,
        )?;
        fs::set_permissions(
            scenario.tools.path().join("curl"),
            fs::Permissions::from_mode(0o755),
        )?;
        fs::write(
            scenario.tools.path().join("installer.sh"),
            r#"test "$1" = "$CORTEX_TEST_BUN_RELEASE" || exit 92
test "$SHELL" = "/bin/sh" || exit 93
/bin/mkdir -p "$BUN_INSTALL/bin"
/bin/ln -s "$CORTEX_TEST_BUN" "$BUN_INSTALL/bin/bun"
printf 'installer stdout'
printf 'installer stderr' >&2
"#,
        )?;
        symlink("/usr/bin/tar", scenario.tools.path().join("tar"))?;
        // GNU tar launches gzip through PATH; BSD tar handles it internally.
        symlink("/usr/bin/gzip", scenario.tools.path().join("gzip"))?;
        let vale = scenario.tools.path().join("vale-fixture");
        fs::create_dir(&vale)?;
        fs::write(vale.join("vale"), "#!/bin/sh\nprintf 'vale fixture\\n'\n")?;
        fs::set_permissions(vale.join("vale"), fs::Permissions::from_mode(0o755))?;
        let archived = Command::new("tar")
            .arg("-czf")
            .arg(scenario.tools.path().join("vale.tar.gz"))
            .arg("-C")
            .arg(vale)
            .arg("vale")
            .status()?;
        assert!(archived.success());
        Ok(scenario)
    }

    fn call(&self, setup: ToolSetup) -> anyhow::Result<Outcome> {
        let configuration: ToolConfiguration =
            toml::from_str(include_str!("../../../cortex/mise.toml"))?;
        let request = Request {
            version: ProtocolVersion::V1,
            project: self.cli.project.path().to_owned(),
            operation: Operation::Framework(FrameworkOperation::Initialize(Initialization {
                bun: setup,
                vale: setup,
                harness: Harness::Codex,
                instructions: Instructions::Write,
            })),
        };
        let mut child = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .args(["run", "--request", "-"])
            .env("META_CORTEX_HOME", self.cli.data.path())
            .env("PATH", self.tools.path())
            .env("BUN_INSTALL", self.global_installation.path())
            .env("CORTEX_TEST_BUN", &self.executable)
            .env(
                "CORTEX_TEST_BUN_RELEASE",
                format!("bun-v{}", configuration.tools.bun),
            )
            .env("CORTEX_TEST_VALE_RELEASE", configuration.tools.vale)
            .env(
                "CORTEX_TEST_INSTALLER",
                self.tools.path().join("installer.sh"),
            )
            .env("CORTEX_TEST_DOWNLOAD", self.tools.path().join("downloaded"))
            .env(
                "CORTEX_TEST_VALE_DOWNLOAD",
                self.tools.path().join("vale-downloaded"),
            )
            .env(
                "CORTEX_TEST_VALE_ARCHIVE",
                self.tools.path().join("vale.tar.gz"),
            )
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        child
            .stdin
            .take()
            .context("stdin")?
            .write_all(serde_saphyr::to_string(&request)?.as_bytes())?;
        let output = child.wait_with_output()?;
        assert!(
            output.stderr.is_empty(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let response: Response = serde_saphyr::from_slice(&output.stdout)?;
        match &response.result {
            Outcome::Success(_) => assert_eq!(output.status.code(), Some(0)),
            Outcome::Error(_) => assert_eq!(output.status.code(), Some(2)),
        }
        Ok(response.result)
    }
}

#[test]
fn installs_missing_tools_once_and_shares_identity_when_worktree_initializes_first()
-> anyhow::Result<()> {
    let scenario = ToolScenario::create()?;
    let repository = git2::Repository::open(scenario.cli.project.path())?;
    let signature = git2::Signature::now("Bun Test", "bun@example.invalid")?;
    let tree_id = repository.index()?.write_tree()?;
    let tree = repository.find_tree(tree_id)?;
    let commit_id =
        repository.commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])?;
    let commit = repository.find_commit(commit_id)?;
    let branch = repository.branch("codex/bun-test", &commit, false)?;
    let mut options = git2::WorktreeAddOptions::new();
    options.reference(Some(branch.get()));
    let worktree = Builder::new().prefix("bun linked worktree ").tempdir()?;
    fs::remove_dir(worktree.path())?;
    repository.worktree("bun-test", worktree.path(), Some(&options))?;
    let main = scenario.cli;
    let worker = ToolScenario {
        cli: CliScenario {
            project: worktree,
            data: main.data.clone(),
        },
        ..scenario
    };
    assert!(matches!(
        worker.call(ToolSetup::InstallMissing)?,
        Outcome::Success(_)
    ));
    assert!(worker.tools.path().join("downloaded").is_file());
    assert!(worker.tools.path().join("vale-downloaded").is_file());
    assert!(worker.cli.data.path().join("vale/bin/vale").is_file());
    assert!(worker.cli.data.path().join("bun/bin/bun").is_file());
    assert_eq!(fs::read_dir(worker.global_installation.path())?.count(), 0);
    assert!(
        worker
            .cli
            .project
            .path()
            .join(".meta-cortex/node_modules/effect/AGENTS.md")
            .is_file()
    );
    assert!(
        !worker
            .cli
            .project
            .path()
            .join(".meta-cortex/repository-id")
            .exists()
    );
    let identity_path = main.project.path().join(".meta-cortex/repository-id");
    let identity = fs::read_to_string(&identity_path)?;
    assert_eq!(
        fs::read_dir(main.project.path().join(".meta-cortex"))?.count(),
        1
    );
    assert!(
        main.data
            .path()
            .join(identity.trim())
            .join("features")
            .is_dir()
    );
    assert!(!main.project.path().join(".git/meta-cortex").exists());
    fs::remove_file(worker.tools.path().join("downloaded"))?;
    fs::remove_file(worker.tools.path().join("vale-downloaded"))?;

    let worktree = worker.cli;
    let scenario = ToolScenario {
        cli: main,
        ..worker
    };
    for _ in 0..2 {
        assert!(matches!(
            scenario.call(ToolSetup::RequireExisting)?,
            Outcome::Success(_)
        ));
        assert_eq!(fs::read_to_string(&identity_path)?, identity);
    }
    assert!(!scenario.tools.path().join("downloaded").exists());
    assert!(!scenario.tools.path().join("vale-downloaded").exists());
    assert_eq!(fs::read_dir(scenario.cli.data.path())?.count(), 3);
    assert!(
        scenario
            .cli
            .project
            .path()
            .join(".meta-cortex/node_modules/effect/AGENTS.md")
            .is_file()
    );
    let worker = ToolScenario {
        cli: worktree,
        ..scenario
    };
    assert!(matches!(
        worker.call(ToolSetup::RequireExisting)?,
        Outcome::Success(_)
    ));
    assert_eq!(fs::read_to_string(identity_path)?, identity);
    assert!(!worker.cli.project.path().join(".meta-cortex/bun").exists());
    Ok(())
}

#[test]
fn initialization_requires_git_before_installing_anything() -> anyhow::Result<()> {
    let scenario = ToolScenario::create()?;
    fs::remove_dir_all(scenario.cli.project.path().join(".git"))?;
    let Outcome::Error(error) = scenario.call(ToolSetup::InstallMissing)? else {
        bail!("expected missing Git repository failure")
    };
    assert!(error.message.contains("requires a Git repository"));
    assert!(!scenario.tools.path().join("downloaded").exists());
    assert_eq!(fs::read_dir(scenario.cli.project.path())?.count(), 0);
    Ok(())
}

#[test]
fn bun_setup_failures_leave_framework_and_instructions_untouched() -> anyhow::Result<()> {
    for failing_step in ["curl", "installer.sh"] {
        let scenario = ToolScenario::create()?;
        fs::write(
            scenario.tools.path().join(failing_step),
            "#!/bin/sh\nprintf 'installation failed' >&2\nexit 7\n",
        )?;
        let Outcome::Error(error) = scenario.call(ToolSetup::InstallMissing)? else {
            bail!("expected Bun setup failure")
        };
        assert!(error.message.contains("installation failed"));
        assert_eq!(fs::read_dir(scenario.cli.project.path())?.count(), 1);
        assert_eq!(
            fs::read_dir(scenario.global_installation.path())?.count(),
            0
        );
    }
    Ok(())
}

#[test]
fn a_broken_existing_bun_is_reported_without_reinstalling() -> anyhow::Result<()> {
    let scenario = ToolScenario::create()?;
    let executable = scenario.tools.path().join("bun");
    fs::write(&executable, "#!/bin/sh\nprintf 'broken Bun' >&2\nexit 12\n")?;
    fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))?;
    let Outcome::Error(error) = scenario.call(ToolSetup::InstallMissing)? else {
        bail!("expected broken Bun failure")
    };
    assert!(error.message.contains("broken Bun"));
    assert!(!scenario.tools.path().join("downloaded").exists());
    assert_eq!(fs::read_dir(scenario.cli.project.path())?.count(), 1);
    Ok(())
}

#[test]
fn missing_vale_requires_existing_tools_before_writing_project_files() -> anyhow::Result<()> {
    let scenario = ToolScenario::create()?;
    symlink(&scenario.executable, scenario.tools.path().join("bun"))?;
    let Outcome::Error(error) = scenario.call(ToolSetup::RequireExisting)? else {
        bail!("expected missing Vale failure")
    };
    assert!(error.message.contains("install Vale"));
    assert_eq!(fs::read_dir(scenario.cli.project.path())?.count(), 1);
    assert!(!scenario.tools.path().join("vale-downloaded").exists());
    Ok(())
}

#[test]
fn a_broken_existing_vale_is_reported_without_reinstalling() -> anyhow::Result<()> {
    let scenario = ToolScenario::create()?;
    symlink(&scenario.executable, scenario.tools.path().join("bun"))?;
    let executable = scenario.tools.path().join("vale");
    fs::write(
        &executable,
        "#!/bin/sh\nprintf 'broken Vale' >&2\nexit 12\n",
    )?;
    fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))?;
    let Outcome::Error(error) = scenario.call(ToolSetup::InstallMissing)? else {
        bail!("expected broken Vale failure")
    };
    assert!(error.message.contains("broken Vale"));
    assert!(!scenario.tools.path().join("vale-downloaded").exists());
    assert_eq!(fs::read_dir(scenario.cli.project.path())?.count(), 1);
    Ok(())
}

#[test]
fn invalid_vale_archive_fails_before_project_writes_and_can_be_retried() -> anyhow::Result<()> {
    let scenario = ToolScenario::create()?;
    symlink(&scenario.executable, scenario.tools.path().join("bun"))?;
    let archive = scenario.tools.path().join("vale.tar.gz");
    let valid = fs::read(&archive)?;
    fs::write(&archive, "invalid archive")?;
    let Outcome::Error(error) = scenario.call(ToolSetup::InstallMissing)? else {
        bail!("expected Vale extraction failure")
    };
    assert!(error.message.contains("Vale"));
    assert!(error.message.contains("tar failed"));
    assert_eq!(fs::read_dir(scenario.cli.project.path())?.count(), 1);
    fs::write(archive, valid)?;
    assert!(matches!(
        scenario.call(ToolSetup::InstallMissing)?,
        Outcome::Success(_)
    ));
    assert!(scenario.cli.data.path().join("vale/bin/vale").is_file());
    Ok(())
}

#[test]
fn incomplete_framework_is_reported_without_overwriting_files() -> anyhow::Result<()> {
    let scenario = CliScenario::create()?;
    let framework = scenario.project.path().join(".meta-cortex");
    fs::create_dir_all(framework.join("agents"))?;
    fs::write(framework.join("meta-cortex.toml"), "# Keep my settings\n")?;
    let Outcome::Error(error) = scenario.call(Operation::Framework(
        FrameworkOperation::Initialize(Initialization {
            bun: ToolSetup::InstallMissing,
            vale: ToolSetup::InstallMissing,
            harness: Harness::None,
            instructions: Instructions::Skip,
        }),
    ))?
    else {
        bail!("expected incomplete framework failure")
    };
    assert!(error.message.contains("missing required framework entry:"));
    assert!(error.message.contains("back up and move"));
    assert!(error.message.contains("Framework / Initialize"));
    assert_eq!(fs::read_dir(&framework)?.count(), 2);
    assert_eq!(
        fs::read_to_string(framework.join("meta-cortex.toml"))?,
        "# Keep my settings\n"
    );
    Ok(())
}

#[test]
fn cli_exposes_only_discovery_and_yaml_execution() -> anyhow::Result<()> {
    let executable = env!("CARGO_BIN_EXE_meta-cortex");
    let help = Command::new(executable).arg("--help").output()?;
    assert!(help.status.success());
    let text = String::from_utf8(help.stdout)?;
    assert!(text.contains("list"));
    assert!(text.contains("run"));
    let scenario = CliScenario::create()?;
    fs::remove_dir_all(scenario.project.path())?;
    let Outcome::Error(error) = scenario.call(Operation::Framework(
        FrameworkOperation::Initialize(Initialization {
            bun: ToolSetup::InstallMissing,
            vale: ToolSetup::InstallMissing,
            harness: Harness::None,
            instructions: Instructions::Skip,
        }),
    ))?
    else {
        bail!("expected missing project error")
    };
    assert!(error.message.contains("existing project directory"));
    assert!(!scenario.project.path().exists());

    for arguments in [
        vec!["init"],
        vec!["info"],
        vec!["run", "--interactive"],
        vec!["run", "--non-interactive"],
    ] {
        let output = Command::new(executable).args(arguments).output()?;
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stdout.is_empty());
    }
    Ok(())
}

#[test]
fn report_consumer_rejects_undeclared_or_malformed_versions() {
    for input in ["0", "1", "2", "4", "-1", "3.5", "\"4\"", "null"] {
        assert!(
            serde_saphyr::from_str::<ReportSchemaVersion>(input).is_err(),
            "{input}"
        );
    }
    for input in [
        "arbitrary",
        "0.0.1",
        "0.6.3",
        "0.6.2-beta.1",
        "v0.6.2",
        "6",
        "null",
    ] {
        assert!(
            serde_saphyr::from_str::<ReportVersion>(input).is_err(),
            "{input}"
        );
    }
}
