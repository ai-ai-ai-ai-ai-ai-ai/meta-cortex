use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
#[cfg(windows)]
use std::env::consts::ARCH;
use std::env::consts::EXE_SUFFIX;
use std::fs;
use std::io;
#[cfg(windows)]
use std::io::{Error, ErrorKind};
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

#[cfg(windows)]
#[derive(Debug, PartialEq, Eq, derive_more::Display)]
enum WindowsArchitecture {
    #[display("x64")]
    X64,
    #[display("arm64")]
    Arm64,
}

#[cfg(windows)]
impl TryFrom<&str> for WindowsArchitecture {
    type Error = io::Error;

    fn try_from(architecture: &str) -> Result<Self, Self::Error> {
        match architecture {
            "x86_64" => Ok(Self::X64),
            "aarch64" => Ok(Self::Arm64),
            architecture => Err(Error::new(
                ErrorKind::Unsupported,
                format!("mise does not provide a native Windows release for {architecture}"),
            )),
        }
    }
}

impl ToolSetup {
    pub(super) fn prepare(self, request: ToolRequest) -> io::Result<InstalledTool> {
        let directory = request.home.join(request.tool.name());
        let installed = InstalledTool {
            executable: directory
                .join("bin")
                .join(format!("{}{EXE_SUFFIX}", request.tool.name())),
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

    #[cfg(unix)]
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

    #[cfg(windows)]
    fn install_mise(&self) -> io::Result<()> {
        fs::create_dir_all(self.directory.join("bin"))?;
        let architecture = WindowsArchitecture::try_from(ARCH)?;
        // PowerShell owns HTTPS download and GitHub's release JSON projection.
        // The destination is passed as environment data, never interpolated shell code.
        Self::run(
            Command::new("powershell.exe")
                .args([
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                ])
                .arg(include_str!("tools/install-mise.ps1"))
                .env("META_CORTEX_MISE_ARCH", architecture.to_string())
                .env("META_CORTEX_MISE_EXE", &self.executable),
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

#[cfg(test)]
mod tests {
    use super::{EXE_SUFFIX, Tool, ToolRequest, ToolSetup};
    use std::io::{self, Error, ErrorKind};
    use tempfile::Builder;

    #[test]
    fn missing_managed_tools_report_native_executable_paths() -> io::Result<()> {
        let directory = Builder::new().prefix("managed tools 雪 ").tempdir()?;
        for tool in [Tool::Mise, Tool::Bun, Tool::Vale] {
            let expected = directory.path().join(tool.name()).join("bin").join(format!(
                "{}{}",
                tool.name(),
                EXE_SUFFIX
            ));
            let result = ToolSetup::RequireExisting.prepare(ToolRequest {
                tool,
                home: directory.path().to_owned(),
            });
            let error = result
                .err()
                .ok_or_else(|| Error::other("missing tool accepted"))?;
            assert_eq!(error.kind(), ErrorKind::NotFound);
            assert!(error.to_string().contains(&expected.display().to_string()));
            assert!(!expected.exists());
        }
        Ok(())
    }
    #[cfg(windows)]
    #[test]
    fn native_windows_architecture_selects_official_assets() -> io::Result<()> {
        use super::WindowsArchitecture;
        assert_eq!(
            WindowsArchitecture::try_from("x86_64")?,
            WindowsArchitecture::X64
        );
        assert_eq!(
            WindowsArchitecture::try_from("aarch64")?,
            WindowsArchitecture::Arm64
        );
        let error = WindowsArchitecture::try_from("x86")
            .err()
            .ok_or_else(|| Error::other("unsupported architecture accepted"))?;
        assert_eq!(error.kind(), ErrorKind::Unsupported);
        Ok(())
    }
}
