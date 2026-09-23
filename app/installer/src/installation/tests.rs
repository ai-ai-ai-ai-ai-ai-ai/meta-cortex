use super::{InitRequest, InstallError, Project};
use crate::integration::{
    Harness, HarnessChoice, InstructionAction, InstructionError, IntegrationOptions,
};
use std::fs;
use std::io;
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
    fn rejects_license_changed_after_prepare(self) -> Result<(), InstallError> {
        self.install()?;
        let prepared = Project::open(self.directory.path().to_path_buf())?.prepare()?;
        let license = self
            .directory
            .path()
            .canonicalize()?
            .join(".meta-cortex/LICENSE");
        fs::write(&license, "changed after preparation")?;
        let agents = self.directory.path().join("AGENTS.md");
        fs::remove_file(&agents)?;
        let result = prepared.install(InitRequest {
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
