use crate::configuration::{ConfigError, ConfigText, InitMode};
use crate::information::{FrameworkVersion, ProjectInfo, Version, VersionError};
use crate::integration::{
    InstructionError, IntegrationOptions, IntegrationRequest, ProjectHarnesses,
};
use include_dir::{Dir, include_dir};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("filesystem operation failed: {0}")]
    Io(#[from] io::Error),
    #[error(transparent)]
    Configuration(#[from] ConfigError),
    #[error(transparent)]
    Version(#[from] VersionError),
    #[error("Meta-Cortex is not initialized in {0}; run meta-cortex init")]
    NotInitialized(PathBuf),
    #[error("could not serialize project information: {0}")]
    Info(#[from] serde_saphyr::SerializeError),
    #[error("expected an existing project directory: {0}")]
    InvalidProject(PathBuf),
    #[error("refusing to overwrite differing content or a symbolic link: {0}")]
    Conflict(PathBuf),
    #[error(transparent)]
    Instructions(#[from] InstructionError),
}

pub struct Project {
    root: PathBuf,
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

struct Bundle<'a> {
    directory: &'a Dir<'a>,
    destination: PathBuf,
}

impl Bundle<'_> {
    fn verify(&self) -> Result<(), InstallError> {
        let metadata = fs::symlink_metadata(&self.destination)?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err(InstallError::Conflict(self.destination.clone()));
        }
        for entry in self.directory.entries() {
            let path = self.destination.join(
                entry
                    .path()
                    .file_name()
                    .ok_or_else(|| InstallError::Conflict(self.destination.clone()))?,
            );
            match entry {
                include_dir::DirEntry::Dir(directory) => Bundle {
                    directory,
                    destination: path,
                }
                .verify()?,
                include_dir::DirEntry::File(file) => {
                    let metadata = fs::symlink_metadata(&path)?;
                    if !metadata.is_file() || metadata.file_type().is_symlink() {
                        return Err(InstallError::Conflict(path));
                    }
                    if file.path() == Path::new("meta-cortex.toml") {
                        ConfigText::from(fs::read_to_string(&path)?).parse()?;
                    } else if fs::read(&path)? != file.contents() {
                        return Err(InstallError::Conflict(path));
                    }
                }
            }
        }
        let mut expected = self.directory.entries().len();
        if self.directory.path().as_os_str().is_empty() {
            expected += 1; // LICENSE is distributed beside the framework.
            match FrameworkVersion::read(&self.destination)? {
                FrameworkVersion::Legacy => {}
                FrameworkVersion::Recorded(version) => {
                    if version != Version::from(Version::CURRENT.to_owned()) {
                        return Err(InstallError::Conflict(self.destination.clone()));
                    }
                    expected += 1;
                }
            }
        }
        let mut actual = 0;
        for entry in fs::read_dir(&self.destination)? {
            let entry = entry?;
            if self.directory.path().as_os_str().is_empty() && entry.file_name() == "node_modules" {
                // The library's Bun workspace owns this local, unbundled directory.
                if !entry.file_type()?.is_dir() {
                    return Err(InstallError::Conflict(entry.path()));
                }
                continue;
            }
            actual += 1;
        }
        if actual != expected {
            return Err(InstallError::Conflict(self.destination.clone()));
        }
        Ok(())
    }
}

impl Project {
    const FRAMEWORK: Dir<'_> = include_dir!("$META_CORTEX_BUNDLE");
    const LICENSE: &[u8] = include_bytes!("../../LICENSE");

    pub fn open(path: PathBuf) -> Result<Self, InstallError> {
        if !path.is_dir() {
            return Err(InstallError::InvalidProject(path));
        }
        Ok(Self {
            root: path.canonicalize()?,
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
            version: FrameworkVersion::read(&destination)?,
            configuration,
            integrations,
        })
    }

    pub fn prepare(self) -> Result<Installation, InstallError> {
        let destination = self.root.join(".meta-cortex");
        let bundle = match fs::symlink_metadata(&destination) {
            Ok(_) => {
                Bundle {
                    directory: &Project::FRAMEWORK,
                    destination: destination.clone(),
                }
                .verify()?;
                let license = destination.join("LICENSE");
                if fs::symlink_metadata(&license)?.file_type().is_symlink()
                    || fs::read(&license)? != Project::LICENSE
                {
                    return Err(InstallError::Conflict(license));
                }
                BundleState::Identical
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
    pub mode: InitMode,
    pub integration: IntegrationOptions,
}

impl Installation {
    pub fn install(self, request: InitRequest) -> Result<InstalledProject, InstallError> {
        let destination = self.project.root.join(".meta-cortex");
        let integration = request.integration.plan(IntegrationRequest {
            project: ProjectHarnesses {
                root: self.project.root.clone(),
            },
            mode: request.mode,
        })?;
        match self.bundle {
            BundleState::Absent => {
                let configuration = ConfigText::try_from(request.mode.configure()?)?;
                // create_dir claims the destination without replacing an existing entry.
                fs::create_dir(&destination)?;
                Project::FRAMEWORK.extract(&destination)?;
                fs::write(destination.join("LICENSE"), Project::LICENSE)?;
                fs::write(
                    destination.join("meta-cortex.toml"),
                    configuration.as_bytes(),
                )?;
                fs::write(destination.join(FrameworkVersion::FILE), Version::CURRENT)?;
            }
            BundleState::Identical => {
                Bundle {
                    directory: &Project::FRAMEWORK,
                    destination,
                }
                .verify()?;
            }
        }
        integration.apply()?;
        Ok(InstalledProject {
            root: self.project.root,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{InitRequest, InstallError, Project};
    use crate::configuration::InitMode;
    use crate::integration::{
        Harness, HarnessChoice, InstructionAction, InstructionError, IntegrationOptions,
    };
    use std::fs;
    use std::os::unix::fs::symlink;
    use tempfile::{TempDir, tempdir};

    struct Fixture {
        directory: TempDir,
    }
    impl Fixture {
        fn create() -> Result<Self, InstallError> {
            Ok(Self {
                directory: tempdir()?,
            })
        }
        fn install(&self) -> Result<(), InstallError> {
            Project::open(self.directory.path().to_path_buf())?
                .prepare()?
                .install(InitRequest {
                    mode: InitMode::Bundled,
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
            assert!(!modules.exists());
            assert!(root.join("package.json").is_file());
            assert!(root.join("bun.lock").is_file());
            fs::create_dir(&modules)?;
            let marker = modules.join("installed-package");
            fs::write(&marker, "local dependency")?;
            self.install()?;
            Project::open(self.directory.path().to_path_buf())?.info()?;
            assert_eq!(fs::read_to_string(marker)?, "local dependency");
            fs::write(root.join("unexpected-file"), "unexpected")?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            Ok(())
        }
        fn rejects_linked_dependencies(self) -> Result<(), InstallError> {
            self.install()?;
            let external = tempdir()?;
            let modules = self.directory.path().join(".meta-cortex/node_modules");
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
            // Legacy installs with the same framework can still repair their entry point.
            fs::remove_file(self.directory.path().join("AGENTS.md"))?;
            self.install()?;
            assert!(!version.exists());
            fs::write(&version, "0.0.1")?;
            assert!(matches!(self.install(), Err(InstallError::Conflict(_))));
            for contents in ["", "invalid version"] {
                fs::write(&version, contents)?;
                assert!(matches!(self.install(), Err(InstallError::Version(_))));
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
                "<!-- meta-cortex:start -->",
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
    fn distinguishes_legacy_mismatched_and_invalid_versions() -> Result<(), InstallError> {
        Fixture::create()?.handles_version_metadata()
    }
}
