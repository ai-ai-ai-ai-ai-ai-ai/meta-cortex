use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
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
    #[display("mise")]
    Mise,
    #[display("Bun")]
    Bun,
    #[display("Vale")]
    Vale,
}

#[derive(Deserialize, derive_more::Display)]
#[serde(transparent)]
struct ToolRelease(String);

#[derive(Deserialize)]
struct ToolVersions {
    bun: ToolRelease,
    vale: ToolRelease,
}

#[derive(Deserialize)]
struct ToolConfiguration {
    tools: ToolVersions,
}

impl ToolConfiguration {
    fn bundled() -> io::Result<Self> {
        toml::from_str(include_str!("../../../../cortex/mise.toml"))
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
    }
}

impl Tool {
    fn name(self) -> &'static str {
        match self {
            Self::Mise => "mise",
            Self::Bun => "bun",
            Self::Vale => "vale",
        }
    }
}

#[derive(derive_more::Display)]
enum RuntimePackage {
    #[display("bun@{_0}")]
    Bun(ToolRelease),
    #[display("vale@{_0}")]
    Vale(ToolRelease),
}

struct RuntimeInstall {
    home: PathBuf,
    package: RuntimePackage,
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
        match installed.check(request.tool) {
            Ok(()) => return Ok(installed),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
        match self {
            Self::RequireExisting => {
                return Err(io::Error::new(
                    io::ErrorKind::NotFound,
                    format!("missing managed tool: {}", installed.executable.display()),
                ));
            }
            Self::InstallMissing => {}
        }
        let tool = request.tool;
        installed.install(request)?;
        installed.check(tool)?;
        Ok(installed)
    }
}

impl InstalledTool {
    fn check(&self, tool: Tool) -> io::Result<()> {
        let mut command = Command::new(&self.executable);
        match tool {
            Tool::Mise => self.configure_mise(&mut command),
            Tool::Bun | Tool::Vale => {}
        }
        Self::run(command.arg("--version"))
    }

    fn configure_mise(&self, command: &mut Command) {
        command
            .env("MISE_DATA_DIR", &self.directory)
            .env("MISE_CACHE_DIR", self.directory.join("cache"))
            .env("MISE_CONFIG_DIR", self.directory.join("config"))
            .env("MISE_STATE_DIR", self.directory.join("state"))
            .env("MISE_YES", "1");
    }

    fn install(&self, request: ToolRequest) -> io::Result<()> {
        match request.tool {
            Tool::Mise => self.install_mise(),
            Tool::Bun => self.install_runtime(RuntimeInstall {
                home: request.home,
                package: RuntimePackage::Bun(ToolConfiguration::bundled()?.tools.bun),
            }),
            Tool::Vale => self.install_runtime(RuntimeInstall {
                home: request.home,
                package: RuntimePackage::Vale(ToolConfiguration::bundled()?.tools.vale),
            }),
        }
    }

    fn install_mise(&self) -> io::Result<()> {
        fs::create_dir_all(self.directory.join("bin"))?;
        let script = self.directory.join("install.sh");
        Self::run(
            Command::new("curl")
                .args([
                    "--fail",
                    "--silent",
                    "--show-error",
                    "--location",
                    "https://mise.run",
                    "--output",
                ])
                .arg(&script),
        )?;
        let mut installer = Command::new("sh");
        self.configure_mise(&mut installer);
        Self::run(
            installer
                .arg(&script)
                .env("MISE_INSTALL_PATH", &self.executable),
        )
    }

    fn install_runtime(&self, request: RuntimeInstall) -> io::Result<()> {
        let manager = ToolSetup::RequireExisting.prepare(ToolRequest {
            tool: Tool::Mise,
            home: request.home.clone(),
        })?;
        let manager_home = request.home.join("mise");
        let destination = match &request.package {
            RuntimePackage::Bun(_) => self.directory.clone(),
            RuntimePackage::Vale(_) => self.directory.join("bin"),
        };
        fs::create_dir_all(&manager_home)?;
        let mut command = Command::new(&manager.executable);
        manager.configure_mise(&mut command);
        Self::run(
            command
                .arg("install-into")
                .arg(request.package.to_string())
                .arg(destination)
                .current_dir(manager_home),
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
