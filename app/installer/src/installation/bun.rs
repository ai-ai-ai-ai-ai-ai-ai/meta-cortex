use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Debug, Default, Serialize, Deserialize, JsonSchema)]
pub enum BunSetup {
    #[default]
    InstallMissing,
    RequireExisting,
}

pub(super) struct Bun {
    pub executable: PathBuf,
    pub directory: PathBuf,
}

impl BunSetup {
    pub(super) fn prepare(self, directory: PathBuf) -> io::Result<Bun> {
        let installed = Bun {
            executable: directory.join("bin/bun"),
            directory: directory.clone(),
        };
        match installed.check() {
            Ok(()) => return Ok(installed),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
        let on_path = Bun {
            executable: PathBuf::from("bun"),
            directory,
        };
        match on_path.check() {
            Ok(()) => return Ok(on_path),
            Err(error) if error.kind() == io::ErrorKind::NotFound => match self {
                Self::RequireExisting => return Err(error),
                Self::InstallMissing => {}
            },
            Err(error) => return Err(error),
        }
        installed.install()?;
        installed.check()?;
        Ok(installed)
    }
}

impl Bun {
    const RELEASE: &str = "bun-v1.3.14";

    fn check(&self) -> io::Result<()> {
        Self::run(Command::new(&self.executable).arg("--version"))
    }

    fn install(&self) -> io::Result<()> {
        fs::create_dir_all(&self.directory)?;
        let script = self.directory.join("install.sh");
        Self::run(
            Command::new("curl")
                .args([
                    "--fail",
                    "--silent",
                    "--show-error",
                    "--location",
                    "https://bun.com/install",
                    "--output",
                ])
                .arg(&script),
        )?;
        Self::run(
            Command::new("bash")
                .arg(&script)
                .arg(Self::RELEASE)
                .env("BUN_INSTALL", &self.directory)
                .env("SHELL", "/bin/sh"),
        )
    }

    fn run(command: &mut Command) -> io::Result<()> {
        let output = command.stdin(Stdio::null()).output()?;
        match output.status.code() {
            Some(0) => Ok(()),
            Some(_) | None => Err(io::Error::other(format!(
                "{} failed with {}: {}{}",
                command.get_program().to_string_lossy(),
                output.status,
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr),
            ))),
        }
    }
}
