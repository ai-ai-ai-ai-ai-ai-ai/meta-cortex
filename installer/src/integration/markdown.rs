use super::document::{SectionHeader, SectionKind};
use super::{InstructionError, InstructionTarget};
use pulldown_cmark::{Event, LinkType, MetadataBlockKind, Options, Parser, Tag};
use pulldown_cmark_to_cmark::cmark;
use serde_saphyr::Options as YamlOptions;
use std::ops::Range;

pub struct MarkdownInstructions<'a> {
    pub text: &'a str,
    pub target: &'a InstructionTarget,
}

// Untagged decoding retains YAML types rather than coercing quoted strings to bools.
// Derives emit sibling implementations using Option. Keep authored types denied.
#[allow(
    clippy::disallowed_types,
    reason = "Serde generates Option internally; authored declarations deny this lint"
)]
mod cursor {
    use serde::Deserialize;

    #[deny(clippy::disallowed_types)]
    #[derive(Deserialize)]
    #[serde(untagged)]
    pub(super) enum CursorFrontmatter {
        Rule {
            #[serde(rename = "alwaysApply")]
            always_apply: bool,
        },
    }
}

use cursor::CursorFrontmatter;

enum ManagedBlock {
    Absent,
    Present,
    Legacy(Range<usize>),
}

enum Frontmatter {
    Absent,
    Present { yaml: String, body_offset: usize },
}

impl Frontmatter {
    fn parse(text: &str) -> Self {
        let mut events =
            Parser::new_ext(text, Options::ENABLE_YAML_STYLE_METADATA_BLOCKS).into_offset_iter();
        if !matches!(
            events.next(),
            Some((
                Event::Start(Tag::MetadataBlock(MetadataBlockKind::YamlStyle)),
                _
            ))
        ) {
            return Self::Absent;
        }
        let mut yaml = String::new();
        for (event, range) in events {
            match event {
                Event::Text(text) => yaml.push_str(&text),
                Event::End(_) => {
                    return Self::Present {
                        yaml,
                        body_offset: range.end,
                    };
                }
                _ => return Self::Absent,
            }
        }
        Self::Absent
    }
}

impl MarkdownInstructions<'_> {
    const START: &'static str = "<!-- meta-cortex:start -->";
    const END: &'static str = "<!-- meta-cortex:end -->";

    fn parser(&self) -> Parser<'_> {
        Parser::new_ext(self.text, Options::ENABLE_YAML_STYLE_METADATA_BLOCKS)
    }

    pub fn validate_cursor(&self) -> Result<(), InstructionError> {
        let Frontmatter::Present { yaml, .. } = Frontmatter::parse(self.text) else {
            return Err(InstructionError::InvalidEntry(self.target.path()));
        };
        let mut options = YamlOptions::default();
        options.strict_booleans = true;
        let metadata: CursorFrontmatter = serde_saphyr::from_str_with_options(&yaml, options)
            .map_err(|_| InstructionError::InvalidEntry(self.target.path()))?;
        if !matches!(metadata, CursorFrontmatter::Rule { always_apply: true }) {
            return Err(InstructionError::InvalidEntry(self.target.path()));
        }
        Ok(())
    }

    fn validate_body(&self, body: &str) -> Result<(), InstructionError> {
        let events = Parser::new(body).map(|event| match event {
            Event::SoftBreak => Event::Text(" ".into()),
            Event::Start(Tag::Link {
                dest_url, title, ..
            }) => Event::Start(Tag::Link {
                link_type: LinkType::Inline,
                dest_url,
                title,
                id: "".into(),
            }),
            event => event,
        });
        let mut actual = String::new();
        cmark(events, &mut actual)?;
        let mut expected = String::new();
        cmark(self.target.body_events().into_iter(), &mut expected)?;
        if actual.trim() != expected.trim() {
            return Err(InstructionError::InvalidEntry(self.target.path()));
        }
        Ok(())
    }

    fn managed_block(&self) -> Result<ManagedBlock, InstructionError> {
        let mut legacy = Vec::new();
        let mut sections = Vec::new();
        let mut excluded = Vec::new();
        let mut labels = Vec::new();
        for (event, range) in self.parser().into_offset_iter() {
            match event {
                Event::Start(Tag::CodeBlock(_)) | Event::Code(_) => excluded.push(range),
                Event::Text(text)
                    if !excluded
                        .iter()
                        .any(|excluded| excluded.contains(&range.start)) =>
                {
                    for line in text.lines() {
                        if matches!(
                            serde_saphyr::from_str::<SectionHeader>(line),
                            Ok(SectionHeader {
                                section: SectionKind::Instructions
                            })
                        ) {
                            labels.push(range.start);
                        }
                    }
                }
                Event::Start(Tag::MetadataBlock(_)) | Event::Rule => {
                    if matches!(event, Event::Start(Tag::MetadataBlock(_))) {
                        excluded.push(range.clone());
                    }
                    let Frontmatter::Present { yaml, body_offset } =
                        Frontmatter::parse(&self.text[range.start..])
                    else {
                        continue;
                    };
                    let header = match serde_saphyr::from_str::<SectionHeader>(&yaml) {
                        Ok(header) => header,
                        Err(_) if yaml.contains("meta-cortex") => {
                            return Err(InstructionError::InvalidEntry(self.target.path()));
                        }
                        Err(_) => continue,
                    };
                    if matches!(header.section, SectionKind::Unrelated) {
                        continue;
                    }
                    let body_start = range.start + body_offset;
                    let closing = Parser::new(&self.text[body_start..])
                        .into_offset_iter()
                        .find_map(|(event, range)| matches!(event, Event::Rule).then_some(range))
                        .ok_or_else(|| InstructionError::InvalidEntry(self.target.path()))?;
                    self.validate_body(&self.text[body_start..body_start + closing.start])?;
                    sections.push(range.start..body_start + closing.end);
                }
                Event::Html(_) | Event::InlineHtml(_) => {
                    for marker in [Self::START, Self::END] {
                        for (offset, _) in self.text[range.clone()].match_indices(marker) {
                            legacy.push((marker, range.start + offset));
                        }
                    }
                }
                _ => {}
            }
        }
        if labels
            .iter()
            .any(|offset| !sections.iter().any(|range| range.contains(offset)))
        {
            return Err(InstructionError::InvalidEntry(self.target.path()));
        }
        legacy.sort_by_key(|(_, offset)| *offset);
        match (sections.as_slice(), legacy.as_slice()) {
            ([], []) => Ok(ManagedBlock::Absent),
            ([_], []) => Ok(ManagedBlock::Present),
            ([], [(Self::START, start), (Self::END, end)]) if start < end => {
                self.validate_body(&self.text[start + Self::START.len()..*end])?;
                Ok(ManagedBlock::Legacy(*start..end + Self::END.len()))
            }
            _ => Err(InstructionError::InvalidEntry(self.target.path())),
        }
    }

    pub fn prepare(&self) -> Result<String, InstructionError> {
        match self.managed_block()? {
            ManagedBlock::Present => Ok(self.text.to_owned()),
            ManagedBlock::Legacy(range) => {
                let mut contents = self.text.to_owned();
                contents.replace_range(range, &self.target.entry()?);
                Ok(contents)
            }
            ManagedBlock::Absent => {
                let contents = format!(
                    "{}{}{}\n",
                    self.text,
                    if self.text.is_empty() { "" } else { "\n\n" },
                    self.target.entry()?
                );
                let appended = MarkdownInstructions {
                    text: &contents,
                    target: self.target,
                };
                match appended.managed_block()? {
                    ManagedBlock::Present => Ok(contents),
                    _ => Err(InstructionError::InvalidEntry(self.target.path())),
                }
            }
        }
    }
}
#[cfg(test)]
mod tests {
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
                "Example: `<!-- meta-cortex:start -->` and `<!-- meta-cortex:end -->`\n".to_owned(),
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
                "<!-- meta-cortex:end -->\n<!-- meta-cortex:start -->".to_owned(),
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

        fn migrates_legacy_blocks(self) -> Result<(), InstructionError> {
            for harness in [Harness::Codex, Harness::Cursor] {
                let target = ProjectHarnesses {
                    root: self.root.path().to_path_buf(),
                }
                .target(harness)?;
                let entry = target.entry()?;
                let body = entry
                    .trim_start_matches("---\nmeta-cortex: instructions\n---")
                    .trim_end_matches("---")
                    .trim();
                let prefix = "# User rules\n\n---\n\nKeep this separator.\n\n";
                let suffix = "\n\n## More guidance\nKeep this too.\n";
                let old = format!(
                    "{prefix}<!-- meta-cortex:start -->\n{body}\n<!-- meta-cortex:end -->{suffix}"
                );
                let updated = MarkdownInstructions {
                    text: &old,
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
                    format!("{old}\n{}", target.entry()?),
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
    fn yaml_sections_replace_legacy_blocks_and_preserve_surroundings()
    -> Result<(), InstructionError> {
        Fixture::create()?.migrates_legacy_blocks()
    }

    #[test]
    fn equivalent_yaml_and_markdown_are_preserved() -> Result<(), InstructionError> {
        Fixture::create()?.accepts_equivalent_sections()
    }

    #[test]
    fn cursor_yaml_is_parsed_without_reformatting() -> Result<(), InstructionError> {
        Fixture::create()?.parses_cursor_yaml()
    }
}
