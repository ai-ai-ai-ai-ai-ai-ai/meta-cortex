use crate::LedgerError;
use crate::agents::{AgentId, ReportingTarget};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// The intended owner and reporting line survive every task state and attempt.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TaskAssignment {
    pub agent: AgentId,
    pub reports_to: ReportingTarget,
}

impl TaskAssignment {
    pub fn validate(&self) -> Result<(), LedgerError> {
        match self.reports_to == self.agent.reports_to() {
            true => Ok(()),
            false => Err(LedgerError::Invalid(
                "assignment reporting line disagrees with the agent hierarchy",
            )),
        }
    }
}

impl From<AgentId> for TaskAssignment {
    fn from(agent: AgentId) -> Self {
        Self {
            agent,
            reports_to: agent.reports_to(),
        }
    }
}

/// V1 tasks did not record an intended owner or reporting line.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum TaskOwnership {
    Unrecorded,
    Assigned { assignment: TaskAssignment },
}

impl TaskOwnership {
    pub fn require_agent(&self, agent: AgentId) -> Result<(), LedgerError> {
        match self {
            Self::Assigned { assignment } if assignment.agent != agent => {
                Err(LedgerError::AssignmentChanged)
            }
            Self::Assigned { .. } | Self::Unrecorded => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{TaskAssignment, TaskOwnership};
    use crate::LedgerError;
    use crate::agents::{AgentId, DeliveryAgent, DevelopmentAgent, GizmoAgent, ReportingTarget};

    #[test]
    fn hierarchy_preserves_prime_team_and_specialist_reporting() -> anyhow::Result<()> {
        let prime = AgentId::Gizmo(GizmoAgent::GizmoPrime);
        let team = AgentId::Gizmo(GizmoAgent::Gizmo);
        let integration = AgentId::Delivery(DeliveryAgent::IntegrationAgent);
        let root = TaskAssignment::from(prime);
        assert_eq!(root.reports_to, ReportingTarget::Host);
        root.validate()?;
        let coordination = TaskAssignment::from(team);
        assert_eq!(
            coordination.reports_to,
            ReportingTarget::Gizmo(GizmoAgent::GizmoPrime)
        );
        coordination.validate()?;
        let worker = TaskAssignment::from(integration);
        assert_eq!(worker.reports_to, ReportingTarget::Gizmo(GizmoAgent::Gizmo));
        worker.validate()?;
        let invalid = TaskAssignment {
            agent: integration,
            reports_to: ReportingTarget::Gizmo(GizmoAgent::GizmoPrime),
        };
        assert!(matches!(invalid.validate(), Err(LedgerError::Invalid(_))));
        let ownership = TaskOwnership::Assigned { assignment: worker };
        ownership.require_agent(integration)?;
        assert!(matches!(
            ownership.require_agent(prime),
            Err(LedgerError::AssignmentChanged)
        ));
        TaskOwnership::Unrecorded.require_agent(AgentId::Development(DevelopmentAgent::RustDev))?;
        let encoded = serde_json::to_string(&ownership)?;
        assert_eq!(serde_json::from_str::<TaskOwnership>(&encoded)?, ownership);
        Ok(())
    }
}
