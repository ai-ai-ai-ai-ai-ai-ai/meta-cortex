//! Agent identities preserve the membership defined by Cortex's team catalogs.
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Each team encloses only its own roles; coordinators belong to the Gizmo team.
///
/// An SRE identity cannot carry a development role:
/// ```compile_fail,E0308
/// use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent};
/// let agent = AgentId::Sre(DevelopmentAgent::RustDev);
/// ```
/// Nor can the SRE role enum name a development role:
/// ```compile_fail,E0599
/// use meta_cortex_workbench::agents::SreAgent;
/// let agent = SreAgent::RustDev;
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "team", content = "role", deny_unknown_fields)]
#[schemars(description = "An agent role scoped to its owning Cortex team.")]
pub enum AgentId {
    Gizmo(GizmoAgent),
    Development(DevelopmentAgent),
    Ai(AiAgent),
    Security(SecurityAgent),
    Sre(SreAgent),
    Delivery(DeliveryAgent),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum GizmoAgent {
    GizmoPrime,
    Gizmo,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum DevelopmentAgent {
    RustDev,
    RustRefactoring,
    TypescriptDev,
    WebDesigner,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum AiAgent {
    TechWriter,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum SecurityAgent {
    SecurityAgent,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum SreAgent {
    CicdAgent,
    DockerSpecialist,
    KubernetesSpecialist,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum DeliveryAgent {
    IntegrationAgent,
    PrAgent,
}

impl AgentId {
    /// Resolve the actual role instructions relative to the Cortex library root.
    /// Directory spellings belong at this filesystem boundary, not on the wire.
    pub fn instructions_path(self) -> PathBuf {
        let path = match self {
            Self::Gizmo(GizmoAgent::GizmoPrime) => "teams/gizmo-team/agents/gizmo-prime/AGENTS.md",
            Self::Gizmo(GizmoAgent::Gizmo) => "teams/gizmo-team/agents/gizmo/AGENTS.md",
            Self::Development(DevelopmentAgent::RustDev) => {
                "teams/dev-team/agents/rust-dev/AGENTS.md"
            }
            Self::Development(DevelopmentAgent::RustRefactoring) => {
                "teams/dev-team/agents/rust-refactoring/AGENTS.md"
            }
            Self::Development(DevelopmentAgent::TypescriptDev) => {
                "teams/dev-team/agents/typescript-dev/AGENTS.md"
            }
            Self::Development(DevelopmentAgent::WebDesigner) => {
                "teams/dev-team/agents/web-designer/AGENTS.md"
            }
            Self::Ai(AiAgent::TechWriter) => "teams/ai-team/agents/tech-writer/AGENTS.md",
            Self::Security(SecurityAgent::SecurityAgent) => {
                "teams/security-team/agents/security-agent/AGENTS.md"
            }
            Self::Sre(SreAgent::CicdAgent) => "teams/sre-team/agents/cicd-agent/AGENTS.md",
            Self::Sre(SreAgent::DockerSpecialist) => {
                "teams/sre-team/agents/docker-specialist/AGENTS.md"
            }
            Self::Sre(SreAgent::KubernetesSpecialist) => {
                "teams/sre-team/agents/kubernetes-specialist/AGENTS.md"
            }
            Self::Delivery(DeliveryAgent::IntegrationAgent) => {
                "teams/delivery-team/agents/integration-agent/AGENTS.md"
            }
            Self::Delivery(DeliveryAgent::PrAgent) => {
                "teams/delivery-team/agents/pr-agent/AGENTS.md"
            }
        };
        PathBuf::from(path)
    }
}

#[cfg(test)]
mod tests;
