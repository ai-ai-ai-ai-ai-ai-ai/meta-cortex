use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::env;
use std::io;
use std::path::{Path, PathBuf, absolute};
use std::process::{Command, Stdio};
use tempfile::NamedTempFile;

#[derive(Debug, Default, Serialize, Deserialize, JsonSchema)]
pub enum BunSetup {
    #[default]
    InstallMissing,
    RequireExisting,
}

pub(super) struct Bun {
    pub executable: PathBuf,
}

impl BunSetup {
    pub(super) fn prepare(self) -> io::Result<Bun> {
        let on_path = Bun {
            executable: PathBuf::from("bun"),
        };
        match on_path.check() {
            Ok(()) => return Ok(on_path),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
        let directory = match env::var_os("BUN_INSTALL") {
            Some(directory) if !directory.is_empty() => PathBuf::from(directory),
            Some(_) | None => env::home_dir()
                .ok_or_else(|| io::Error::other("cannot locate Bun's home; set BUN_INSTALL"))?
                .join(".bun"),
        };
        let directory = absolute(directory)?;
        let installed = Bun {
            executable: directory.join("bin/bun"),
        };
        match installed.check() {
            Ok(()) => return Ok(installed),
            Err(error) if error.kind() == io::ErrorKind::NotFound => match self {
                Self::RequireExisting => return Err(error),
                Self::InstallMissing => {}
            },
            Err(error) => return Err(error),
        }
        installed.install(&directory)?;
        installed.check()?;
        Ok(installed)
    }
}

impl Bun {
    const RELEASE: &str = "bun-v1.3.14";

    fn check(&self) -> io::Result<()> {
        Self::run(Command::new(&self.executable).arg("--version"))
    }

    fn install(&self, directory: &Path) -> io::Result<()> {
        let script = NamedTempFile::new()?;
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
                .arg(script.path()),
        )?;
        Self::run(
            Command::new("bash")
                .arg(script.path())
                .arg(Self::RELEASE)
                .env("BUN_INSTALL", directory),
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
