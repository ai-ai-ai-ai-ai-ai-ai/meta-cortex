use meta_cortex_workbench::agents::AgentId;
use meta_cortex_workbench::model::{CheckOutcome, Checkpoint, Phase, Task, TaskState, Workspace};
use meta_cortex_workbench::values::Extensions;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use std::fmt;

pub(super) struct TaskDetail<'a>(pub &'a Task);
impl TaskDetail<'_> {
    pub fn state(&self) -> Span<'static> {
        let Self(task) = self;
        match &task.state {
            TaskState::Queued => Span::styled("○ Queued", Style::default().fg(Color::Gray)),
            TaskState::Active { assignment } => match &assignment.phase {
                Phase::Working => Span::styled("● Working", Style::default().fg(Color::Cyan)),
                Phase::Blocked { .. } => Span::styled("! Blocked", Style::default().fg(Color::Red)),
            },
            TaskState::Ready { .. } => Span::styled("✓ Ready", Style::default().fg(Color::Green)),
            TaskState::Integrated { .. } => {
                Span::styled("✓ Integrated", Style::default().fg(Color::Green))
            }
            TaskState::Cancelled { .. } => {
                Span::styled("× Cancelled", Style::default().fg(Color::Gray))
            }
        }
    }
    pub fn text(&self) -> Paragraph<'static> {
        Paragraph::new(self.lines())
    }
    pub fn lines(&self) -> Vec<Line<'static>> {
        let Self(task) = self;
        let mut lines = vec![
            Line::from(Span::styled(
                task.id.to_string(),
                Style::default().add_modifier(Modifier::BOLD),
            )),
            Line::from(vec![
                self.state(),
                Span::styled(
                    format!("   revision {} · attempt {}", task.revision, task.attempt),
                    Style::default().fg(Color::Rgb(155, 165, 179)),
                ),
            ]),
            Line::default(),
            Line::from(Span::styled(
                "Objective",
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            )),
            Line::from(task.objective.to_string()),
            Line::default(),
        ];
        lines.extend(self.metadata());
        lines.extend(self.commits());
        lines.push(Line::default());
        lines.push(Line::from(Span::styled(
            "Progress",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )));
        lines.push(Line::from(task.progress.summary.to_string()));
        lines.push(Line::default());
        lines.push(Line::from(Span::styled(
            "Acceptance",
            Style::default().fg(Color::Cyan),
        )));
        lines.extend(
            task.acceptance
                .iter()
                .map(|note| Line::from(format!("  • {note}"))),
        );
        lines.push(Line::default());
        lines.push(Line::from(Span::styled(
            "Dependencies",
            Style::default().fg(Color::Cyan),
        )));
        lines.extend(match task.dependencies.as_slice() {
            [] => vec![
                Line::from("  None recorded").style(Style::default().fg(Color::Rgb(155, 165, 179))),
            ],
            [_, ..] => vec![],
        });
        lines.extend(
            task.dependencies
                .iter()
                .map(|dependency| Line::from(format!("  {dependency}"))),
        );
        lines.push(Line::default());
        lines.push(Line::from(Span::styled(
            "Findings",
            Style::default().fg(Color::Cyan),
        )));
        lines.extend(
            task.progress.findings.iter().map(|note| {
                Line::from(format!("  • {note}")).style(Style::default().fg(Color::Gray))
            }),
        );
        lines.push(Line::default());
        lines.push(Line::from(Span::styled(
            "Next steps",
            Style::default().fg(Color::Cyan),
        )));
        lines.extend(
            task.progress
                .next_steps
                .iter()
                .map(|note| Line::from(format!("  • {note}"))),
        );
        lines.extend(self.checks());
        lines.push(Line::default());
        lines.push(Line::from(Span::styled(
            "Task-specific extensions",
            Style::default().fg(Color::Cyan),
        )));
        let Extensions(extensions) = &task.progress.extensions;
        lines.extend(match extensions.len() {
            0 => vec![
                Line::from("  None recorded").style(Style::default().fg(Color::Rgb(155, 165, 179))),
            ],
            _ => vec![],
        });
        lines.extend(
            extensions
                .iter()
                .map(|(key, value)| Line::from(format!("  {key}: {value}"))),
        );
        lines
    }
    fn metadata(&self) -> Vec<Line<'static>> {
        let Self(task) = self;
        let mut lines = vec![
            Line::from(format!("Created   {}", task.created_at)),
            Line::from(format!(
                "Updated   {} · progress {}",
                task.last_update, task.last_progress
            )),
        ];
        lines.push(match &task.workspace {
            Workspace::ReadOnly => Line::from("Workspace read only"),
            Workspace::Git { branch, path } => {
                Line::from(format!("Workspace {branch} · {}", path.display()))
            }
        });
        lines.extend(self.assignment());
        lines
            .into_iter()
            .map(|line| line.style(Style::default().fg(Color::Rgb(155, 165, 179))))
            .collect()
    }
    fn assignment(&self) -> Vec<Line<'static>> {
        let Self(task) = self;
        match &task.state {
            TaskState::Queued | TaskState::Integrated { .. } => vec![],
            TaskState::Active { assignment } => {
                let mut lines = vec![Line::from(format!(
                    "Assigned  {} · expires {}",
                    ActorLabel(&assignment.agent),
                    assignment.expires_at
                ))];
                match &assignment.phase {
                    Phase::Working => {}
                    Phase::Blocked { reason } => {
                        lines.push(Line::from(format!("Blocked   {reason}")))
                    }
                }
                lines
            }
            TaskState::Ready { agent, .. } => {
                vec![Line::from(format!("Ready by  {}", ActorLabel(agent)))]
            }
            TaskState::Cancelled { reason } => vec![Line::from(format!("Cancelled {reason}"))],
        }
    }
    fn commits(&self) -> Vec<Line<'static>> {
        let Self(task) = self;
        let mut lines = match &task.checkpoint {
            Checkpoint::Unrecorded => vec![
                Line::from("Checkpoint unrecorded")
                    .style(Style::default().fg(Color::Rgb(155, 165, 179))),
            ],
            Checkpoint::Git { commit } => {
                vec![Line::from(format!("Recorded checkpoint  {commit}"))]
            }
        };
        match &task.state {
            TaskState::Integrated { commit } => {
                lines.push(Line::from(format!("Recorded integration commit  {commit}")))
            }
            TaskState::Queued
            | TaskState::Active { .. }
            | TaskState::Ready { .. }
            | TaskState::Cancelled { .. } => {}
        }
        match task {
            Task {
                checkpoint: Checkpoint::Unrecorded,
                state:
                    TaskState::Queued
                    | TaskState::Active { .. }
                    | TaskState::Ready { .. }
                    | TaskState::Cancelled { .. },
                ..
            } => {}
            Task {
                checkpoint: Checkpoint::Git { .. },
                state:
                    TaskState::Queued
                    | TaskState::Active { .. }
                    | TaskState::Ready { .. }
                    | TaskState::Integrated { .. }
                    | TaskState::Cancelled { .. },
                ..
            }
            | Task {
                checkpoint: Checkpoint::Unrecorded,
                state: TaskState::Integrated { .. },
                ..
            } => lines.push(
                Line::from(
                    "  Recorded by: corresponding history event · Git authorship unrecorded",
                )
                .style(Style::default().fg(Color::Rgb(155, 165, 179))),
            ),
        }
        lines
    }
    fn checks(&self) -> Vec<Line<'static>> {
        let Self(task) = self;
        let mut lines = vec![
            Line::default(),
            Line::from(Span::styled("Checks", Style::default().fg(Color::Cyan))),
        ];
        for check in &task.progress.checks {
            let outcome = match check.outcome {
                CheckOutcome::Passed => {
                    Span::styled("✓ Success", Style::default().fg(Color::Green))
                }
                CheckOutcome::Failed => Span::styled("× Failure", Style::default().fg(Color::Red)),
                CheckOutcome::NotRun => Span::styled("○ Not run", Style::default().fg(Color::Gray)),
            };
            lines.push(Line::from(vec![
                outcome,
                Span::raw(format!("  {}", check.command)),
            ]));
            lines.push(
                Line::from(format!("  {}", check.evidence))
                    .style(Style::default().fg(Color::Rgb(155, 165, 179))),
            );
        }
        lines
    }
}

/// Recorded role identity formatted only at the terminal presentation boundary.
pub(super) struct ActorLabel<'a>(pub &'a AgentId);
impl fmt::Display for ActorLabel<'_> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self(actor) = self;
        match actor {
            AgentId::Gizmo(role) => write!(formatter, "Gizmo / {role:?}"),
            AgentId::Development(role) => write!(formatter, "Development / {role:?}"),
            AgentId::Ai(role) => write!(formatter, "AI / {role:?}"),
            AgentId::Security(role) => write!(formatter, "Security / {role:?}"),
            AgentId::Sre(role) => write!(formatter, "SRE / {role:?}"),
            AgentId::Delivery(role) => write!(formatter, "Delivery / {role:?}"),
        }
    }
}
