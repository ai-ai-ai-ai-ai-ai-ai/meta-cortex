use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::env::consts::{ARCH, OS};
use std::fs;
use std::io;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Debug, Default, Serialize, Deserialize, JsonSchema)]
pub enum ToolSetup {
    #[default]
    InstallMissing,
    RequireExisting,
}

#[derive(Clone, Copy, Debug, derive_more::Display)]
pub enum Tool {
    #[display("Bun")]
    Bun,
    #[display("Vale")]
    Vale,
}

impl Tool {
    fn name(self) -> &'static str {
        match self {
            Self::Bun => "bun",
            Self::Vale => "vale",
        }
    }
}

pub(super) struct ToolRequest {
    pub tool: Tool,
    pub home: PathBuf,
}

pub(super) struct InstalledTool {
    pub executable: PathBuf,
    pub directory: PathBuf,
}

impl ToolSetup {
    pub(super) fn prepare(self, request: ToolRequest) -> io::Result<InstalledTool> {
        let directory = request.home.join(request.tool.name());
        let installed = InstalledTool {
            executable: directory.join("bin").join(request.tool.name()),
            directory: directory.clone(),
        };
        match installed.check() {
            Ok(()) => return Ok(installed),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
        let on_path = InstalledTool {
            executable: PathBuf::from(request.tool.name()),
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
        installed.install(request.tool)?;
        installed.check()?;
        Ok(installed)
    }
}

impl InstalledTool {
    fn check(&self) -> io::Result<()> {
        Self::run(Command::new(&self.executable).arg("--version"))
    }

    fn install(&self, tool: Tool) -> io::Result<()> {
        fs::create_dir_all(self.directory.join("bin"))?;
        match tool {
            Tool::Bun => self.install_bun(),
            Tool::Vale => self.install_vale(),
        }
    }

    fn install_bun(&self) -> io::Result<()> {
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
                .arg("bun-v1.3.14")
                .env("BUN_INSTALL", &self.directory)
                .env("SHELL", "/bin/sh"),
        )
    }

    fn install_vale(&self) -> io::Result<()> {
        let archive = self.directory.join("vale.tar.gz");
        let asset = match (OS, ARCH) {
            ("macos", "aarch64") => "macOS_arm64",
            ("macos", "x86_64") => "macOS_64-bit",
            ("linux", "aarch64") => "Linux_arm64",
            ("linux", "x86_64") => "Linux_64-bit",
            _ => {
                return Err(io::Error::other(
                    "automatic Vale installation supports macOS and Linux on arm64 and x86_64; install Vale on PATH for this platform",
                ));
            }
        };
        let url = format!(
            "https://github.com/vale-cli/vale/releases/download/v3.22.0/vale_3.22.0_{asset}.tar.gz"
        );
        Self::run(
            Command::new("curl")
                .args([
                    "--fail",
                    "--silent",
                    "--show-error",
                    "--location",
                    &url,
                    "--output",
                ])
                .arg(&archive),
        )?;
        Self::run(
            Command::new("tar")
                .arg("-xzf")
                .arg(archive)
                .arg("-C")
                .arg(self.directory.join("bin"))
                .arg("vale"),
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
