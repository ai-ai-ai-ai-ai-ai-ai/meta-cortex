use super::instructions::PreparedInstructions;
use super::{Harness, InstructionError, InstructionStatus, ProjectHarnesses};
use std::fs;
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

    fn selects_existing_files(self) -> Result<(), InstructionError> {
        let root = self.directory.path();
        fs::write(root.join("AGENTS.md"), "Shared project rules")?;
        fs::write(root.join("AGENTS.override.md"), "")?;
        assert_eq!(
            self.project().target(Harness::Codex)?.path(),
            root.join("AGENTS.md")
        );
        fs::write(root.join("AGENTS.override.md"), "Specific Codex rules")?;
        let codex = self.project().target(Harness::Codex)?;
        assert_eq!(codex.path(), root.join("AGENTS.override.md"));
        PreparedInstructions::read(codex)?.write()?;
        assert_eq!(
            fs::read_to_string(root.join("AGENTS.md"))?,
            "Shared project rules"
        );

        fs::create_dir(root.join(".claude"))?;
        fs::write(root.join(".claude/CLAUDE.md"), "Claude project rules")?;
        let claude = self.project().target(Harness::Claude)?;
        assert_eq!(claude.path(), root.join(".claude/CLAUDE.md"));
        PreparedInstructions::read(claude)?.write()?;
        assert!(!root.join("CLAUDE.md").exists());
        assert!(
            fs::read_to_string(root.join(".claude/CLAUDE.md"))?
                .contains("relative to the project root")
        );

        assert_eq!(
            self.project().target(Harness::Cursor)?.path(),
            root.join("AGENTS.md")
        );
        fs::write(root.join(".cursorrules"), "Existing Cursor rules")?;
        let cursor = self.project().target(Harness::Cursor)?;
        assert_eq!(cursor.path(), root.join(".cursorrules"));
        PreparedInstructions::read(cursor)?.write()?;
        assert!(
            fs::read_to_string(root.join(".cursorrules"))?.starts_with("Existing Cursor rules")
        );
        let statuses = self.project().inspect()?;
        assert!(
            statuses
                .iter()
                .all(|entry| entry.status == InstructionStatus::Connected)
        );
        fs::write(
            root.join("AGENTS.override.md"),
            "---\nmeta-cortex: instructions\n---\nbroken\n---\n",
        )?;
        let statuses = self.project().inspect()?;
        assert_eq!(statuses[0].status, InstructionStatus::Conflict);
        Ok(())
    }
}

#[test]
fn discovers_harness_files_and_reports_actual_connections() -> Result<(), InstructionError> {
    Fixture::create()?.selects_existing_files()
}
