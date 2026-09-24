use super::{Harness, InstructionError, InstructionTarget};
use include_dir::{Dir, include_dir};
use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;
use tempfile::NamedTempFile;

pub struct EffectSkill {
    pub root: PathBuf,
    pub harness: Harness,
}

impl EffectSkill {
    const SOURCE: Dir<'static> = include_dir!(
        "$CARGO_MANIFEST_DIR/../../cortex/teams/dev-team/agents/typescript-dev/skills/effect-ts"
    );

    fn files(&self) -> impl Iterator<Item = SkillFile> {
        let directory = match self.harness {
            Harness::Codex | Harness::Cursor => ".agents/skills/effect-ts",
            Harness::Claude => ".claude/skills/effect-ts",
        };
        Self::SOURCE.files().map(move |file| SkillFile {
            target: InstructionTarget {
                root: self.root.clone(),
                relative: PathBuf::from(directory).join(file.path()),
            },
            contents: file.contents(),
        })
    }

    pub fn verify(&self) -> Result<(), InstructionError> {
        self.files().try_for_each(|file| file.verify())
    }

    pub fn install(self) -> Result<(), InstructionError> {
        self.verify()?;
        self.files().try_for_each(|file| file.install())
    }
}

struct SkillFile {
    target: InstructionTarget,
    contents: &'static [u8],
}

impl SkillFile {
    fn verify(&self) -> Result<(), InstructionError> {
        self.target.check_parents()?;
        let path = self.target.path();
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                match fs::read(&path)?.as_slice() {
                    contents if contents == self.contents => Ok(()),
                    _ => Err(InstructionError::Conflict(path)),
                }
            }
            Ok(_) => Err(InstructionError::Conflict(path)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        }
    }

    fn install(self) -> Result<(), InstructionError> {
        self.verify()?;
        let path = self.target.path();
        match fs::symlink_metadata(&path) {
            Ok(_) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                self.target.create_parents()?;
                let parent = path
                    .parent()
                    .ok_or_else(|| InstructionError::Conflict(path.clone()))?;
                let mut staged = NamedTempFile::new_in(parent)?;
                staged.write_all(self.contents)?;
                staged
                    .persist_noclobber(&path)
                    .map_err(|error| error.error)?;
                Ok(())
            }
            Err(error) => Err(error.into()),
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::{EffectSkill, Harness, InstructionError};
    use std::fs;
    use std::os::unix::fs::symlink;
    use std::path::PathBuf;
    use tempfile::tempdir;

    struct SkillExpectation {
        harness: Harness,
        directory: PathBuf,
    }

    #[test]
    fn installs_exact_upstream_files_for_each_harness_and_repeats() -> Result<(), InstructionError>
    {
        for expected in [
            SkillExpectation {
                harness: Harness::Codex,
                directory: PathBuf::from(".agents/skills/effect-ts"),
            },
            SkillExpectation {
                harness: Harness::Cursor,
                directory: PathBuf::from(".agents/skills/effect-ts"),
            },
            SkillExpectation {
                harness: Harness::Claude,
                directory: PathBuf::from(".claude/skills/effect-ts"),
            },
        ] {
            let project = tempdir()?;
            EffectSkill {
                root: project.path().to_owned(),
                harness: expected.harness,
            }
            .install()?;
            EffectSkill {
                root: project.path().to_owned(),
                harness: expected.harness,
            }
            .install()?;
            for source in EffectSkill::SOURCE.files() {
                assert_eq!(
                    fs::read(project.path().join(&expected.directory).join(source.path()))?,
                    source.contents()
                );
            }
        }
        Ok(())
    }

    #[test]
    fn preserves_conflicting_files_and_rejects_links() -> Result<(), InstructionError> {
        let project = tempdir()?;
        let external = tempdir()?;
        let directory = project.path().join(".agents/skills/effect-ts");
        fs::create_dir_all(&directory)?;
        let instructions = directory.join("SKILL.md");
        fs::write(&instructions, "Project-owned Effect guidance")?;
        let skill = EffectSkill {
            root: project.path().to_owned(),
            harness: Harness::Codex,
        };
        assert!(matches!(skill.verify(), Err(InstructionError::Conflict(_))));
        assert!(matches!(
            skill.install(),
            Err(InstructionError::Conflict(_))
        ));
        assert_eq!(
            fs::read_to_string(&instructions)?,
            "Project-owned Effect guidance"
        );
        assert!(!directory.join("LICENSE").exists());

        fs::remove_file(&instructions)?;
        symlink(external.path(), &instructions)?;
        let skill = EffectSkill {
            root: project.path().to_owned(),
            harness: Harness::Codex,
        };
        assert!(matches!(
            skill.install(),
            Err(InstructionError::Conflict(_))
        ));
        fs::remove_file(&instructions)?;
        fs::remove_dir(&directory)?;
        symlink(external.path(), &directory)?;
        let skill = EffectSkill {
            root: project.path().to_owned(),
            harness: Harness::Codex,
        };
        assert!(matches!(
            skill.install(),
            Err(InstructionError::Conflict(_))
        ));
        assert_eq!(fs::read_dir(external.path())?.count(), 0);
        Ok(())
    }
}
