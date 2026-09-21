use rexpect::{error::Error as TerminalError, session};
use std::process::Command;
use std::{fs, io};
use tempfile::{TempDir, tempdir};

struct CliScenario {
    project: TempDir,
}

impl CliScenario {
    fn create() -> io::Result<Self> {
        Ok(Self {
            project: tempdir()?,
        })
    }

    fn verifies_info_and_preserved_choices(self) -> io::Result<()> {
        let executable = env!("CARGO_BIN_EXE_meta-cortex");
        let missing = Command::new(executable)
            .arg("info")
            .arg(self.project.path())
            .output()?;
        assert!(!missing.status.success());
        assert!(String::from_utf8_lossy(&missing.stderr).contains("not initialized"));
        assert_eq!(fs::read_dir(self.project.path())?.count(), 0);

        let installed = Command::new(executable)
            .args(["init", "--non-interactive"])
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
        // Reinitialization should not prompt, even without --non-interactive.
        let repeated = Command::new(executable)
            .arg("init")
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
        let output = String::from_utf8_lossy(&info.stdout);
        assert!(output.contains("Gizmo Prime: gpt-5.6-sol / low"));
        assert!(output.contains("Team Gizmo: gpt-5.6-sol / low"));
        assert!(output.contains("Team agents: gpt-5.6-luna / xhigh"));
        assert!(output.contains(&format!("Framework version: {}", env!("CARGO_PKG_VERSION"))));
        assert!(output.contains("connected through AGENTS.md"));
        assert!(output.contains(&self.project.path().canonicalize()?.display().to_string()));
        assert_eq!(fs::read(&agents_path)?, agents);
        assert_eq!(fs::read_to_string(&config_path)?, customized);

        fs::remove_file(self.project.path().join(".meta-cortex/.version"))?;
        fs::remove_file(&agents_path)?;
        let legacy = Command::new(executable)
            .arg("info")
            .arg(self.project.path())
            .output()?;
        assert!(legacy.status.success());
        let output = String::from_utf8_lossy(&legacy.stdout);
        assert!(output.contains("unknown (installed by an older CLI)"));
        assert!(output.contains("missing Meta-Cortex instructions"));
        assert!(!agents_path.exists());
        fs::write(&config_path, "broken = [")?;
        let invalid = Command::new(executable)
            .arg("info")
            .arg(self.project.path())
            .output()?;
        assert!(!invalid.status.success());
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

    fn exercises_public_commands(self) -> io::Result<()> {
        let executable = env!("CARGO_BIN_EXE_meta-cortex");
        let help = Command::new(executable).arg("--help").output()?;
        assert!(help.status.success());
        for _ in 0..2 {
            let installed = Command::new(executable)
                .arg("init")
                .arg("--non-interactive")
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
            .arg("--non-interactive")
            .arg(self.project.path().join("missing"))
            .output()?;
        assert!(!invalid.status.success());
        assert!(String::from_utf8_lossy(&invalid.stderr).contains("existing project directory"));
        Ok(())
    }
}

#[test]
fn cli_installs_and_reports_invalid_projects() -> io::Result<()> {
    CliScenario::create()?.exercises_public_commands()
}

#[test]
fn info_reads_project_choices_and_init_preserves_them() -> io::Result<()> {
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
