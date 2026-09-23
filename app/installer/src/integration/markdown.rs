use super::document::{CursorApplication, SectionHeader, SectionKind};
use super::{InstructionError, InstructionTarget};
use pulldown_cmark::{Event, LinkType, MetadataBlockKind, Options, Parser, Tag};
use pulldown_cmark_to_cmark::cmark;
use serde::Deserialize;
use serde_saphyr::Options as YamlOptions;

pub struct MarkdownInstructions<'a> {
    pub text: &'a str,
    pub target: &'a InstructionTarget,
}

// Untagged decoding retains YAML types rather than coercing quoted strings to bools.
#[derive(Deserialize)]
#[serde(untagged)]
enum CursorFrontmatter {
    Rule {
        #[serde(rename = "alwaysApply")]
        always_apply: CursorApplication,
    },
}

enum ManagedBlock {
    Absent,
    Present,
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
                Event::Start(_)
                | Event::Code(_)
                | Event::InlineMath(_)
                | Event::DisplayMath(_)
                | Event::Html(_)
                | Event::InlineHtml(_)
                | Event::FootnoteReference(_)
                | Event::SoftBreak
                | Event::HardBreak
                | Event::Rule
                | Event::TaskListMarker(_) => return Self::Absent,
            }
        }
        Self::Absent
    }
}

impl MarkdownInstructions<'_> {
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
        if !matches!(
            metadata,
            CursorFrontmatter::Rule {
                always_apply: CursorApplication::Always
            }
        ) {
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
            event @ (Event::Start(_)
            | Event::End(_)
            | Event::Text(_)
            | Event::Code(_)
            | Event::InlineMath(_)
            | Event::DisplayMath(_)
            | Event::Html(_)
            | Event::InlineHtml(_)
            | Event::FootnoteReference(_)
            | Event::HardBreak
            | Event::Rule
            | Event::TaskListMarker(_)) => event,
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
                    labels.extend(
                        text.lines()
                            .filter(|line| {
                                matches!(
                                    serde_saphyr::from_str::<SectionHeader>(line),
                                    Ok(SectionHeader {
                                        section: SectionKind::Instructions
                                    })
                                )
                            })
                            .map(|_| range.start),
                    );
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
                Event::Start(_)
                | Event::Html(_)
                | Event::InlineHtml(_)
                | Event::End(_)
                | Event::Text(_)
                | Event::InlineMath(_)
                | Event::DisplayMath(_)
                | Event::FootnoteReference(_)
                | Event::SoftBreak
                | Event::HardBreak
                | Event::TaskListMarker(_) => {}
            }
        }
        if labels
            .iter()
            .any(|offset| !sections.iter().any(|range| range.contains(offset)))
        {
            return Err(InstructionError::InvalidEntry(self.target.path()));
        }
        match sections.as_slice() {
            [] => Ok(ManagedBlock::Absent),
            [_] => Ok(ManagedBlock::Present),
            _ => Err(InstructionError::InvalidEntry(self.target.path())),
        }
    }

    pub fn prepare(&self) -> Result<String, InstructionError> {
        match self.managed_block()? {
            ManagedBlock::Present => Ok(self.text.to_owned()),
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
                    ManagedBlock::Absent => Err(InstructionError::InvalidEntry(self.target.path())),
                }
            }
        }
    }
}
#[cfg(test)]
mod tests;
