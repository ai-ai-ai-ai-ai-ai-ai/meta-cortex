//! Static framework guide embedded in the executable, independent of ledger access.
mod sections;
mod sources;
use crate::agents::{AgentId, AiAgent, DevelopmentAgent, GizmoAgent, ReportingTarget};
use crate::values::Note;
use schemars::JsonSchema;
use serde::Serialize;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Serialize, JsonSchema)]
pub struct AgentGuide {
    pub teams: Vec<GuideTeam>,
    pub agents: Vec<GuideAgent>,
    pub reviews: Vec<ReviewViaGizmo>,
    pub documents: Vec<GuideDocument>,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct GuideTeam {
    pub team: GuideTeamId,
    pub agents: Vec<AgentId>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub enum GuideTeamId {
    Gizmo,
    Development,
    Ai,
    Security,
    Sre,
    Delivery,
}
impl From<AgentId> for GuideTeamId {
    fn from(agent: AgentId) -> Self {
        match agent {
            AgentId::Gizmo(_) => Self::Gizmo,
            AgentId::Development(_) => Self::Development,
            AgentId::Ai(_) => Self::Ai,
            AgentId::Security(_) => Self::Security,
            AgentId::Sre(_) => Self::Sre,
            AgentId::Delivery(_) => Self::Delivery,
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct GuideAgent {
    pub label: Note,
    pub agent: AgentId,
    pub reports_to: ReportingTarget,
    pub responsibility: Note,
    pub handoff: Note,
    pub source: GuideSource,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(tag = "kind")]
pub enum GuideDocumentId {
    Agent { agent: AgentId },
    Protocol { protocol: GuideProtocol },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub enum GuideProtocol {
    Communication,
    Coordination,
    Verification,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub enum GuideSection {
    Whole,
    Responsibility,
    Handoff,
}
impl GuideSection {
    fn title(self) -> &'static str {
        match self {
            Self::Whole => "",
            Self::Responsibility => "Responsibility",
            Self::Handoff => "Handoff",
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct GuideSource {
    pub document: GuideDocumentId,
    pub section: GuideSection,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct GuideDocument {
    pub id: GuideDocumentId,
    pub path: PathBuf,
    pub markdown: Note,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct ReviewViaGizmo {
    pub author: AgentId,
    pub reviewer: AgentId,
    pub coordinator: GizmoAgent,
}
#[derive(Debug, Error)]
#[error("embedded role {agent} lacks a nonempty {section:?} section")]
pub struct GuideError {
    pub agent: AgentId,
    pub section: GuideSection,
}
impl AgentGuide {
    pub fn embedded() -> Result<Self, GuideError> {
        let mut agents = Vec::new();
        let mut documents = Vec::new();
        for agent in sources::AGENTS {
            let document = sources::role(agent);
            let markdown = String::from(document.markdown.clone());
            agents.push(GuideAgent {
                label: sections::label(sections::Selection {
                    agent,
                    markdown: &markdown,
                    section: GuideSection::Whole,
                })?,
                agent,
                reports_to: agent.reports_to(),
                responsibility: sections::extract(sections::Selection {
                    agent,
                    markdown: &markdown,
                    section: GuideSection::Responsibility,
                })?,
                handoff: sections::extract(sections::Selection {
                    agent,
                    markdown: &markdown,
                    section: GuideSection::Handoff,
                })?,
                source: GuideSource {
                    document: document.id,
                    section: GuideSection::Whole,
                },
            });
            documents.push(document);
        }
        for protocol in [
            GuideProtocol::Communication,
            GuideProtocol::Coordination,
            GuideProtocol::Verification,
        ] {
            documents.push(sources::protocol(protocol));
        }
        let teams = [
            GuideTeamId::Gizmo,
            GuideTeamId::Development,
            GuideTeamId::Ai,
            GuideTeamId::Security,
            GuideTeamId::Sre,
            GuideTeamId::Delivery,
        ]
        .into_iter()
        .map(|team| GuideTeam {
            team,
            agents: sources::AGENTS
                .into_iter()
                .filter(|agent| GuideTeamId::from(*agent) == team)
                .collect(),
        })
        .collect();
        let reviews = [
            (
                AgentId::Development(DevelopmentAgent::RustDev),
                AgentId::Development(DevelopmentAgent::RustVerifier),
            ),
            (
                AgentId::Development(DevelopmentAgent::RustRefactoring),
                AgentId::Development(DevelopmentAgent::RustVerifier),
            ),
            (
                AgentId::Development(DevelopmentAgent::TypescriptDev),
                AgentId::Development(DevelopmentAgent::TypescriptVerifier),
            ),
            (
                AgentId::Ai(AiAgent::TechWriter),
                AgentId::Ai(AiAgent::TechWriterVerifier),
            ),
        ]
        .into_iter()
        .map(|(author, reviewer)| ReviewViaGizmo {
            author,
            reviewer,
            coordinator: GizmoAgent::Gizmo,
        })
        .collect();
        Ok(Self {
            teams,
            agents,
            reviews,
            documents,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentGuide, GuideDocumentId, sources};
    use crate::agents::{AgentId, AiAgent, DevelopmentAgent, GizmoAgent, ReportingTarget};
    use std::collections::BTreeSet;
    #[test]
    fn embedded_guide_covers_all_roles_and_preserves_reporting_and_sources() -> anyhow::Result<()> {
        let guide = AgentGuide::embedded()?;
        assert_eq!(guide.agents.len(), 16);
        assert_eq!(guide.teams.len(), 6);
        assert_eq!(guide.documents.len(), 19);
        assert_eq!(
            guide
                .agents
                .iter()
                .map(|entry| entry.agent)
                .collect::<BTreeSet<_>>(),
            sources::AGENTS.into_iter().collect()
        );
        assert_eq!(
            guide
                .teams
                .iter()
                .flat_map(|team| team.agents.iter().copied())
                .collect::<BTreeSet<_>>(),
            sources::AGENTS.into_iter().collect()
        );
        for entry in &guide.agents {
            assert_eq!(entry.reports_to, entry.agent.reports_to());
            let document = guide
                .documents
                .iter()
                .find(|document| document.id == GuideDocumentId::Agent { agent: entry.agent })
                .ok_or_else(|| anyhow::anyhow!("missing role source"))?;
            assert_eq!(document.path, entry.agent.instructions_path());
            assert!(
                String::from(document.markdown.clone())
                    .contains(&String::from(entry.responsibility.clone()))
            );
            assert!(
                String::from(document.markdown.clone())
                    .contains(&String::from(entry.handoff.clone()))
            );
        }
        assert_eq!(
            AgentId::Gizmo(GizmoAgent::GizmoPrime).reports_to(),
            ReportingTarget::Host
        );
        Ok(())
    }
    #[test]
    fn review_routes_match_catalog_pairs_and_always_go_via_gizmo() -> anyhow::Result<()> {
        let guide = AgentGuide::embedded()?;
        let expected = [
            (
                AgentId::Development(DevelopmentAgent::RustDev),
                AgentId::Development(DevelopmentAgent::RustVerifier),
            ),
            (
                AgentId::Development(DevelopmentAgent::RustRefactoring),
                AgentId::Development(DevelopmentAgent::RustVerifier),
            ),
            (
                AgentId::Development(DevelopmentAgent::TypescriptDev),
                AgentId::Development(DevelopmentAgent::TypescriptVerifier),
            ),
            (
                AgentId::Ai(AiAgent::TechWriter),
                AgentId::Ai(AiAgent::TechWriterVerifier),
            ),
        ];
        assert_eq!(
            guide
                .reviews
                .iter()
                .map(|route| (route.author, route.reviewer))
                .collect::<Vec<_>>(),
            expected
        );
        assert!(
            guide
                .reviews
                .iter()
                .all(|route| route.coordinator == GizmoAgent::Gizmo)
        );
        Ok(())
    }
}
