use super::{InstructionError, InstructionStatus, PreparedInstructions};
use crate::integration::{Harness, ProjectHarnesses};
use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use tempfile::{TempDir, tempdir};

struct Fixture {
    directory: TempDir,
}

impl Fixture {
    fn create() -> Result<Self, InstructionError> {
        Ok(Self {
            directory: tempdir()?,
        })
    }
    fn project(&self) -> ProjectHarnesses {
        ProjectHarnesses {
            root: self.directory.path().to_path_buf(),
        }
    }

    fn preserves_existing_instructions(self) -> Result<(), InstructionError> {
        let path = self.directory.path().join("AGENTS.md");
        fs::write(
            &path,
            "# Project instructions\nDo not change my build steps.\n",
        )?;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o640))?;
        let target = self.project().target(Harness::Codex)?;
        let prepared = PreparedInstructions::read(target.clone())?;
        assert_eq!(prepared.status(), InstructionStatus::Missing);
        prepared.write()?;
        let first = fs::read(&path)?;
        assert!(first.starts_with(b"# Project instructions\nDo not change my build steps.\n"));
        assert_eq!(fs::metadata(&path)?.permissions().mode() & 0o777, 0o640);
        let repeated = PreparedInstructions::read(target)?;
        assert_eq!(repeated.status(), InstructionStatus::Connected);
        repeated.write()?;
        assert_eq!(fs::read(&path)?, first);
        Ok(())
    }

    fn rejects_conflicting_edits(self) -> Result<(), InstructionError> {
        let target = self.project().target(Harness::Codex)?;
        let path = target.path();
        let prepared = PreparedInstructions::read(target.clone())?;
        fs::write(&path, "User wrote this after preparation")?;
        assert!(matches!(
            prepared.write(),
            Err(InstructionError::Conflict(_))
        ));
        assert_eq!(
            fs::read_to_string(&path)?,
            "User wrote this after preparation"
        );
        for invalid in [
            b"---\nmeta-cortex: instructions\n---\n".as_slice(),
            b"meta-cortex: instructions\n".as_slice(),
            b"---\nmeta-cortex: instructions\n---\nedited\n---\n".as_slice(),
            &[0xff],
        ] {
            fs::write(&path, invalid)?;
            assert!(matches!(
                PreparedInstructions::read(target.clone()),
                Err(InstructionError::InvalidEntry(_))
            ));
            assert_eq!(fs::read(&path)?, invalid);
        }
        Ok(())
    }

    fn creates_and_validates_cursor_rule(self) -> Result<(), InstructionError> {
        let target = self.project().target(Harness::Cursor)?;
        assert!(target.path().ends_with(".cursor/rules/meta-cortex.mdc"));
        let prepared = PreparedInstructions::read(target.clone())?;
        assert!(!self.directory.path().join(".cursor").exists());
        prepared.write()?;
        let contents = fs::read_to_string(target.path())?;
        assert!(contents.starts_with("---\nalwaysApply: true\n---"));
        assert!(contents.contains(&target.entry()?));
        PreparedInstructions::read(target.clone())?.write()?;
        assert_eq!(fs::read_to_string(target.path())?, contents);
        fs::write(
            target.path(),
            "---\nalwaysApply: false\n---\nMy custom rule",
        )?;
        assert!(matches!(
            PreparedInstructions::read(target),
            Err(InstructionError::InvalidEntry(_))
        ));
        Ok(())
    }

    fn rejects_symlinked_files_and_parents(self) -> Result<(), InstructionError> {
        let external = tempdir()?;
        let original = external.path().join("AGENTS.md");
        fs::write(&original, "External instructions")?;
        let target = self.project().target(Harness::Codex)?;
        symlink(&original, target.path())?;
        assert!(matches!(
            PreparedInstructions::read(target),
            Err(InstructionError::Conflict(_))
        ));
        fs::remove_file(self.directory.path().join("AGENTS.md"))?;
        // The parent directory must not be traversed either during reading or writing.
        let cursor = self.project().target(Harness::Cursor)?;
        let prepared = PreparedInstructions::read(cursor.clone())?;
        symlink(external.path(), self.directory.path().join(".cursor"))?;
        assert!(matches!(
            prepared.write(),
            Err(InstructionError::Conflict(_))
        ));
        assert!(matches!(
            PreparedInstructions::read(cursor),
            Err(InstructionError::Conflict(_))
        ));
        assert!(!external.path().join("rules").exists());
        assert_eq!(fs::read_to_string(original)?, "External instructions");
        Ok(())
    }
}

#[test]
fn preserves_contents_permissions_and_idempotence() -> Result<(), InstructionError> {
    Fixture::create()?.preserves_existing_instructions()
}
#[test]
fn refuses_stale_snapshots_and_malformed_blocks() -> Result<(), InstructionError> {
    Fixture::create()?.rejects_conflicting_edits()
}
#[test]
fn cursor_rule_is_always_applied_and_not_overwritten() -> Result<(), InstructionError> {
    Fixture::create()?.creates_and_validates_cursor_rule()
}
#[test]
fn refuses_symlinked_instructions_and_parent_directories() -> Result<(), InstructionError> {
    Fixture::create()?.rejects_symlinked_files_and_parents()
}
