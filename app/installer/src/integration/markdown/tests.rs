use super::{InstructionError, MarkdownInstructions};
use crate::integration::{Harness, ProjectHarnesses};
use tempfile::{TempDir, tempdir};

struct Fixture {
    root: TempDir,
}

impl Fixture {
    fn create() -> Result<Self, InstructionError> {
        Ok(Self { root: tempdir()? })
    }

    fn preserves_examples(self) -> Result<(), InstructionError> {
        let target = ProjectHarnesses {
            root: self.root.path().to_path_buf(),
        }
        .target(Harness::Codex)?;
        let example = target.entry()?;
        for text in [
            format!("# 雪\r\n```md\n{example}\n```\n"),
            "Example: `meta-cortex: instructions`\n".to_owned(),
            format!("    {}\n", example.replace('\n', "\n    ")),
            format!(
                "---\nexample: |\n  {}\n---\n",
                example.replace('\n', "\n  ")
            ),
        ] {
            let prepared = MarkdownInstructions {
                text: &text,
                target: &target,
            }
            .prepare()?;
            assert!(prepared.starts_with(&text));
            assert!(prepared.ends_with(&format!("{example}\n")));
            assert!(prepared.len() > text.len());
            assert_eq!(
                MarkdownInstructions {
                    text: &prepared,
                    target: &target
                }
                .prepare()?,
                prepared
            );
        }
        for text in [
            format!("{example}\n{example}"),
            "```md\nunclosed".to_owned(),
        ] {
            assert!(
                MarkdownInstructions {
                    text: &text,
                    target: &target
                }
                .prepare()
                .is_err()
            );
        }
        Ok(())
    }

    fn preserves_sections_and_surroundings(self) -> Result<(), InstructionError> {
        for harness in [Harness::Codex, Harness::Cursor] {
            let target = ProjectHarnesses {
                root: self.root.path().to_path_buf(),
            }
            .target(harness)?;
            let entry = target.entry()?;
            let prefix = "# User rules\n\n---\n\nKeep this separator.\n\n";
            let suffix = "\n\n## More guidance\nKeep this too.\n";
            let original = format!("{prefix}{entry}{suffix}");
            let updated = MarkdownInstructions {
                text: &original,
                target: &target,
            }
            .prepare()?;
            assert_eq!(updated, format!("{prefix}{}{suffix}", target.entry()?));
            assert!(!updated.contains("<!--"));
            assert_eq!(
                MarkdownInstructions {
                    text: &updated,
                    target: &target
                }
                .prepare()?,
                updated
            );
            let crlf = updated.replace('\n', "\r\n");
            assert_eq!(
                MarkdownInstructions {
                    text: &crlf,
                    target: &target
                }
                .prepare()?,
                crlf
            );
            for broken in [
                format!("{original}\n{}", target.entry()?),
                target.entry()?.replace("Read and follow", "Changed"),
                format!("{}broken", target.entry()?),
                "雪\nmeta-cortex: instructions\n".to_owned(),
            ] {
                assert!(
                    MarkdownInstructions {
                        text: &broken,
                        target: &target
                    }
                    .prepare()
                    .is_err()
                );
            }
        }
        Ok(())
    }

    fn accepts_equivalent_sections(self) -> Result<(), InstructionError> {
        let target = ProjectHarnesses {
            root: self.root.path().to_path_buf(),
        }
        .target(Harness::Codex)?;
        for text in [
            "---\n# Managed header\n'meta-cortex': \"instructions\"\n---\n\nRead and follow\n[.meta-cortex/AGENTS.md](<.meta-cortex/AGENTS.md>).\n\n***\n",
            "# User rules\n\n---\nmeta-cortex: instructions # Keep this comment\n---\n\nRead and follow [.meta-cortex/AGENTS.md](.meta-cortex/AGENTS.md).\n\n---\n\n## Other rules\nKeep these.\n",
        ] {
            assert_eq!(
                MarkdownInstructions {
                    text,
                    target: &target
                }
                .prepare()?,
                text
            );
        }
        Ok(())
    }

    fn parses_cursor_yaml(self) -> Result<(), InstructionError> {
        let target = ProjectHarnesses {
            root: self.root.path().to_path_buf(),
        }
        .target(Harness::Cursor)?;
        let text = "---\r\ndescription: 'Project rules'\r\n# Keep this comment\r\nalwaysApply: true\r\nglobs: []\r\n---\r\n# Instructions\r\n";
        let document = MarkdownInstructions {
            text,
            target: &target,
        };
        document.validate_cursor()?;
        assert!(document.prepare()?.starts_with(text));
        for text in [
            "---\nalwaysApply: false\n---\n",
            "---\nalwaysApply: 'true'\n---\n",
            "---\ndescription: Missing flag\n---\n",
            "---\nalwaysApply: [broken\n---\n",
            "---\nalwaysApply: true\n",
            "# No frontmatter\n",
        ] {
            assert!(
                MarkdownInstructions {
                    text,
                    target: &target
                }
                .validate_cursor()
                .is_err(),
                "{text}"
            );
        }
        Ok(())
    }
}

#[test]
fn markers_in_examples_are_not_managed_instructions() -> Result<(), InstructionError> {
    Fixture::create()?.preserves_examples()
}

#[test]
fn yaml_sections_preserve_surroundings() -> Result<(), InstructionError> {
    Fixture::create()?.preserves_sections_and_surroundings()
}

#[test]
fn equivalent_yaml_and_markdown_are_preserved() -> Result<(), InstructionError> {
    Fixture::create()?.accepts_equivalent_sections()
}

#[test]
fn cursor_yaml_is_parsed_without_reformatting() -> Result<(), InstructionError> {
    Fixture::create()?.parses_cursor_yaml()
}
