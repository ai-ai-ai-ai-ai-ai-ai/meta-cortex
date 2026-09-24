use super::InstallError;
use std::io;
use std::path::PathBuf;
use std::process::{Command, Stdio};

pub(super) struct WorkspaceDependencies {
    pub directory: PathBuf,
}

impl WorkspaceDependencies {
    pub fn check_bun(&self) -> Result<(), InstallError> {
        let output = Command::new("bun")
            .arg("--version")
            .stdin(Stdio::null())
            .output()
            .map_err(|source| InstallError::BunUnavailable {
                path: self.directory.clone(),
                source,
            })?;
        match output.status.code() {
            Some(0) => Ok(()),
            Some(_) | None => Err(InstallError::BunUnavailable {
                path: self.directory.clone(),
                source: io::Error::other(format!(
                    "bun --version failed with {}: {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr),
                )),
            }),
        }
    }

    pub fn install(self) -> Result<(), InstallError> {
        let output = Command::new("bun")
            .args(["install", "--frozen-lockfile", "--ignore-scripts"])
            .current_dir(&self.directory)
            .stdin(Stdio::null())
            .output()
            .map_err(|source| InstallError::Dependencies {
                path: self.directory.clone(),
                source,
            })?;
        match output.status.code() {
            Some(0) => Ok(()),
            Some(_) | None => Err(InstallError::Dependencies {
                path: self.directory,
                source: io::Error::other(format!(
                    "{}: {}{}",
                    output.status,
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr),
                )),
            }),
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::{InstallError, WorkspaceDependencies};
    use std::{fs, io};
    use tempfile::tempdir;

    #[test]
    fn reports_bun_failure_and_spawn_failure() -> Result<(), InstallError> {
        let project = tempdir()?;
        let manifest = project.path().join("package.json");
        fs::write(&manifest, "invalid package manifest")?;
        let dependencies = WorkspaceDependencies {
            directory: project.path().to_owned(),
        };
        let error = dependencies
            .install()
            .err()
            .ok_or_else(|| io::Error::other("expected Bun failure"))?;
        assert!(matches!(error, InstallError::Dependencies { .. }));
        assert!(error.to_string().contains("rerun Framework / Initialize"));
        assert_eq!(fs::read_to_string(&manifest)?, "invalid package manifest");
        let dependencies = WorkspaceDependencies {
            directory: project.path().join("missing"),
        };
        assert!(matches!(
            dependencies.install(),
            Err(InstallError::Dependencies { .. })
        ));
        Ok(())
    }
}
