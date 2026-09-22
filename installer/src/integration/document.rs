use super::{InstructionError, InstructionTarget};
use pulldown_cmark::{Event, LinkType, MetadataBlockKind, Tag, TagEnd};
use pulldown_cmark_to_cmark::cmark;
use serde::{Deserialize, Serialize, Serializer};

#[derive(Serialize, Deserialize)]
pub struct SectionHeader {
    #[serde(rename = "meta-cortex", default)]
    pub section: SectionKind,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SectionKind {
    #[default]
    Unrelated,
    Instructions,
}

#[derive(Serialize)]
pub struct CursorHeader {
    #[serde(rename = "alwaysApply")]
    pub always_apply: CursorApplication,
}

#[derive(Deserialize)]
#[serde(from = "bool")]
pub enum CursorApplication {
    Always,
    Conditional,
}

impl From<bool> for CursorApplication {
    fn from(always_apply: bool) -> Self {
        if always_apply {
            Self::Always
        } else {
            Self::Conditional
        }
    }
}

impl Serialize for CursorApplication {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bool(matches!(self, Self::Always))
    }
}

impl SectionHeader {
    pub fn events(&self) -> Result<Vec<Event<'static>>, InstructionError> {
        let yaml = serde_saphyr::to_string(self)?;
        Ok(vec![
            Event::Start(Tag::MetadataBlock(MetadataBlockKind::YamlStyle)),
            Event::Text(yaml.into()),
            Event::End(TagEnd::MetadataBlock(MetadataBlockKind::YamlStyle)),
        ])
    }
}

impl CursorHeader {
    pub fn render(&self) -> Result<String, InstructionError> {
        let yaml = serde_saphyr::to_string(self)?;
        let mut output = String::new();
        cmark(
            [
                Event::Start(Tag::MetadataBlock(MetadataBlockKind::YamlStyle)),
                Event::Text(yaml.into()),
                Event::End(TagEnd::MetadataBlock(MetadataBlockKind::YamlStyle)),
            ]
            .into_iter(),
            &mut output,
        )?;
        output.push('\n');
        Ok(output)
    }
}

impl InstructionTarget {
    const FRAMEWORK_ENTRY: &'static str = ".meta-cortex/AGENTS.md";

    pub fn body_events(&self) -> Vec<Event<'static>> {
        let mut events = vec![
            Event::Start(Tag::Paragraph),
            Event::Text("Read and follow ".into()),
        ];
        if self.relative.components().count() == 1 {
            events.extend([
                Event::Start(Tag::Link {
                    link_type: LinkType::Inline,
                    dest_url: Self::FRAMEWORK_ENTRY.into(),
                    title: "".into(),
                    id: "".into(),
                }),
                Event::Text(Self::FRAMEWORK_ENTRY.into()),
                Event::End(TagEnd::Link),
                Event::Text(".".into()),
            ]);
        } else {
            events.extend([
                Event::Text("the project's ".into()),
                Event::Code(Self::FRAMEWORK_ENTRY.into()),
                Event::Text(" (relative to the project root).".into()),
            ]);
        }
        events.push(Event::End(TagEnd::Paragraph));
        events
    }

    pub fn entry(&self) -> Result<String, InstructionError> {
        let mut events = SectionHeader {
            section: SectionKind::Instructions,
        }
        .events()?;
        events.extend(self.body_events());
        events.push(Event::Rule);
        let mut output = String::new();
        cmark(events.into_iter(), &mut output)?;
        Ok(output)
    }
}
