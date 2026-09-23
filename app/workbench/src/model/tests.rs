use super::{Checkpoint, ClaimAt, LeaseHealth, Progress, Task, TaskState, WorkerAt, Workspace};
use crate::LedgerError;
use crate::agents::{AgentId, DevelopmentAgent};
use crate::values::{
    Attempt, CommitIdParse, Extensions, FeatureIdParse, LeaseSecondsParse, Note, Revision,
    TaskIdParse, TimestampParse,
};
use crate::versions::RecordVersion;
use std::collections::BTreeMap;

struct Scenario;

impl Scenario {
    fn task() -> anyhow::Result<Task> {
        let id = match TaskIdParse::from("task".to_owned()) {
            TaskIdParse::Parsed(id) => id,
            TaskIdParse::Invalid(error) => return Err(error.into()),
        };
        let feature = match FeatureIdParse::from("feature".to_owned()) {
            FeatureIdParse::Parsed(id) => id,
            FeatureIdParse::Invalid(error) => return Err(error.into()),
        };
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
            ttl: match LeaseSecondsParse::from(10) {
                LeaseSecondsParse::Parsed(value) => value,
                LeaseSecondsParse::Invalid(error) => return Err(error.into()),
            },
            now: match TimestampParse::from(1000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            },
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
        now: match TimestampParse::from(2000) {
            TimestampParse::Parsed(value) => value,
            TimestampParse::Invalid(error) => return Err(error.into()),
        },
    })?;
    assert!(matches!(task.state, TaskState::Ready { .. }));
    task.integrate(match CommitIdParse::from("a".repeat(40)) {
        CommitIdParse::Parsed(value) => value,
        CommitIdParse::Invalid(error) => return Err(error.into()),
    })?;
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
        task.view(match TimestampParse::from(50000) {
            TimestampParse::Parsed(value) => value,
            TimestampParse::Invalid(error) => return Err(error.into()),
        })
        .lease,
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
        task.clone()
            .view(match TimestampParse::from(10000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            })
            .lease,
        LeaseHealth::Current
    );
    assert_eq!(
        task.clone()
            .view(match TimestampParse::from(11000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            })
            .lease,
        LeaseHealth::Expired
    );
    assert!(matches!(
        task.worker(WorkerAt {
            agent: &agent,
            attempt: Attempt::UNCLAIMED.advance()?,
            now: match TimestampParse::from(11000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            }
        }),
        Err(LedgerError::Expired)
    ));
    task.requeue()?;
    task.claim(Scenario::claim()?)?;
    assert!(matches!(
        task.worker(WorkerAt {
            agent: &agent,
            attempt: Attempt::UNCLAIMED.advance()?,
            now: match TimestampParse::from(2000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            }
        }),
        Err(LedgerError::AssignmentChanged)
    ));
    let stranger = AgentId::Development(DevelopmentAgent::TypescriptDev);
    assert!(matches!(
        task.worker(WorkerAt {
            agent: &stranger,
            attempt: Attempt::UNCLAIMED.advance()?.advance()?,
            now: match TimestampParse::from(2000) {
                TimestampParse::Parsed(value) => value,
                TimestampParse::Invalid(error) => return Err(error.into()),
            }
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
