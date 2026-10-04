use super::{GuideError, GuideSection};
use crate::agents::AgentId;
use crate::values::Note;
use pulldown_cmark::{Event, HeadingLevel, Parser, Tag, TagEnd};

pub(super) struct Selection<'a> {
    pub agent: AgentId,
    pub markdown: &'a str,
    pub section: GuideSection,
}
enum Location {
    Searching,
    Heading { title: String },
    Body { start: usize },
}
pub(super) fn extract(input: Selection<'_>) -> Result<Note, GuideError> {
    let mut location = Location::Searching;
    for (event, range) in Parser::new(input.markdown).into_offset_iter() {
        location = match (location, event) {
            (
                Location::Body { start },
                Event::Start(Tag::Heading {
                    level: HeadingLevel::H1 | HeadingLevel::H2,
                    ..
                }),
            ) => {
                return content(Content {
                    input,
                    start,
                    end: range.start,
                });
            }
            (
                Location::Searching,
                Event::Start(Tag::Heading {
                    level: HeadingLevel::H2,
                    ..
                }),
            ) => Location::Heading {
                title: String::new(),
            },
            (Location::Heading { mut title }, Event::Text(text) | Event::Code(text)) => {
                title.push_str(&text);
                Location::Heading { title }
            }
            (Location::Heading { title }, Event::End(TagEnd::Heading(HeadingLevel::H2)))
                if title == input.section.title() =>
            {
                Location::Body { start: range.end }
            }
            (Location::Heading { .. }, Event::End(TagEnd::Heading(HeadingLevel::H2))) => {
                Location::Searching
            }
            (location, _) => location,
        };
    }
    match location {
        Location::Body { start } => {
            let end = input.markdown.len();
            content(Content { input, start, end })
        }
        Location::Searching | Location::Heading { .. } => Err(GuideError {
            agent: input.agent,
            section: input.section,
        }),
    }
}
struct Content<'a> {
    input: Selection<'a>,
    start: usize,
    end: usize,
}
fn content(source: Content<'_>) -> Result<Note, GuideError> {
    match source.input.markdown[source.start..source.end].trim() {
        "" => Err(GuideError {
            agent: source.input.agent,
            section: source.input.section,
        }),
        text => Ok(Note::from(text.to_owned())),
    }
}

pub(super) fn label(input: Selection<'_>) -> Result<Note, GuideError> {
    let mut location = Location::Searching;
    for event in Parser::new(input.markdown) {
        location = match (location, event) {
            (
                Location::Searching,
                Event::Start(Tag::Heading {
                    level: HeadingLevel::H1,
                    ..
                }),
            ) => Location::Heading {
                title: String::new(),
            },
            (Location::Heading { mut title }, Event::Text(text) | Event::Code(text)) => {
                title.push_str(&text);
                Location::Heading { title }
            }
            (Location::Heading { title }, Event::End(TagEnd::Heading(HeadingLevel::H1)))
                if !title.trim().is_empty() =>
            {
                return Ok(Note::from(title));
            }
            (location, _) => location,
        };
    }
    Err(GuideError {
        agent: input.agent,
        section: input.section,
    })
}

#[cfg(test)]
mod tests {
    use super::{GuideSection, Selection, extract, label};
    use crate::agents::{AgentId, GizmoAgent};
    use crate::values::Note;
    #[test]
    fn named_sections_preserve_markdown_and_stop_at_peer_headings() -> anyhow::Result<()> {
        let markdown = "# **Coordinator**\n\n## Responsibility\nOwn [work](work.md).\n\n### Details\nKeep this.\n\n## Handoff\nReturn evidence.\n\n## Skills\nExclude this.";
        let agent = AgentId::Gizmo(GizmoAgent::Gizmo);
        assert_eq!(
            label(Selection {
                agent,
                markdown,
                section: GuideSection::Whole
            })?,
            Note::from("Coordinator".to_owned())
        );
        assert_eq!(
            extract(Selection {
                agent,
                markdown,
                section: GuideSection::Responsibility
            })?,
            Note::from("Own [work](work.md).\n\n### Details\nKeep this.".to_owned())
        );
        assert_eq!(
            extract(Selection {
                agent,
                markdown,
                section: GuideSection::Handoff
            })?,
            Note::from("Return evidence.".to_owned())
        );
        Ok(())
    }
    #[test]
    fn missing_or_empty_sections_report_the_role_and_section() -> anyhow::Result<()> {
        let agent = AgentId::Gizmo(GizmoAgent::GizmoPrime);
        for markdown in [
            "# Role\n## Other\nOther",
            "# Role\n## Handoff\n",
            "# Role\n## Handoff\n## Next\nOther",
        ] {
            let error = match extract(Selection {
                agent,
                markdown,
                section: GuideSection::Handoff,
            }) {
                Err(error) => error,
                Ok(_) => anyhow::bail!("invalid section accepted"),
            };
            assert_eq!(error.agent, agent);
            assert_eq!(error.section, GuideSection::Handoff);
        }
        assert!(
            label(Selection {
                agent,
                markdown: "## Not a role title",
                section: GuideSection::Whole
            })
            .is_err()
        );
        assert!(
            extract(Selection {
                agent,
                markdown: "## Handoff\nLast section",
                section: GuideSection::Handoff
            })
            .is_ok()
        );
        Ok(())
    }
}
