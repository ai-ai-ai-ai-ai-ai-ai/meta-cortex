use anyhow::{Context, bail};
use meta_cortex_workbench::versions::ProtocolVersion;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tempfile::{Builder, TempDir};

// This is the CLI's external YAML contract, decoded independently of its writer.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InfoDocument {
    schema_version: u32,
    cli_version: String,
    framework_version: String,
    paths: ReportPaths,
    integrations: Vec<ReportIntegration>,
    models: ReportModels,
    model_availability: ModelAvailability,
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
#[serde(tag = "name", content = "arguments")]
enum Operation {
    #[serde(rename = "framework.init")]
    Init(Initialization),
    #[serde(rename = "framework.info")]
    Info(EmptyArguments),
}
#[derive(Serialize)]
struct EmptyArguments {}
#[derive(Serialize)]
struct Initialization {
    harness: Harness,
    instructions: Instructions,
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
}
impl CliScenario {
    fn create() -> anyhow::Result<Self> {
        Ok(Self {
            project: Builder::new().prefix("project: # \"雪\" ").tempdir()?,
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
        match self.call(Operation::Init(initialization))? {
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
        match self.call(Operation::Info(EmptyArguments {}))? {
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
        scenario.call(Operation::Info(EmptyArguments {}))?,
        Outcome::Error(_)
    ));
    assert_eq!(fs::read_dir(scenario.project.path())?.count(), 0);
    scenario.initialize(Initialization {
        harness: Harness::Codex,
        instructions: Instructions::Write,
    })?;
    let root = scenario.project.path().canonicalize()?;
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
        harness: Harness::Codex,
        instructions: Instructions::Write,
    })?;
    let info = scenario.info()?;
    assert_eq!(info.schema_version, 3);
    assert_eq!(info.cli_version, env!("CARGO_PKG_VERSION"));
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
        scenario.call(Operation::Info(EmptyArguments {}))?,
        Outcome::Error(_)
    ));
    fs::write(&config, "broken = [")?;
    assert!(matches!(
        scenario.call(Operation::Info(EmptyArguments {}))?,
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
    }
    Ok(())
}

#[test]
fn incomplete_framework_is_reported_without_overwriting_files() -> anyhow::Result<()> {
    let scenario = CliScenario::create()?;
    let framework = scenario.project.path().join(".meta-cortex");
    fs::create_dir_all(framework.join("agents"))?;
    fs::write(framework.join("meta-cortex.toml"), "# Keep my settings\n")?;
    let Outcome::Error(error) = scenario.call(Operation::Init(Initialization {
        harness: Harness::None,
        instructions: Instructions::Skip,
    }))?
    else {
        bail!("expected incomplete framework failure")
    };
    assert!(error.message.contains("missing required framework entry:"));
    assert!(error.message.contains("back up and move"));
    assert!(error.message.contains("framework.init"));
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
    fs::remove_dir(scenario.project.path())?;
    let Outcome::Error(error) = scenario.call(Operation::Init(Initialization {
        harness: Harness::None,
        instructions: Instructions::Skip,
    }))?
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
