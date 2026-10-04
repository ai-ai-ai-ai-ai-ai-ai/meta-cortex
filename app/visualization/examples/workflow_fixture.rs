//! Generate the checked-in UI sample through the public Workbench projection.
use meta_cortex_workbench::agents::{AgentId, DevelopmentAgent, GizmoAgent};
use meta_cortex_workbench::model::worker::WorkerIdentity;
use meta_cortex_workbench::model::workflow::TaskOwnership;
use meta_cortex_workbench::model::{
    Check, CheckOutcome, Checkpoint, EventKind, Progress, Task, TaskCommon, TaskState, Workspace,
};
use meta_cortex_workbench::values::{
    Attempt, Extensions, FeatureId, Note, Revision, TaskId, Timestamp,
};
use meta_cortex_workbench::versions::TaskRecordVersion;
use meta_cortex_workbench::{
    FeatureWorkflow, FeedEntry, FlowState, RecordedRole, RecordedTimeline, TaskChapter,
    WorkflowTiming,
};
fn main() -> anyhow::Result<()> {
    let agent = AgentId::Development(DevelopmentAgent::RustDev);
    let started = Timestamp::try_from(1791052200000)?;
    let finished = Timestamp::try_from(1791053400000)?;
    let feature = FeatureId::try_from("release-0-12-3".to_owned())?;
    let progress = Progress {
        summary: Note::from("Release implemented".to_owned()),
        findings: Vec::new(),
        next_steps: Vec::new(),
        checks: Vec::new(),
        extensions: Extensions::default(),
    };
    let task = Task {
        version: TaskRecordVersion::CURRENT,
        worker: WorkerIdentity::Unrecorded,
        common: TaskCommon {
            id: TaskId::try_from("rust-release".to_owned())?,
            feature: feature.clone(),
            objective: Note::from("Implement the release".to_owned()),
            acceptance: vec![Note::from("Tests pass".to_owned())],
            dependencies: Vec::new(),
            revision: Revision::INITIAL.advance()?,
            attempt: Attempt::UNCLAIMED.advance()?,
            created_at: started,
            last_update: finished,
            last_progress: finished,
            checkpoint: Checkpoint::Unrecorded,
            progress: progress.clone(),
        },
        ownership: TaskOwnership::Unrecorded,
        workspace: Workspace::ReadOnly,
        state: TaskState::Completed {
            agent,
            attempt: Attempt::UNCLAIMED.advance()?,
        },
    };
    let entries = vec![
        FeedEntry {
            objective: task.common.objective.clone(),
            worker: task.worker,
            kind: EventKind::Created,
            actor: AgentId::Gizmo(GizmoAgent::GizmoPrime),
            ownership: task.ownership.clone(),
            state: TaskState::Queued,
            note: task.common.objective.clone(),
            summary: Note::Empty,
            at: started,
            revision: Revision::INITIAL,
            evidence: Vec::new(),
            checkpoint: Checkpoint::Unrecorded,
        },
        FeedEntry {
            objective: task.common.objective.clone(),
            worker: task.worker,
            kind: EventKind::Completed,
            actor: AgentId::Gizmo(GizmoAgent::GizmoPrime),
            ownership: task.ownership.clone(),
            state: task.state.clone(),
            note: Note::from("Activity accepted".to_owned()),
            summary: progress.summary.clone(),
            at: finished,
            revision: task.common.revision,
            evidence: vec![Progress {
                summary: progress.summary,
                findings: vec![Note::from("Checked the manifest".to_owned())],
                next_steps: Vec::new(),
                checks: vec![Check {
                    command: Note::from("cargo test -p workbench".to_owned()),
                    outcome: CheckOutcome::Passed,
                    evidence: Note::from("34 passed".to_owned()),
                }],
                extensions: Extensions::default(),
            }],
            checkpoint: Checkpoint::Unrecorded,
        },
    ];
    let chapters = vec![TaskChapter {
        task,
        role: RecordedRole::Recorded { agent },
        status: FlowState::Completed,
        entries,
    }];
    let workflow = FeatureWorkflow {
        feature,
        timeline: RecordedTimeline::from(chapters.as_slice()),
        timing: WorkflowTiming::from(chapters.as_slice()),
        chapters,
    };
    println!("{}", serde_json::to_string_pretty(&workflow)?);
    Ok(())
}
