use crate::LedgerError;
use crate::agents::recorded::{RecordedAgentId, RecordedGizmoAgent, RecordedReportingTarget};
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
    Assigned { assignment: RecordedTaskAssignment },
}

impl TaskOwnership {
    pub fn require_current(&self) -> Result<(), LedgerError> {
        match self {
            Self::Unrecorded => Ok(()),
            Self::Assigned { assignment } => {
                let agent = AgentId::try_from(assignment.agent)?;
                match assignment.reports_to == agent.reports_to().into() {
                    true => Ok(()),
                    false => Err(LedgerError::Invalid(
                        "retired reporting line requires explicit requeue and reassignment to Prime",
                    )),
                }
            }
        }
    }

    pub fn require_agent(&self, agent: RecordedAgentId) -> Result<(), LedgerError> {
        match self {
            Self::Assigned { assignment } if assignment.agent != agent => {
                Err(LedgerError::AssignmentChanged)
            }
            Self::Assigned { .. } | Self::Unrecorded => Ok(()),
        }
    }
}

/// Persisted ownership retains the reporting line that was actually recorded.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RecordedTaskAssignment {
    pub agent: RecordedAgentId,
    pub reports_to: RecordedReportingTarget,
}

impl From<TaskAssignment> for RecordedTaskAssignment {
    fn from(assignment: TaskAssignment) -> Self {
        Self {
            agent: assignment.agent.into(),
            reports_to: assignment.reports_to.into(),
        }
    }
}

impl RecordedTaskAssignment {
    pub(super) fn validate_retained(&self) -> Result<(), LedgerError> {
        let reports_to = match self.agent {
            RecordedAgentId::Gizmo(RecordedGizmoAgent::GizmoPrime) => RecordedReportingTarget::Host,
            RecordedAgentId::Gizmo(RecordedGizmoAgent::Gizmo) => {
                RecordedReportingTarget::Gizmo(RecordedGizmoAgent::GizmoPrime)
            }
            RecordedAgentId::Development(_)
            | RecordedAgentId::Ai(_)
            | RecordedAgentId::Security(_)
            | RecordedAgentId::Sre(_)
            | RecordedAgentId::Delivery(_) => {
                RecordedReportingTarget::Gizmo(RecordedGizmoAgent::Gizmo)
            }
        };
        match self.reports_to == reports_to {
            true => Ok(()),
            false => Err(LedgerError::Invalid(
                "retained assignment disagrees with its released reporting hierarchy",
            )),
        }
    }

    /// Accept released reporting facts without rewriting them to the current policy.
    pub fn validate(&self) -> Result<(), LedgerError> {
        match self.reports_to {
            RecordedReportingTarget::Host => match self.agent {
                RecordedAgentId::Gizmo(RecordedGizmoAgent::GizmoPrime) => Ok(()),
                RecordedAgentId::Gizmo(RecordedGizmoAgent::Gizmo)
                | RecordedAgentId::Development(_)
                | RecordedAgentId::Ai(_)
                | RecordedAgentId::Security(_)
                | RecordedAgentId::Sre(_)
                | RecordedAgentId::Delivery(_) => {
                    Err(LedgerError::Invalid("only Prime reports to the host"))
                }
            },
            RecordedReportingTarget::Gizmo(RecordedGizmoAgent::GizmoPrime) => match self.agent {
                RecordedAgentId::Gizmo(RecordedGizmoAgent::GizmoPrime) => {
                    Err(LedgerError::Invalid("Prime cannot report to itself"))
                }
                RecordedAgentId::Gizmo(RecordedGizmoAgent::Gizmo)
                | RecordedAgentId::Development(_)
                | RecordedAgentId::Ai(_)
                | RecordedAgentId::Security(_)
                | RecordedAgentId::Sre(_)
                | RecordedAgentId::Delivery(_) => Ok(()),
            },
            RecordedReportingTarget::Gizmo(RecordedGizmoAgent::Gizmo) => match self.agent {
                RecordedAgentId::Gizmo(
                    RecordedGizmoAgent::GizmoPrime | RecordedGizmoAgent::Gizmo,
                ) => Err(LedgerError::Invalid(
                    "a coordinator cannot report to retired Team Gizmo",
                )),
                RecordedAgentId::Development(_)
                | RecordedAgentId::Ai(_)
                | RecordedAgentId::Security(_)
                | RecordedAgentId::Sre(_)
                | RecordedAgentId::Delivery(_) => Ok(()),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{TaskAssignment, TaskOwnership};
    use crate::LedgerError;
    use crate::agents::{
        AgentId, AiAgent, DeliveryAgent, DevelopmentAgent, GizmoAgent, ReportingTarget,
        SecurityAgent, SreAgent,
    };

    #[test]
    fn prime_directly_coordinates_every_specialist() -> anyhow::Result<()> {
        let prime = AgentId::Gizmo(GizmoAgent::GizmoPrime);
        let root = TaskAssignment::from(prime);
        assert_eq!(root.reports_to, ReportingTarget::Host);
        root.validate()?;
        for agent in [
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
        ] {
            let assignment = TaskAssignment::from(agent);
            assert_eq!(
                assignment.reports_to,
                ReportingTarget::Gizmo(GizmoAgent::GizmoPrime)
            );
            assignment.validate()?;
            let ownership = TaskOwnership::Assigned {
                assignment: assignment.into(),
            };
            ownership.require_agent(agent.into())?;
            assert!(matches!(
                ownership.require_agent(prime.into()),
                Err(LedgerError::AssignmentChanged)
            ));
            assert_eq!(
                serde_json::from_str::<TaskOwnership>(&serde_json::to_string(&ownership)?)?,
                ownership
            );
            assert!(
                TaskAssignment {
                    agent,
                    reports_to: ReportingTarget::Host
                }
                .validate()
                .is_err()
            );
        }
        TaskOwnership::Unrecorded.require_agent(prime.into())?;
        assert!(
            TaskAssignment {
                agent: prime,
                reports_to: ReportingTarget::Gizmo(GizmoAgent::GizmoPrime)
            }
            .validate()
            .is_err()
        );
        Ok(())
    }
}
