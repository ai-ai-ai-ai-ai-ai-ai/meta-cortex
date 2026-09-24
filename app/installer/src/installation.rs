use thiserror::Error;
mod bundle;
mod dependencies;
mod tools;

use tools::ToolRequest;
pub use tools::{Tool, ToolSetup};

use crate::configuration::{ConfigError, ConfigText, Configuration};
use crate::information::{ProjectInfo, Version, VersionError};
use crate::integration::{InstructionError, IntegrationOptions, ProjectHarnesses};
use bundle::Bundle;
use dependencies::WorkspaceDependencies;
use meta_cortex_workbench::{DataDirectory, LedgerError, Workbench};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("repository initialization failed: {0}")]
    Repository(#[from] LedgerError),
    #[error("Meta-Cortex requires a Git repository: {0}")]
    Git(#[from] git2::Error),
    #[error(
        "{tool} setup failed for {path}; use InstallMissing or install {tool} manually and rerun Framework / Initialize: {source}"
    )]
    ToolUnavailable {
        tool: Tool,
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error(
        "could not install framework dependencies in {path}; install Bun and rerun Framework / Initialize: {source}"
    )]
    Dependencies {
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error("filesystem operation failed: {0}")]
    Io(#[from] io::Error),
    #[error(
        "missing required framework entry: {path}; the installed .meta-cortex directory is incomplete or from a different framework version. To replace it, back up and move the existing .meta-cortex directory out of the installation path, run Framework / Initialize through meta-cortex run again, then review and reapply your configuration changes"
    )]
    MissingFrameworkEntry {
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error(transparent)]
    Configuration(#[from] ConfigError),
    #[error(transparent)]
    Version(#[from] VersionError),
    #[error(
        "Meta-Cortex is not initialized in {0}; run Framework / Initialize through meta-cortex run"
    )]
    NotInitialized(PathBuf),
    #[error("expected an existing project directory: {0}")]
    InvalidProject(PathBuf),
    #[error("refusing to overwrite differing content or a symbolic link: {0}")]
    Conflict(PathBuf),
    #[error(transparent)]
    Instructions(#[from] InstructionError),
}

pub struct Project {
    root: PathBuf,
    data: DataDirectory,
}

pub struct Installation {
    project: Project,
    bundle: BundleState,
}

pub struct InstalledProject {
    root: PathBuf,
}

impl InstalledProject {
    pub fn path(&self) -> &Path {
        &self.root
    }
}

enum BundleState {
    Absent,
    Identical,
}

impl Project {
    pub fn open(path: PathBuf) -> Result<Self, InstallError> {
        if !path.is_dir() {
            return Err(InstallError::InvalidProject(path));
        }
        git2::Repository::discover(&path)?;
        Ok(Self {
            root: path.canonicalize()?,
            data: DataDirectory::discover()?,
        })
    }

    pub fn info(self) -> Result<ProjectInfo, InstallError> {
        let destination = self.root.join(".meta-cortex");
        match fs::symlink_metadata(&destination) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
            Ok(_) => return Err(InstallError::Conflict(destination)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Err(InstallError::NotInitialized(self.root));
            }
            Err(error) => return Err(error.into()),
        }
        let path = destination.join("meta-cortex.toml");
        let metadata = fs::symlink_metadata(&path)?;
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err(InstallError::Conflict(path));
        }
        let configuration = ConfigText::from(fs::read_to_string(path)?).parse()?;
        let integrations = ProjectHarnesses {
            root: self.root.clone(),
        }
        .inspect()?;
        Ok(ProjectInfo {
            root: self.root,
            version: Version::read(&destination)?,
            configuration,
            integrations,
        })
    }

    pub fn prepare(self) -> Result<Installation, InstallError> {
        let destination = self.root.join(".meta-cortex");
        let bundle = match fs::symlink_metadata(&destination) {
            Ok(_) => {
                let bundle = Bundle {
                    directory: &Bundle::FRAMEWORK,
                    destination: destination.clone(),
                };
                match bundle.verify_identity_only() {
                    Ok(()) => BundleState::Absent,
                    Err(_) => {
                        bundle.verify()?;
                        BundleState::Identical
                    }
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => BundleState::Absent,
            Err(error) => return Err(error.into()),
        };
        Ok(Installation {
            project: self,
            bundle,
        })
    }
}

pub struct InitRequest {
    pub integration: IntegrationOptions,
    pub mise: ToolSetup,
    pub bun: ToolSetup,
    pub vale: ToolSetup,
}

impl Installation {
    pub fn install(self, request: InitRequest) -> Result<InstalledProject, InstallError> {
        let destination = self.project.root.join(".meta-cortex");
        let integration = request.integration.plan(ProjectHarnesses {
            root: self.project.root.clone(),
        })?;
        request
            .mise
            .prepare(ToolRequest {
                tool: Tool::Mise,
                home: self.project.data.path().to_owned(),
            })
            .map_err(|source| InstallError::ToolUnavailable {
                tool: Tool::Mise,
                path: destination.clone(),
                source,
            })?;
        let bun = request
            .bun
            .prepare(ToolRequest {
                tool: Tool::Bun,
                home: self.project.data.path().to_owned(),
            })
            .map_err(|source| InstallError::ToolUnavailable {
                tool: Tool::Bun,
                path: destination.clone(),
                source,
            })?;
        request
            .vale
            .prepare(ToolRequest {
                tool: Tool::Vale,
                home: self.project.data.path().to_owned(),
            })
            .map_err(|source| InstallError::ToolUnavailable {
                tool: Tool::Vale,
                path: destination.clone(),
                source,
            })?;
        let dependencies = WorkspaceDependencies {
            directory: destination.clone(),
            bun,
        };
        match self.bundle {
            BundleState::Absent => {
                let configuration = ConfigText::try_from(Configuration::bundled()?)?;
                Bundle {
                    directory: &Bundle::FRAMEWORK,
                    destination: destination.clone(),
                }
                .install(configuration)?;
            }
            BundleState::Identical => {
                Bundle {
                    directory: &Bundle::FRAMEWORK,
                    destination: destination.clone(),
                }
                .verify()?;
            }
        }
        dependencies.install()?;
        Workbench::discover(&self.project.root)?
            .with_data_directory(self.project.data)
            .initialize_repository()?;
        integration.apply()?;
        Ok(InstalledProject {
            root: self.project.root,
        })
    }
}

#[cfg(test)]
pub mod tests {
    use super::{DataDirectory, InitRequest, InstallError, Project, ToolSetup};
    use crate::integration::{
        Harness, HarnessChoice, InstructionAction, InstructionError, IntegrationOptions,
    };
    use std::fs;
    use std::io;
    use std::os::unix::fs::symlink;
    use std::process::Command;
    use tempfile::{TempDir, tempdir};

    struct Fixture {
        directory: TempDir,
        data: TempDir,
    }
    impl Fixture {
        fn create() -> Result<Self, InstallError> {
            let directory = tempdir()?;
            git2::Repository::init(directory.path())?;
            let fixture = Self {
                directory,
                data: tempdir()?,
            };
            fixture.seed_tools()?;
            Ok(fixture)
        }
        fn seed_tools(&self) -> io::Result<()> {
            // Tests supply managed installations from the runner's toolchain.
            for name in ["mise", "bun", "vale"] {
                let output = Command::new("sh")
                    .args(["-c", "command -v \"$1\"", "sh", name])
                    .output()?;
                assert!(output.status.success(), "missing test tool: {name}");
                let directory = self.data.path().join(name).join("bin");
                fs::create_dir_all(&directory)?;
                let executable = String::from_utf8(output.stdout).map_err(io::Error::other)?;
                symlink(executable.trim(), directory.join(name))?;
            }
            Ok(())
        }
        fn install(&self) -> Result<(), InstallError> {
            Project {
                data: DataDirectory::from(self.data.path().to_owned()),
                ..Project::open(self.directory.path().to_path_buf())?
            }
            .prepare()?
            .install(InitRequest {
                mise: ToolSetup::RequireExisting,
                bun: ToolSetup::RequireExisting,
                vale: ToolSetup::RequireExisting,
                integration: IntegrationOptions {
                    harness: HarnessChoice::Selected(Harness::Codex),
                    instructions: InstructionAction::Write,
                },
            })?;
            Ok(())
        }
        fn preserves_and_repeats(self) -> Result<(), InstallError> {
            let agents = self.directory.path().join("AGENTS.md");
            fs::write(&agents, "# Project rules\n")?;
            self.install()?;
            let first = fs::read_to_string(&agents)?;
            assert!(first.starts_with("# Project rules\n"));
            assert!(first.contains("---\nmeta-cortex: instructions\n---"));
            assert!(!first.contains("<!--"));
            self.install()?;
            assert_eq!(first, fs::read_to_string(agents)?);
            Ok(())
        }
        fn preserves_workspace_dependencies(self) -> Result<(), InstallError> {
            self.install()?;
            let root = self.directory.path().join(".meta-cortex");
            let modules = root.join("node_modules");
            assert!(modules.join("effect/AGENTS.md").is_file());
            assert!(root.join("package.json").is_file());
            assert!(root.join("bun.lock").is_file());
            let marker = modules.join("installed-package");
            fs::write(&marker, "local dependency")?;
            self.install()?;
            Project::open(self.directory.path().to_path_buf())?.info()?;
            assert_eq!(fs::read_to_string(marker)?, "local dependency");
            fs::remove_dir_all(&modules)?;
            self.install()?;
            assert!(modules.join("effect/AGENTS.md").is_file());
            fs::write(root.join("unexpected-file"), "unexpected")?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            Ok(())
        }
        fn rejects_linked_dependencies(self) -> Result<(), InstallError> {
            self.install()?;
            let external = tempdir()?;
            let modules = self.directory.path().join(".meta-cortex/node_modules");
            fs::remove_dir_all(&modules)?;
            symlink(external.path(), &modules)?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            fs::remove_file(&modules)?;
            fs::write(&modules, "not a directory")?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            Ok(())
        }
        fn rejects_modified_bundle(self) -> Result<(), InstallError> {
            self.install()?;
            let path = self.directory.path().join(".meta-cortex/AGENTS.md");
            fs::write(&path, "custom")?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            assert_eq!(fs::read_to_string(path)?, "custom");
            Ok(())
        }
        fn rejects_license_changed_after_prepare(self) -> Result<(), InstallError> {
            self.install()?;
            let prepared = Project {
                data: DataDirectory::from(self.data.path().to_owned()),
                ..Project::open(self.directory.path().to_path_buf())?
            }
            .prepare()?;
            let license = self
                .directory
                .path()
                .canonicalize()?
                .join(".meta-cortex/LICENSE");
            fs::write(&license, "changed after preparation")?;
            let agents = self.directory.path().join("AGENTS.md");
            fs::remove_file(&agents)?;
            let result = prepared.install(InitRequest {
                mise: ToolSetup::RequireExisting,
                bun: ToolSetup::RequireExisting,
                vale: ToolSetup::RequireExisting,
                integration: IntegrationOptions {
                    harness: HarnessChoice::Selected(Harness::Codex),
                    instructions: InstructionAction::Write,
                },
            });
            assert!(matches!(result, Err(InstallError::Conflict(path)) if path == license));
            assert_eq!(fs::read_to_string(license)?, "changed after preparation");
            assert!(!agents.exists());
            Ok(())
        }
        fn rejects_symlink(self) -> Result<(), InstallError> {
            let external = tempdir()?;
            symlink(external.path(), self.directory.path().join(".meta-cortex"))?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            assert!(!external.path().join("AGENTS.md").exists());
            Ok(())
        }
        fn preserves_invalid_configuration(self) -> Result<(), InstallError> {
            self.install()?;
            let config = self.directory.path().join(".meta-cortex/meta-cortex.toml");
            fs::write(&config, "broken = [")?;
            assert!(matches!(
                self.install(),
                Err(InstallError::Configuration(_))
            ));
            assert_eq!(fs::read_to_string(config)?, "broken = [");
            Ok(())
        }
        fn rejects_linked_metadata(self) -> Result<(), InstallError> {
            self.install()?;
            let external = tempdir()?;
            let target = external.path().join("external");
            fs::write(&target, "unchanged")?;
            for filename in ["meta-cortex.toml", ".version"] {
                let path = self.directory.path().join(".meta-cortex").join(filename);
                let original = fs::read(&path)?;
                fs::remove_file(&path)?;
                symlink(&target, &path)?;
                assert!(self.install().is_err());
                assert!(
                    Project::open(self.directory.path().to_path_buf())?
                        .info()
                        .is_err()
                );
                assert_eq!(fs::read_to_string(&target)?, "unchanged");
                fs::remove_file(&path)?;
                fs::write(path, original)?;
            }
            Ok(())
        }
        fn handles_version_metadata(self) -> Result<(), InstallError> {
            self.install()?;
            let version = self.directory.path().join(".meta-cortex/.version");
            fs::remove_file(&version)?;
            // Missing metadata is an incomplete installation, not a supported version.
            fs::remove_file(self.directory.path().join("AGENTS.md"))?;
            assert!(matches!(self.install(), Err(InstallError::Version(_))));
            assert!(!self.directory.path().join("AGENTS.md").exists());
            assert!(!version.exists());
            for contents in ["", "invalid version", "arbitrary", "0.0.1", "0.6.3"] {
                fs::write(&version, contents)?;
                assert!(matches!(self.install(), Err(InstallError::Version(_))));
                assert_eq!(fs::read_to_string(&version)?, contents);
                assert!(!self.directory.path().join("AGENTS.md").exists());
                assert!(
                    Project::open(self.directory.path().to_path_buf())?
                        .info()
                        .is_err()
                );
            }
            Ok(())
        }
        fn rejects_invalid_entry(self) -> Result<(), InstallError> {
            fs::write(
                self.directory.path().join("AGENTS.md"),
                "---\nmeta-cortex: instructions\n---\n",
            )?;
            assert!(matches!(
                self.install(),
                Err(InstallError::Instructions(InstructionError::InvalidEntry(
                    _
                )))
            ));
            assert!(!self.directory.path().join(".meta-cortex").exists());
            Ok(())
        }
    }
    #[test]
    fn identifies_missing_framework_entries_without_writes() -> Result<(), InstallError> {
        for missing in ["CIRCUIT-BREAKER.md", "teams", "LICENSE", "meta-cortex.toml"] {
            let fixture = Fixture::create()?;
            fixture.install()?;
            let root = fixture.directory.path().canonicalize()?;
            let path = root.join(".meta-cortex").join(missing);
            if path.is_dir() {
                fs::remove_dir_all(&path)?;
            } else {
                fs::remove_file(&path)?;
            }
            let instructions = fs::read(root.join("AGENTS.md"))?;
            let error = fixture
                .install()
                .err()
                .ok_or_else(|| io::Error::other("incomplete framework must not be overwritten"))?;
            let message = error.to_string();
            assert!(
                message.contains("missing required framework entry"),
                "{message}"
            );
            assert!(message.contains(&path.display().to_string()), "{message}");
            assert!(message.contains("back up"), "{message}");
            assert!(
                matches!(error, InstallError::MissingFrameworkEntry { path: missing, source } if missing == path && source.kind() == io::ErrorKind::NotFound)
            );
            assert!(!path.exists());
            assert_eq!(fs::read(root.join("AGENTS.md"))?, instructions);
        }
        Ok(())
    }
    #[test]
    fn preserves_root_workspace_dependencies() -> Result<(), InstallError> {
        Fixture::create()?.preserves_workspace_dependencies()
    }
    #[test]
    fn rejects_invalid_workspace_dependencies() -> Result<(), InstallError> {
        Fixture::create()?.rejects_linked_dependencies()
    }
    #[test]
    fn preserves_project_and_is_idempotent() -> Result<(), InstallError> {
        Fixture::create()?.preserves_and_repeats()
    }
    #[test]
    fn rejects_modified_framework() -> Result<(), InstallError> {
        Fixture::create()?.rejects_modified_bundle()
    }
    #[test]
    fn rejects_license_changed_after_preparation() -> Result<(), InstallError> {
        Fixture::create()?.rejects_license_changed_after_prepare()
    }
    #[test]
    fn rejects_symbolic_link() -> Result<(), InstallError> {
        Fixture::create()?.rejects_symlink()
    }
    #[test]
    fn validates_before_installation() -> Result<(), InstallError> {
        Fixture::create()?.rejects_invalid_entry()
    }
    #[test]
    fn rejects_invalid_config_without_replacing_it() -> Result<(), InstallError> {
        Fixture::create()?.preserves_invalid_configuration()
    }
    #[test]
    fn rejects_config_and_version_symlinks() -> Result<(), InstallError> {
        Fixture::create()?.rejects_linked_metadata()
    }
    #[test]
    fn rejects_missing_mismatched_and_invalid_versions() -> Result<(), InstallError> {
        Fixture::create()?.handles_version_metadata()
    }
}
