use std::env;
use std::env::consts::EXE_SUFFIX;
use std::fs;
use std::io::{self, Error, ErrorKind};
use std::path::Path;

/// Import the runner's real native tools into isolated managed installations.
pub struct ManagedTools<'a> {
    pub home: &'a Path,
}

impl ManagedTools<'_> {
    pub fn seed(&self) -> io::Result<()> {
        let search = env::var_os("PATH").ok_or_else(|| Error::other("missing PATH"))?;
        for name in ["mise", "bun", "vale"] {
            let executable = format!("{name}{}", EXE_SUFFIX);
            let source = env::split_paths(&search)
                .map(|directory| directory.join(&executable))
                .find(|candidate| candidate.is_file())
                .ok_or_else(|| {
                    Error::new(
                        ErrorKind::NotFound,
                        format!("missing test tool: {executable}"),
                    )
                })?;
            let directory = self.home.join(name).join("bin");
            fs::create_dir_all(&directory)?;
            fs::copy(source, directory.join(executable))?;
        }
        Ok(())
    }
}
