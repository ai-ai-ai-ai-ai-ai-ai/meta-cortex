use rexpect::{error::Error as TerminalError, session};
use serde::Deserialize;
use std::path::PathBuf;
use std::process::Command;
use std::{fs, io};
use tempfile::{Builder, TempDir};
use thiserror::Error;

// This is the CLI's external YAML contract, decoded independently of its writer.
#[derive(Debug, Error)]
enum InfoCheckError {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error(transparent)]
    Yaml(#[from] serde_saphyr::DeserializeError),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InfoDocument {
    schema_version: u32,
    cli_version: String,
    framework_version: ReportVersion,
    paths: ReportPaths,
    integrations: Vec<ReportIntegration>,
    models: ReportModels,
    model_availability: ModelAvailability,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(tag = "status", content = "value")]
enum ReportVersion {
    Recorded(String),
    Legacy,
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

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportModels {
    #[serde(rename = "gizmo-prime")]
    gizmo_prime: ReportAgent,
    team: ReportTeam,
}

#[derive(Deserialize)]
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

struct CliScenario {
    project: TempDir,
}

#[test]
fn init_explains_incomplete_framework_and_preserves_existing_files() -> io::Result<()> {
    let scenario = CliScenario::create()?;
    let framework = scenario.project.path().join(".meta-cortex");
    fs::create_dir_all(framework.join("agents"))?;
    fs::write(framework.join("meta-cortex.toml"), "# Keep my settings\n")?;
    let result = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
        .arg("init")
        .current_dir(scenario.project.path())
        .output()?;
    assert!(!result.status.success());
    assert!(result.stdout.is_empty());
    let message = String::from_utf8_lossy(&result.stderr);
    assert!(
        message.contains("missing required framework entry:"),
        "{message}"
    );
    assert!(message.contains(".meta-cortex/"), "{message}");
    assert!(message.contains("back up and move"), "{message}");
    assert!(message.contains("run meta-cortex init again"), "{message}");
    assert_eq!(fs::read_dir(&framework)?.count(), 2);
    assert_eq!(
        fs::read_to_string(framework.join("meta-cortex.toml"))?,
        "# Keep my settings\n"
    );
    assert!(!scenario.project.path().join("AGENTS.md").exists());
    Ok(())
}

impl CliScenario {
    fn create() -> io::Result<Self> {
        Ok(Self {
            project: Builder::new().prefix("project: # \"雪\" ").tempdir()?,
        })
    }

    fn verifies_info_and_preserved_choices(self) -> Result<(), InfoCheckError> {
        let executable = env!("CARGO_BIN_EXE_meta-cortex");
        let missing = Command::new(executable)
            .arg("info")
            .arg(self.project.path())
            .output()?;
        assert!(!missing.status.success());
        assert!(missing.stdout.is_empty());
        assert!(String::from_utf8_lossy(&missing.stderr).contains("not initialized"));
        assert_eq!(fs::read_dir(self.project.path())?.count(), 0);

        let installed = Command::new(executable)
            .args([
                "init",
                "--non-interactive",
                "--harness",
                "codex",
                "--instructions",
                "write",
            ])
            .arg(self.project.path())
            .output()?;
        assert!(
            installed.status.success(),
            "{}",
            String::from_utf8_lossy(&installed.stderr)
        );
        let config_path = self.project.path().join(".meta-cortex/meta-cortex.toml");
        let customized = format!(
            "# Keep my choices and comments\n{}",
            fs::read_to_string(&config_path)?.replace("gpt-5.6-terra", "gpt-5.6-sol")
        );
        fs::write(&config_path, &customized)?;
        // Explicit integration choices keep unattended reinitialization noninteractive.
        let repeated = Command::new(executable)
            .args([
                "init",
                "--non-interactive",
                "--harness",
                "codex",
                "--instructions",
                "write",
            ])
            .arg(self.project.path())
            .output()?;
        assert!(
            repeated.status.success(),
            "{}",
            String::from_utf8_lossy(&repeated.stderr)
        );
        assert_eq!(fs::read_to_string(&config_path)?, customized);
        let agents_path = self.project.path().join("AGENTS.md");
        let agents = fs::read(&agents_path)?;
        let info = Command::new(executable)
            .arg("info")
            .current_dir(self.project.path())
            .output()?;
        assert!(
            info.status.success(),
            "{}",
            String::from_utf8_lossy(&info.stderr)
        );
        assert!(info.stderr.is_empty());
        let output: InfoDocument = serde_saphyr::from_slice(&info.stdout)?;
        assert_eq!(output.schema_version, 2);
        assert_eq!(output.cli_version, env!("CARGO_PKG_VERSION"));
        assert_eq!(
            output.framework_version,
            ReportVersion::Recorded(env!("CARGO_PKG_VERSION").to_owned())
        );
        assert_eq!(output.integrations.len(), 3);
        let codex = output
            .integrations
            .iter()
            .find(|item| item.harness == ReportHarness::Codex)
            .ok_or_else(|| io::Error::other("Codex integration is missing"))?;
        assert_eq!(codex.status, Integration::Connected);
        assert_eq!(output.model_availability, ModelAvailability::NotChecked);
        assert_eq!(
            output.models.gizmo_prime,
            ReportAgent {
                model: "gpt-5.6-sol".to_owned(),
                reasoning_effort: "low".to_owned()
            }
        );
        assert_eq!(output.models.team.gizmo, output.models.gizmo_prime);
        assert_eq!(
            output.models.team.agent,
            ReportAgent {
                model: "gpt-5.6-luna".to_owned(),
                reasoning_effort: "xhigh".to_owned()
            }
        );
        let root = self.project.path().canonicalize()?;
        assert_eq!(output.paths.project, root);
        assert_eq!(output.paths.framework, root.join(".meta-cortex"));
        assert_eq!(
            output.paths.configuration,
            root.join(".meta-cortex/meta-cortex.toml")
        );
        assert_eq!(codex.path, root.join("AGENTS.md"));
        assert_eq!(fs::read(&agents_path)?, agents);
        assert_eq!(fs::read_to_string(&config_path)?, customized);

        fs::remove_file(self.project.path().join(".meta-cortex/.version"))?;
        fs::remove_file(&agents_path)?;
        let legacy = Command::new(executable)
            .arg("info")
            .arg(self.project.path())
            .output()?;
        assert!(legacy.status.success());
        let output: InfoDocument = serde_saphyr::from_slice(&legacy.stdout)?;
        assert_eq!(output.framework_version, ReportVersion::Legacy);
        assert!(
            output
                .integrations
                .iter()
                .all(|item| item.status == Integration::Missing)
        );
        assert!(!agents_path.exists());
        fs::write(&config_path, "broken = [")?;
        let invalid = Command::new(executable)
            .arg("info")
            .arg(self.project.path())
            .output()?;
        assert!(!invalid.status.success());
        assert!(invalid.stdout.is_empty());
        assert!(String::from_utf8_lossy(&invalid.stderr).contains("invalid meta-cortex.toml"));
        Ok(())
    }

    fn requires_explicit_noninteractive_mode(self) -> io::Result<()> {
        let result = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
            .arg("init")
            .arg(self.project.path())
            .output()?;
        assert!(!result.status.success());
        assert!(String::from_utf8_lossy(&result.stderr).contains("--non-interactive"));
        assert_eq!(fs::read_dir(self.project.path())?.count(), 0);
        Ok(())
    }

    fn selects_models_in_terminal(self) -> Result<(), TerminalError> {
        let mut command = Command::new(env!("CARGO_BIN_EXE_meta-cortex"));
        command
            .arg("init")
            .arg(self.project.path())
            .env("TERM", "xterm");
        let mut terminal = session::spawn_command(command, Some(10_000))?;
        terminal.exp_string("Harness")?;
        terminal.send_line("j")?;
        terminal.exp_string("instructions")?;
        terminal.send_line("y")?;
        terminal.exp_string("Gizmo Prime model")?;
        terminal.send_line("j")?; // Terra -> Sol.
        terminal.exp_string("Gizmo Prime reasoning effort")?;
        terminal.send_line("jj")?; // Low -> High.
        terminal.exp_string("Team Gizmo model")?;
        terminal.send_line("jj")?; // Terra -> Astra.
        terminal.exp_string("Team Gizmo reasoning effort")?;
        terminal.send_line("k")?; // Low -> Ultra (wrap).
        terminal.exp_string("Team agents model")?;
        terminal.send_line("")?; // Luna.
        terminal.exp_string("Team agents reasoning effort")?;
        terminal.send_line("j")?; // Xhigh -> Max.
        terminal.exp_string("Meta-Cortex is ready")?;
        terminal.exp_eof()?;
        let config = fs::read_to_string(self.project.path().join(".meta-cortex/meta-cortex.toml"))?;
        assert!(
            config.contains("[gizmo-prime]\nmodel = \"gpt-5.6-sol\"\nreasoning_effort = \"high\"")
        );
        assert!(
            config.contains("[team.gizmo]\nmodel = \"gpt-6-astra\"\nreasoning_effort = \"ultra\"")
        );
        assert!(
            config.contains("[team.agent]\nmodel = \"gpt-5.6-luna\"\nreasoning_effort = \"max\"")
        );
        Ok(())
    }

    fn cancels_without_writes(self) -> Result<(), TerminalError> {
        fs::write(self.project.path().join("AGENTS.md"), "# My instructions\n")?;
        let mut command = Command::new(env!("CARGO_BIN_EXE_meta-cortex"));
        command
            .arg("init")
            .arg(self.project.path())
            .env("TERM", "xterm");
        let mut terminal = session::spawn_command(command, Some(10_000))?;
        terminal.exp_string("Harness")?;
        terminal.send_line("j")?;
        terminal.exp_string("instructions")?;
        terminal.send_line("y")?;
        terminal.exp_string("Gizmo Prime model")?;
        terminal.send_line("")?;
        terminal.exp_string("Gizmo Prime reasoning effort")?;
        terminal.send_line("q")?;
        terminal.exp_string("initialization cancelled")?;
        terminal.exp_eof()?;
        assert!(!self.project.path().join(".meta-cortex").exists());
        assert_eq!(
            fs::read_to_string(self.project.path().join("AGENTS.md"))?,
            "# My instructions\n"
        );
        Ok(())
    }

    fn declines_instructions(self) -> Result<(), TerminalError> {
        for existing in [false, true] {
            let path = self.project.path().join("CLAUDE.md");
            if existing {
                fs::write(&path, "# Existing guidance\n")?;
            }
            let mut command = Command::new(env!("CARGO_BIN_EXE_meta-cortex"));
            command
                .arg("init")
                .arg(self.project.path())
                .env("TERM", "xterm");
            let mut terminal = session::spawn_command(command, Some(10_000))?;
            terminal.exp_string("Harness")?;
            terminal.send_line("jj")?;
            terminal.exp_string(if existing {
                "Add Meta-Cortex instructions to CLAUDE.md"
            } else {
                "Create CLAUDE.md"
            })?;
            terminal.send_line("n")?;
            if !existing {
                for role in ["Gizmo Prime", "Team Gizmo", "Team agents"] {
                    terminal.exp_string(&format!("{role} model"))?;
                    terminal.send_line("")?;
                    terminal.exp_string(&format!("{role} reasoning effort"))?;
                    terminal.send_line("")?;
                }
            }
            terminal.exp_string("Meta-Cortex is ready")?;
            terminal.exp_eof()?;
            assert!(self.project.path().join(".meta-cortex").is_dir());
            if existing {
                assert_eq!(fs::read_to_string(path)?, "# Existing guidance\n");
            } else {
                assert!(!path.exists());
            }
        }
        Ok(())
    }

    fn checks_unattended_choices(self) -> io::Result<()> {
        for choices in [vec![], vec!["--harness", "claude"]] {
            let result = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
                .args(["init", "--non-interactive"])
                .args(choices)
                .arg(self.project.path())
                .output()?;
            assert!(!result.status.success());
            assert_eq!(fs::read_dir(self.project.path())?.count(), 0);
        }
        for choices in [
            vec!["--harness", "none"],
            vec!["--harness", "cursor", "--instructions", "skip"],
        ] {
            let result = Command::new(env!("CARGO_BIN_EXE_meta-cortex"))
                .args(["init", "--non-interactive"])
                .args(choices)
                .arg(self.project.path())
                .output()?;
            assert!(
                result.status.success(),
                "{}",
                String::from_utf8_lossy(&result.stderr)
            );
            assert_eq!(fs::read_dir(self.project.path())?.count(), 1);
        }
        Ok(())
    }

    fn exercises_public_commands(self) -> io::Result<()> {
        let executable = env!("CARGO_BIN_EXE_meta-cortex");
        let help = Command::new(executable).arg("--help").output()?;
        assert!(help.status.success());
        for _ in 0..2 {
            let installed = Command::new(executable)
                .arg("init")
                .args([
                    "--non-interactive",
                    "--harness",
                    "codex",
                    "--instructions",
                    "write",
                ])
                .arg(self.project.path())
                .output()?;
            assert!(
                installed.status.success(),
                "{}",
                String::from_utf8_lossy(&installed.stderr)
            );
        }
        let invalid = Command::new(executable)
            .arg("init")
            .args([
                "--non-interactive",
                "--harness",
                "codex",
                "--instructions",
                "write",
            ])
            .arg(self.project.path().join("missing"))
            .output()?;
        assert!(!invalid.status.success());
        assert!(invalid.stdout.is_empty());
        assert!(String::from_utf8_lossy(&invalid.stderr).contains("existing project directory"));
        Ok(())
    }
}

#[test]
fn cli_installs_and_reports_invalid_projects() -> io::Result<()> {
    CliScenario::create()?.exercises_public_commands()
}

#[test]
fn info_reads_project_choices_and_init_preserves_them() -> Result<(), InfoCheckError> {
    CliScenario::create()?.verifies_info_and_preserved_choices()
}

#[test]
fn unattended_init_requires_explicit_choice() -> io::Result<()> {
    CliScenario::create()?.requires_explicit_noninteractive_mode()
}

#[test]
fn interactive_init_persists_each_role_choice() -> Result<(), TerminalError> {
    CliScenario::create()?.selects_models_in_terminal()
}

#[test]
fn cancelled_init_preserves_the_project() -> Result<(), TerminalError> {
    CliScenario::create()?.cancels_without_writes()
}

#[test]
fn declined_instruction_changes_still_install_framework() -> Result<(), TerminalError> {
    CliScenario::create()?.declines_instructions()
}

#[test]
fn unattended_init_requires_harness_and_write_choices() -> io::Result<()> {
    CliScenario::create()?.checks_unattended_choices()
}
