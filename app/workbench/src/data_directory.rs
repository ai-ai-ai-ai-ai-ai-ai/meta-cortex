use derive_more::From;
use std::env;
use std::io;
use std::path::{Path, PathBuf, absolute};

/// User-owned application storage, separate from Git and project files.
#[derive(Clone, From)]
pub struct DataDirectory(PathBuf);

impl DataDirectory {
    pub fn discover() -> io::Result<Self> {
        let path = match env::var_os("META_CORTEX_HOME") {
            Some(path) if !path.is_empty() => PathBuf::from(path),
            Some(_) | None => env::home_dir()
                .ok_or_else(|| io::Error::other("cannot find home; set META_CORTEX_HOME"))?
                .join(".meta-cortex"),
        };
        Ok(Self(absolute(path)?))
    }

    pub fn path(&self) -> &Path {
        &self.0
    }
}
