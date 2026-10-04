use super::{GuideDocument, GuideDocumentId, GuideProtocol};
use crate::agents::{
    AgentId, AiAgent, DeliveryAgent, DevelopmentAgent, GizmoAgent, SecurityAgent, SreAgent,
};
use crate::values::Note;
use std::path::PathBuf;

pub(super) const AGENTS: [AgentId; 16] = [
    AgentId::Gizmo(GizmoAgent::GizmoPrime),
    AgentId::Gizmo(GizmoAgent::Gizmo),
    AgentId::Development(DevelopmentAgent::RustDev),
    AgentId::Development(DevelopmentAgent::RustRefactoring),
    AgentId::Development(DevelopmentAgent::RustVerifier),
    AgentId::Development(DevelopmentAgent::TypescriptDev),
    AgentId::Development(DevelopmentAgent::TypescriptVerifier),
    AgentId::Development(DevelopmentAgent::WebDesigner),
    AgentId::Ai(AiAgent::TechWriter),
    AgentId::Ai(AiAgent::TechWriterVerifier),
    AgentId::Security(SecurityAgent::SecurityAgent),
    AgentId::Sre(SreAgent::CicdAgent),
    AgentId::Sre(SreAgent::DockerSpecialist),
    AgentId::Sre(SreAgent::KubernetesSpecialist),
    AgentId::Delivery(DeliveryAgent::IntegrationAgent),
    AgentId::Delivery(DeliveryAgent::PrAgent),
];
pub(super) fn role(agent: AgentId) -> GuideDocument {
    let markdown = match agent {
        AgentId::Gizmo(GizmoAgent::GizmoPrime) => {
            include_str!("../../../../cortex/teams/gizmo-team/agents/gizmo-prime/AGENTS.md")
        }
        AgentId::Gizmo(GizmoAgent::Gizmo) => {
            include_str!("../../../../cortex/teams/gizmo-team/agents/gizmo/AGENTS.md")
        }
        AgentId::Development(DevelopmentAgent::RustDev) => {
            include_str!("../../../../cortex/teams/dev-team/agents/rust-dev/AGENTS.md")
        }
        AgentId::Development(DevelopmentAgent::RustRefactoring) => {
            include_str!("../../../../cortex/teams/dev-team/agents/rust-refactoring/AGENTS.md")
        }
        AgentId::Development(DevelopmentAgent::RustVerifier) => {
            include_str!("../../../../cortex/teams/dev-team/agents/rust-verifier/AGENTS.md")
        }
        AgentId::Development(DevelopmentAgent::TypescriptDev) => {
            include_str!("../../../../cortex/teams/dev-team/agents/typescript-dev/AGENTS.md")
        }
        AgentId::Development(DevelopmentAgent::TypescriptVerifier) => {
            include_str!("../../../../cortex/teams/dev-team/agents/typescript-verifier/AGENTS.md")
        }
        AgentId::Development(DevelopmentAgent::WebDesigner) => {
            include_str!("../../../../cortex/teams/dev-team/agents/web-designer/AGENTS.md")
        }
        AgentId::Ai(AiAgent::TechWriter) => {
            include_str!("../../../../cortex/teams/ai-team/agents/tech-writer/AGENTS.md")
        }
        AgentId::Ai(AiAgent::TechWriterVerifier) => {
            include_str!("../../../../cortex/teams/ai-team/agents/tech-writer-verifier/AGENTS.md")
        }
        AgentId::Security(SecurityAgent::SecurityAgent) => {
            include_str!("../../../../cortex/teams/security-team/agents/security-agent/AGENTS.md")
        }
        AgentId::Sre(SreAgent::CicdAgent) => {
            include_str!("../../../../cortex/teams/sre-team/agents/cicd-agent/AGENTS.md")
        }
        AgentId::Sre(SreAgent::DockerSpecialist) => {
            include_str!("../../../../cortex/teams/sre-team/agents/docker-specialist/AGENTS.md")
        }
        AgentId::Sre(SreAgent::KubernetesSpecialist) => {
            include_str!("../../../../cortex/teams/sre-team/agents/kubernetes-specialist/AGENTS.md")
        }
        AgentId::Delivery(DeliveryAgent::IntegrationAgent) => include_str!(
            "../../../../cortex/teams/delivery-team/agents/integration-agent/AGENTS.md"
        ),
        AgentId::Delivery(DeliveryAgent::PrAgent) => {
            include_str!("../../../../cortex/teams/delivery-team/agents/pr-agent/AGENTS.md")
        }
    };
    GuideDocument {
        id: GuideDocumentId::Agent { agent },
        path: agent.instructions_path(),
        markdown: Note::from(markdown.to_owned()),
    }
}
pub(super) fn protocol(protocol: GuideProtocol) -> GuideDocument {
    let (path, markdown) = match protocol {
        GuideProtocol::Communication => (
            "teams/AGENTS.md",
            include_str!("../../../../cortex/teams/AGENTS.md"),
        ),
        GuideProtocol::Coordination => (
            "teams/gizmo-team/docs/coordination-state-machine.md",
            include_str!("../../../../cortex/teams/gizmo-team/docs/coordination-state-machine.md"),
        ),
        GuideProtocol::Verification => (
            "teams/gizmo-team/docs/agent-verification.md",
            include_str!("../../../../cortex/teams/gizmo-team/docs/agent-verification.md"),
        ),
    };
    GuideDocument {
        id: GuideDocumentId::Protocol { protocol },
        path: PathBuf::from(path),
        markdown: Note::from(markdown.to_owned()),
    }
}
