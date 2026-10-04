//! Explanations of the existing task transitions, shared by every observer.
use super::FlowState;
use crate::values::Note;
use schemars::JsonSchema;
use serde::Serialize;

#[derive(Debug, Serialize, JsonSchema)]
pub struct StateMeaning {
    pub state: FlowState,
    pub meaning: Note,
    pub evidence: Note,
    pub next_step: Note,
    pub qualification: Note,
}
impl StateMeaning {
    pub(crate) fn all() -> Vec<Self> {
        FlowState::ALL.into_iter().map(Self::from).collect()
    }
}
impl From<FlowState> for StateMeaning {
    fn from(state: FlowState) -> Self {
        let (meaning, evidence, next_step, qualification) = match state {
            FlowState::Queued => (
                "The task is waiting for a worker claim.",
                "The recorded task state is Queued; there is no active claim.",
                "The assigned worker claims the task when its prerequisites are satisfied.",
                "Assignment and queueing do not prove that a worker has started execution.",
            ),
            FlowState::Working => (
                "The active assignment has its Working phase recorded.",
                "A worker claim exists and its recorded phase is Working.",
                "The worker records progress, a blocking reason, or a ready handoff.",
                "This is recorded coordination state, not a measurement of execution or liveness.",
            ),
            FlowState::Blocked => (
                "The active assignment has a blocking reason recorded.",
                "The task snapshot contains the Blocked phase and its reason.",
                "Resolve the recorded blocker; the worker can then record further progress.",
                "The reason describes the recorded obstacle; this state does not identify an enforced resolver.",
            ),
            FlowState::Ready => (
                "The worker has handed the task off for acceptance or integration.",
                "A valid worker update recorded Ready. Git workspaces require a checkpoint and readiness checks.",
                "The coordinator reviews the handoff and selects the supported integration or completion transition.",
                "Ready is a handoff, not final acceptance. Framework policy assigns review responsibilities; the state alone does not prove review occurred.",
            ),
            FlowState::Integrated => (
                "A Ready task in a Git or ReadOnly workspace was accepted against the feature branch HEAD.",
                "The feature worktree was clean on its recorded branch, the supplied commit equaled HEAD, and a recorded Git checkpoint was an ancestor when present. An Unrecorded checkpoint is allowed.",
                "This task is terminal. Continue any remaining feature review or delivery work through its own tasks.",
                "Recording Integrated does not perform a merge. Framework policy names IntegrationAgent, but the API does not enforce that specific role. It does not prove CI, PR merge, deployment, or feature acceptance; Integrated cannot transition to Completed.",
            ),
            FlowState::Completed => (
                "The coordinator accepted a Ready task in a ReadOnly or Feature workspace.",
                "The completion transition requires Ready and a non-Git workspace.",
                "This task is terminal. Continue any remaining feature work through its own tasks.",
                "Completed is an alternative terminal outcome to Integrated, not a stage after it. Git write tasks must use integration; task completion alone does not prove feature acceptance or deployment.",
            ),
            FlowState::Cancelled => (
                "The task was stopped with a cancellation reason.",
                "A queued, active, or ready task was cancelled and its reason was recorded.",
                "This task is terminal. The coordinator decides whether separate replacement work is needed.",
                "Cancellation is not successful completion or integration.",
            ),
        };
        Self {
            state,
            meaning: Note::from(meaning.to_owned()),
            evidence: Note::from(evidence.to_owned()),
            next_step: Note::from(next_step.to_owned()),
            qualification: Note::from(qualification.to_owned()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{FlowState, StateMeaning};
    use crate::values::Note;

    #[test]
    fn every_observable_state_has_nonempty_guidance() {
        let meanings = StateMeaning::all();
        assert_eq!(
            meanings.iter().map(|entry| entry.state).collect::<Vec<_>>(),
            FlowState::ALL
        );
        for entry in meanings {
            for note in [
                entry.meaning,
                entry.evidence,
                entry.next_step,
                entry.qualification,
            ] {
                assert!(matches!(note, Note::Text(_)));
            }
        }
    }

    #[test]
    fn terminal_descriptions_preserve_actual_acceptance_limits() -> anyhow::Result<()> {
        let integrated = serde_json::to_value(StateMeaning::from(FlowState::Integrated))?;
        assert_eq!(integrated["state"], "integrated");
        let evidence = integrated["evidence"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing evidence"))?;
        assert!(evidence.contains("Unrecorded checkpoint is allowed"));
        let qualification = integrated["qualification"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("missing qualification"))?;
        assert!(qualification.contains("does not perform a merge"));
        assert!(qualification.contains("API does not enforce that specific role"));
        assert!(qualification.contains("cannot transition to Completed"));
        let completed = StateMeaning::from(FlowState::Completed);
        assert!(String::from(completed.evidence).contains("non-Git workspace"));
        let cancelled = StateMeaning::from(FlowState::Cancelled);
        assert!(String::from(cancelled.qualification).contains("not successful"));
        Ok(())
    }
}
