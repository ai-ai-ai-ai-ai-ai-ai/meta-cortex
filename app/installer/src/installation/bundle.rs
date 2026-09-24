use super::InstallError;
use crate::configuration::ConfigText;
use crate::information::Version;
use include_dir::{Dir, include_dir};
use std::path::{Path, PathBuf};
use std::{fs, io};

pub(super) struct Bundle<'a> {
    pub(super) directory: &'a Dir<'a>,
    pub(super) destination: PathBuf,
}

impl Bundle<'_> {
    pub(super) const FRAMEWORK: Dir<'static> = include_dir!("$META_CORTEX_BUNDLE");
    const LICENSE: &'static [u8] = include_bytes!("../../../../LICENSE");

    pub(super) fn install(self, configuration: ConfigText) -> Result<(), InstallError> {
        // Claim the destination without replacing an existing entry.
        match fs::create_dir(&self.destination) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                self.verify_identity_only()?;
            }
            Err(error) => return Err(error.into()),
        }
        self.directory.extract(&self.destination)?;
        fs::write(self.destination.join("LICENSE"), Self::LICENSE)?;
        fs::write(
            self.destination.join("meta-cortex.toml"),
            configuration.as_bytes(),
        )?;
        fs::write(
            self.destination.join(Version::FILE),
            Version::CURRENT.as_str(),
        )?;
        Ok(())
    }

    // Feature initialization or initialization in a linked worktree can create
    // the shared identity before the framework is installed in the main checkout.
    pub(super) fn verify_identity_only(&self) -> Result<(), InstallError> {
        match fs::symlink_metadata(&self.destination)? {
            metadata if metadata.is_dir() => {}
            _ => return Err(InstallError::Conflict(self.destination.clone())),
        }
        let entries = fs::read_dir(&self.destination)?.collect::<Result<Vec<_>, _>>()?;
        match entries.as_slice() {
            [entry] if entry.file_name() == "repository-id" && entry.file_type()?.is_file() => {
                Ok(())
            }
            _ => Err(InstallError::Conflict(self.destination.clone())),
        }
    }

    pub(super) fn verify(&self) -> Result<(), InstallError> {
        let metadata = Self::required_metadata(&self.destination)?;
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
                    let metadata = Self::required_metadata(&path)?;
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
            let license = self.destination.join("LICENSE");
            let metadata = Self::required_metadata(&license)?;
            if !metadata.is_file()
                || metadata.file_type().is_symlink()
                || fs::read(&license)? != Self::LICENSE
            {
                return Err(InstallError::Conflict(license));
            }
            expected += 1; // LICENSE is distributed beside the framework.
            if Version::read(&self.destination)? != Version::CURRENT {
                return Err(InstallError::Conflict(self.destination.clone()));
            }
            expected += 1;
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
            match (
                self.directory.path().as_os_str().is_empty(),
                entry.file_name(),
            ) {
                (true, name) if name == "repository-id" => match entry.file_type()? {
                    kind if kind.is_file() => continue,
                    _ => return Err(InstallError::Conflict(entry.path())),
                },
                _ => {}
            }
            actual += 1;
        }
        if actual != expected {
            return Err(InstallError::Conflict(self.destination.clone()));
        }
        Ok(())
    }

    fn required_metadata(path: &Path) -> Result<fs::Metadata, InstallError> {
        fs::symlink_metadata(path).map_err(|source| {
            if source.kind() == io::ErrorKind::NotFound {
                InstallError::MissingFrameworkEntry {
                    path: path.to_path_buf(),
                    source,
                }
            } else {
                InstallError::Io(source)
            }
        })
    }
}
