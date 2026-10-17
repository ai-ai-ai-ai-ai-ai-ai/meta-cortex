//! Retained ledger identities describe recorded facts, never current assignable roles.
use super::{
    AgentId, AiAgent, DeliveryAgent, DevelopmentAgent, GizmoAgent, ReportingTarget, SecurityAgent,
    SreAgent,
};
use crate::LedgerError;
use derive_more::Display;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(tag = "team", content = "role", deny_unknown_fields)]
pub enum RecordedAgentId {
    #[display("Gizmo/{_0}")]
    Gizmo(RecordedGizmoAgent),
    #[display("Development/{_0}")]
    Development(DevelopmentAgent),
    #[display("Ai/{_0}")]
    Ai(AiAgent),
    #[display("Security/{_0}")]
    Security(SecurityAgent),
    #[display("Sre/{_0}")]
    Sre(SreAgent),
    #[display("Delivery/{_0}")]
    Delivery(DeliveryAgent),
}

/// `Gizmo` is the retired coordinator's original attribution, not an alias for Prime.
#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
pub enum RecordedGizmoAgent {
    GizmoPrime,
    Gizmo,
}

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(tag = "kind", content = "coordinator", deny_unknown_fields)]
pub enum RecordedReportingTarget {
    #[display("host")]
    Host,
    #[display("Gizmo/{_0}")]
    Gizmo(RecordedGizmoAgent),
}

impl From<AgentId> for RecordedAgentId {
    fn from(agent: AgentId) -> Self {
        match agent {
            AgentId::Gizmo(GizmoAgent::GizmoPrime) => Self::Gizmo(RecordedGizmoAgent::GizmoPrime),
            AgentId::Development(agent) => Self::Development(agent),
            AgentId::Ai(agent) => Self::Ai(agent),
            AgentId::Security(agent) => Self::Security(agent),
            AgentId::Sre(agent) => Self::Sre(agent),
            AgentId::Delivery(agent) => Self::Delivery(agent),
        }
    }
}

impl From<ReportingTarget> for RecordedReportingTarget {
    fn from(target: ReportingTarget) -> Self {
        match target {
            ReportingTarget::Host => Self::Host,
            ReportingTarget::Gizmo(GizmoAgent::GizmoPrime) => {
                Self::Gizmo(RecordedGizmoAgent::GizmoPrime)
            }
        }
    }
}

impl TryFrom<RecordedAgentId> for AgentId {
    type Error = LedgerError;
    fn try_from(agent: RecordedAgentId) -> Result<Self, Self::Error> {
        match agent {
            RecordedAgentId::Gizmo(RecordedGizmoAgent::GizmoPrime) => {
                Ok(Self::Gizmo(GizmoAgent::GizmoPrime))
            }
            RecordedAgentId::Gizmo(RecordedGizmoAgent::Gizmo) => Err(LedgerError::Invalid(
                "retired Team Gizmo role requires explicit requeue and reassignment",
            )),
            RecordedAgentId::Development(agent) => Ok(Self::Development(agent)),
            RecordedAgentId::Ai(agent) => Ok(Self::Ai(agent)),
            RecordedAgentId::Security(agent) => Ok(Self::Security(agent)),
            RecordedAgentId::Sre(agent) => Ok(Self::Sre(agent)),
            RecordedAgentId::Delivery(agent) => Ok(Self::Delivery(agent)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{RecordedAgentId, RecordedGizmoAgent, RecordedReportingTarget};
    use crate::agents::{
        AgentId, AiAgent, DeliveryAgent, DevelopmentAgent, GizmoAgent, ReportingTarget,
        SecurityAgent, SreAgent,
    };

    #[test]
    fn retained_identity_is_readable_but_cannot_be_used_as_a_current_role() -> anyhow::Result<()> {
        let retired = RecordedAgentId::Gizmo(RecordedGizmoAgent::Gizmo);
        let encoded = serde_json::to_string(&retired)?;
        assert_eq!(serde_json::from_str::<RecordedAgentId>(&encoded)?, retired);
        assert!(serde_json::from_str::<AgentId>(&encoded).is_err());
        assert!(AgentId::try_from(retired).is_err());
        assert_eq!(retired.to_string(), "Gizmo/Gizmo");
        let target = RecordedReportingTarget::Gizmo(RecordedGizmoAgent::Gizmo);
        let encoded = serde_json::to_string(&target)?;
        assert_eq!(
            serde_json::from_str::<RecordedReportingTarget>(&encoded)?,
            target
        );
        assert!(serde_json::from_str::<ReportingTarget>(&encoded).is_err());
        assert_eq!(target.to_string(), "Gizmo/Gizmo");
        Ok(())
    }

    #[test]
    fn current_roles_preserve_their_meaning_in_recorded_fields() -> anyhow::Result<()> {
        for agent in [
            AgentId::Gizmo(GizmoAgent::GizmoPrime),
            AgentId::Development(DevelopmentAgent::RustDev),
            AgentId::Ai(AiAgent::TechWriter),
            AgentId::Security(SecurityAgent::SecurityAgent),
            AgentId::Sre(SreAgent::CicdAgent),
            AgentId::Delivery(DeliveryAgent::IntegrationAgent),
        ] {
            let recorded = RecordedAgentId::from(agent);
            assert_eq!(AgentId::try_from(recorded)?, agent);
            assert_eq!(
                serde_json::to_string(&recorded)?,
                serde_json::to_string(&agent)?
            );
            assert_eq!(
                serde_json::from_str::<RecordedAgentId>(&serde_json::to_string(&recorded)?)?,
                recorded
            );
            assert_eq!(recorded.to_string(), agent.to_string());
            let target = RecordedReportingTarget::from(agent.reports_to());
            assert_eq!(
                serde_json::to_string(&target)?,
                serde_json::to_string(&agent.reports_to())?
            );
            assert_eq!(target.to_string(), agent.reports_to().to_string());
        }
        Ok(())
    }
}
