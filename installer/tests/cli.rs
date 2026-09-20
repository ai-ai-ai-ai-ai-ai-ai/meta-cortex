use std::io;
use std::process::Command;
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

    fn exercises_public_commands(self) -> io::Result<()> {
        let executable = env!("CARGO_BIN_EXE_meta-cortex");
        let help = Command::new(executable).arg("--help").output()?;
        assert!(help.status.success());
        for _ in 0..2 {
            let installed = Command::new(executable)
                .arg("init")
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
