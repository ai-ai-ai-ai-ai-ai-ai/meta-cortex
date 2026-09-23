use super::{Checkpoint, ClaimAt, LeaseHealth, Progress, Task, TaskState, WorkerAt, Workspace};
use crate::LedgerError;
use crate::agents::{AgentId, DevelopmentAgent};
use crate::values::{
    Attempt, CommitId, Extensions, FeatureId, LeaseSeconds, Note, Revision, TaskId, Timestamp,
};
use crate::versions::RecordVersion;
use std::collections::BTreeMap;

struct Scenario;

impl Scenario {
    fn task() -> anyhow::Result<Task> {
        let id = TaskId::try_from("task".to_owned())?;
        let feature = FeatureId::try_from("feature".to_owned())?;
        let now = Scenario::claim()?.now;
        let mut extensions = BTreeMap::new();
        extensions.insert("custom".to_owned(), serde_json::json!([1, "note"]));
        Ok(Task {
            version: RecordVersion::V1,
            id,
            feature,
            objective: Note::from("Review".to_owned()),
            acceptance: vec![Note::from("Report findings".to_owned())],
            dependencies: Vec::new(),
            workspace: Workspace::ReadOnly,
            revision: Revision::INITIAL,
            attempt: Attempt::UNCLAIMED,
            state: TaskState::Queued,
            created_at: now,
            last_update: now,
            last_progress: now,
            checkpoint: Checkpoint::Unrecorded,
            progress: Progress {
                summary: Note::from("Starting".to_owned()),
                findings: Vec::new(),
                next_steps: Vec::new(),
                checks: Vec::new(),
                extensions: Extensions::from(extensions),
            },
        })
    }

    fn claim() -> anyhow::Result<ClaimAt> {
        Ok(ClaimAt {
            agent: AgentId::Development(DevelopmentAgent::RustDev),
            ttl: LeaseSeconds::try_from(10)?,
            now: Timestamp::try_from(1000)?,
        })
    }
}

#[test]
fn typed_round_trip_and_lifecycle() -> anyhow::Result<()> {
    let mut task = Scenario::task()?;
    let encoded = serde_json::to_string(&task)?;
    assert_eq!(task, serde_json::from_str::<Task>(&encoded)?);
    assert!(matches!(
        task.require_dependency(),
        Err(LedgerError::DependencyPending)
    ));
    assert!(matches!(
        task.require_revision(task.revision.advance()?),
        Err(LedgerError::Conflict)
    ));
    task.require_revision(Revision::INITIAL)?;
    task.claim(Scenario::claim()?)?;
    assert!(matches!(
        task.claim(Scenario::claim()?),
        Err(LedgerError::InvalidTransition)
    ));
    let agent = AgentId::Development(DevelopmentAgent::RustDev);
    task.ready(WorkerAt {
        agent: &agent,
        attempt: Attempt::UNCLAIMED.advance()?,
        now: Timestamp::try_from(2000)?,
    })?;
    assert!(matches!(task.state, TaskState::Ready { .. }));
    task.integrate(CommitId::try_from("a".repeat(40))?)?;
    task.require_dependency()?;
    assert!(matches!(
        task.requeue(),
        Err(LedgerError::InvalidTransition)
    ));
    assert!(matches!(
        task.cancel(Note::from("cancel".to_owned())),
        Err(LedgerError::InvalidTransition)
    ));
    assert_eq!(
        task.view(Timestamp::try_from(50000)?).lease,
        LeaseHealth::NotRunning
    );
    Ok(())
}

#[test]
fn expiry_and_reassignment_reject_stale_attempts() -> anyhow::Result<()> {
    let mut task = Scenario::task()?;
    task.claim(Scenario::claim()?)?;
    let agent = AgentId::Development(DevelopmentAgent::RustDev);
    assert_eq!(
        task.clone().view(Timestamp::try_from(10000)?).lease,
        LeaseHealth::Current
    );
    assert_eq!(
        task.clone().view(Timestamp::try_from(11000)?).lease,
        LeaseHealth::Expired
    );
    assert!(matches!(
        task.worker(WorkerAt {
            agent: &agent,
            attempt: Attempt::UNCLAIMED.advance()?,
            now: Timestamp::try_from(11000)?
        }),
        Err(LedgerError::Expired)
    ));
    task.requeue()?;
    task.claim(Scenario::claim()?)?;
    assert!(matches!(
        task.worker(WorkerAt {
            agent: &agent,
            attempt: Attempt::UNCLAIMED.advance()?,
            now: Timestamp::try_from(2000)?
        }),
        Err(LedgerError::AssignmentChanged)
    ));
    let stranger = AgentId::Development(DevelopmentAgent::TypescriptDev);
    assert!(matches!(
        task.worker(WorkerAt {
            agent: &stranger,
            attempt: Attempt::UNCLAIMED.advance()?.advance()?,
            now: Timestamp::try_from(2000)?
        }),
        Err(LedgerError::AssignmentChanged)
    ));
    task.cancel(Note::from("No longer needed".to_owned()))?;
    assert!(matches!(task.state, TaskState::Cancelled { .. }));
    Ok(())
}

#[test]
fn rejects_invalid_known_fields_and_versions() -> anyhow::Result<()> {
    let document = serde_json::to_string(&Scenario::task()?)?;
    for invalid in [
        document.replace("\"version\":1", "\"version\":99"),
        document.replace("\"id\":\"task\"", "\"id\":\"../task\""),
        document.replace("\"kind\":\"queued\"", "\"kind\":\"invented\""),
        document.replace("\"revision\":1", "\"revision\":0"),
    ] {
        assert!(serde_json::from_str::<Task>(&invalid).is_err());
    }
    Ok(())
}
