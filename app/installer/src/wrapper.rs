use crate::information::Version;
use derive_more::Display;
use schemars::JsonSchema;
use semver::Version as ReleaseVersion;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs::OpenOptions;
#[cfg(unix)]
use std::fs::Permissions;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::{fs, io};
use thiserror::Error;

// The upstream executable pin is an open dependency release, independently of bundled framework metadata.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, Display)]
#[serde(try_from = "String", into = "String")]
#[schemars(with = "String")]
pub struct WrapperRelease(ReleaseVersion);

#[derive(Debug, Error)]
pub enum WrapperReleaseError {
    #[error("invalid exact release: {0}")]
    Invalid(#[from] semver::Error),
    #[error("wrapper requires a stable exact release without prerelease or build metadata")]
    Unstable,
    #[error("wrapper requires release 0.15.0 or later")]
    BeforeInstallerContract,
}
impl WrapperRelease {
    const MINIMUM: ReleaseVersion = ReleaseVersion::new(0, 15, 0);
    pub fn current() -> Result<Self, WrapperReleaseError> {
        Self::try_from(Version::CURRENT.as_str().to_owned())
    }
}
impl TryFrom<String> for WrapperRelease {
    type Error = WrapperReleaseError;
    fn try_from(text: String) -> Result<Self, Self::Error> {
        let release = ReleaseVersion::parse(&text)?;
        match release.pre.as_str() {
            "" => {}
            _ => return Err(WrapperReleaseError::Unstable),
        }
        match release.build.as_str() {
            "" => {}
            _ => return Err(WrapperReleaseError::Unstable),
        }
        match release.cmp(&Self::MINIMUM) {
            Ordering::Less => Err(WrapperReleaseError::BeforeInstallerContract),
            Ordering::Equal | Ordering::Greater => Ok(Self(release)),
        }
    }
}
impl From<WrapperRelease> for String {
    fn from(release: WrapperRelease) -> Self {
        release.to_string()
    }
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct WrapperRequest {
    pub release: WrapperRelease,
}
#[derive(Debug, Error)]
pub enum WrapperError {
    #[error("wrapper requires an existing project directory: {0}")]
    InvalidProject(PathBuf),
    #[error("refusing to overwrite existing wrapper file: {0}")]
    Conflict(PathBuf),
    #[error("could not write project wrapper: {0}")]
    Io(#[from] io::Error),
}
#[derive(Serialize)]
pub struct WrapperReport {
    project: PathBuf,
    release: WrapperRelease,
    files: Vec<PathBuf>,
}
pub struct ProjectWrapper {
    root: PathBuf,
}
#[derive(Clone, Copy)]
enum WrapperFile {
    Posix,
    PowerShell,
    Pin,
}
impl WrapperFile {
    const ALL: [Self; 3] = [Self::Posix, Self::PowerShell, Self::Pin];
    fn path(self) -> PathBuf {
        PathBuf::from(match self {
            Self::Posix => "meta-cortexw",
            Self::PowerShell => "meta-cortexw.ps1",
            Self::Pin => ".meta-cortex-version",
        })
    }
    fn available_path(self, root: &Path) -> Result<PathBuf, WrapperError> {
        let path = root.join(self.path());
        match fs::symlink_metadata(&path) {
            Ok(_) => Err(WrapperError::Conflict(path)),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(path),
            Err(error) => Err(WrapperError::Io(error)),
        }
    }
    fn content(self, release: &WrapperRelease) -> String {
        match self {
            Self::Posix => include_str!("../../../meta-cortexw").to_owned(),
            Self::PowerShell => include_str!("../../../meta-cortexw.ps1").to_owned(),
            Self::Pin => release.to_string(),
        }
    }
}
enum ProjectDirectory {
    Directory,
    MissingOrOther,
}
impl From<bool> for ProjectDirectory {
    fn from(is_directory: bool) -> Self {
        match is_directory {
            true => Self::Directory,
            false => Self::MissingOrOther,
        }
    }
}
impl ProjectWrapper {
    pub fn open(root: PathBuf) -> Result<Self, WrapperError> {
        match ProjectDirectory::from(root.is_dir()) {
            ProjectDirectory::Directory => Ok(Self {
                root: root.canonicalize()?,
            }),
            ProjectDirectory::MissingOrOther => Err(WrapperError::InvalidProject(root)),
        }
    }
    pub fn generate(self, request: WrapperRequest) -> Result<WrapperReport, WrapperError> {
        for asset in WrapperFile::ALL {
            asset.available_path(&self.root)?;
        }
        let mut files = Vec::new();
        for asset in WrapperFile::ALL {
            let path = self.root.join(asset.path());
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)?;
            file.write_all(asset.content(&request.release).as_bytes())?;
            match asset {
                WrapperFile::Pin => file.write_all(b"\n")?,
                WrapperFile::Posix | WrapperFile::PowerShell => {}
            }
            files.push(path);
        }
        self.make_executable()?;
        Ok(WrapperReport {
            project: self.root,
            release: request.release,
            files,
        })
    }
    #[cfg(unix)]
    fn make_executable(&self) -> Result<(), WrapperError> {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(
            self.root.join("meta-cortexw"),
            Permissions::from_mode(0o755),
        )?;
        Ok(())
    }
    #[cfg(not(unix))]
    fn make_executable(&self) -> Result<(), WrapperError> {
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::{
        ProjectWrapper, WrapperError, WrapperRelease, WrapperReleaseError, WrapperRequest,
    };
    use std::fs;
    #[test]
    fn pins_future_stable_releases_without_a_new_generator() -> anyhow::Result<()> {
        let root = tempfile::tempdir()?;
        let request = WrapperRequest {
            release: WrapperRelease::try_from("1.2.3".to_owned())?,
        };
        let encoded = serde_saphyr::to_string(&request)?;
        let decoded: WrapperRequest = serde_saphyr::from_str(&encoded)?;
        ProjectWrapper::open(root.path().to_path_buf())?.generate(decoded)?;
        assert_eq!(
            fs::read_to_string(root.path().join(".meta-cortex-version"))?,
            "1.2.3\n"
        );
        Ok(())
    }
    #[test]
    fn rejects_releases_outside_the_stable_installer_contract() {
        assert!(matches!(
            WrapperRelease::try_from("0.14.0".to_owned()),
            Err(WrapperReleaseError::BeforeInstallerContract)
        ));
        for release in ["0.15.0-beta.1", "0.15.0+build"] {
            assert!(matches!(
                WrapperRelease::try_from(release.to_owned()),
                Err(WrapperReleaseError::Unstable)
            ));
        }
        for release in ["latest", "00.15.0", "0.15", "v0.15.0"] {
            assert!(matches!(
                WrapperRelease::try_from(release.to_owned()),
                Err(WrapperReleaseError::Invalid(_))
            ));
        }
    }
    #[test]
    fn generates_launchers_and_exact_separate_pin() -> anyhow::Result<()> {
        let root = tempfile::tempdir()?;
        let report = ProjectWrapper::open(root.path().to_path_buf())?.generate(WrapperRequest {
            release: WrapperRelease::current()?,
        })?;
        assert_eq!(report.files.len(), 3);
        assert_eq!(
            fs::read_to_string(root.path().join(".meta-cortex-version"))?,
            "0.16.0\n"
        );
        assert_eq!(
            fs::read_to_string(root.path().join("meta-cortexw"))?,
            include_str!("../../../meta-cortexw")
        );
        assert_eq!(
            fs::read_to_string(root.path().join("meta-cortexw.ps1"))?,
            include_str!("../../../meta-cortexw.ps1")
        );
        Ok(())
    }
    #[test]
    fn refuses_existing_files_before_writing_any_assets() -> anyhow::Result<()> {
        let root = tempfile::tempdir()?;
        fs::write(root.path().join(".meta-cortex-version"), "custom")?;
        let result = ProjectWrapper::open(root.path().to_path_buf())?.generate(WrapperRequest {
            release: WrapperRelease::current()?,
        });
        assert!(matches!(result, Err(WrapperError::Conflict(_))));
        assert!(!root.path().join("meta-cortexw").exists());
        assert_eq!(
            fs::read_to_string(root.path().join(".meta-cortex-version"))?,
            "custom"
        );
        Ok(())
    }
    #[test]
    fn rejects_missing_projects_and_unsupported_releases() -> anyhow::Result<()> {
        let root = tempfile::tempdir()?;
        assert!(matches!(
            ProjectWrapper::open(root.path().join("missing")),
            Err(WrapperError::InvalidProject(_))
        ));
        let file = root.path().join("file");
        fs::write(&file, "not a directory")?;
        assert!(matches!(
            ProjectWrapper::open(file),
            Err(WrapperError::InvalidProject(_))
        ));
        let project = ProjectWrapper::open(root.path().join("."))?;
        assert_eq!(project.root, root.path().canonicalize()?);
        assert!(serde_saphyr::from_str::<WrapperRequest>("release: latest").is_err());
        Ok(())
    }
}
