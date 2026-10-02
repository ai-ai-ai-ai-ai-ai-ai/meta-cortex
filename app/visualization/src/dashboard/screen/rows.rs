use super::super::navigation::{Navigation, Selected};
use super::super::presentation::Content;
use super::{ActorLabel, Surface, TaskDetail};
use derive_more::From;
use meta_cortex_workbench::model::{Event, Feature, Task};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{
    Block, Borders, List, ListItem, ListState, Paragraph, StatefulWidget, Widget, Wrap,
};
use std::cmp::Ordering;
use std::fmt;
use std::iter;

pub(super) struct RecordList<'a> {
    pub content: &'a Content,
    pub navigation: &'a Navigation,
}
impl RecordList<'_> {
    pub fn render(&self, surface: Surface<'_>) {
        let count = match self.content {
            Content::Features(page) => page.records.len(),
            Content::Tasks(page) => page.records.len(),
            Content::History(page) => page.records.len(),
            Content::Task(_) | Content::Event(_) | Content::Error(_) => 0,
        };
        let rows = u16::try_from(count.saturating_mul(2)).unwrap_or(u16::MAX);
        let [list, _gap, preview, _space] = Layout::vertical([
            Constraint::Length(rows.min(surface.area.height.saturating_sub(5))),
            Constraint::Length(1),
            Constraint::Min(3),
            Constraint::Fill(1),
        ])
        .areas(surface.area);
        let row_area = Rect {
            width: list.width.saturating_sub(2),
            ..list
        };
        let items = match self.content {
            Content::Features(page) => page
                .records
                .iter()
                .enumerate()
                .map(|(index, feature)| {
                    FeatureRow {
                        feature,
                        index: RowNumber::from(index),
                    }
                    .item(row_area)
                })
                .collect(),
            Content::Tasks(page) => page
                .records
                .iter()
                .enumerate()
                .map(|(index, task)| {
                    TaskRow {
                        task,
                        index: RowNumber::from(index),
                    }
                    .item(row_area)
                })
                .collect(),
            Content::History(page) => page
                .records
                .iter()
                .enumerate()
                .map(|(index, event)| {
                    EventRow {
                        event,
                        index: RowNumber::from(index),
                    }
                    .item(row_area)
                })
                .collect(),
            Content::Task(_) | Content::Event(_) | Content::Error(_) => Vec::new(),
        };
        let mut state = ListState::from(self.navigation.selection());
        StatefulWidget::render(
            List::new(items)
                .highlight_symbol("› ")
                .highlight_style(Style::default().bg(Color::Rgb(20, 55, 62))),
            list,
            surface.buffer,
            &mut state,
        );
        self.preview()
            .block(
                Block::default()
                    .borders(Borders::TOP)
                    .title(match count {
                        0 => " Empty ",
                        _ => " Selected ",
                    })
                    .border_style(Style::default().fg(Color::Rgb(155, 165, 179))),
            )
            .wrap(Wrap { trim: false })
            .scroll((self.navigation.scroll().lines(), 0))
            .render(preview, surface.buffer);
    }
    fn preview(&self) -> Paragraph<'static> {
        let selection = self.navigation.selection();
        let text = match self.content {
            Content::Features(page) => match selection.lookup(&page.records) {
                Selected::Record(feature) => vec![
                    Line::from(feature.objective.to_string()),
                    Line::from(format!("Branch  {}", feature.branch))
                        .style(Style::default().fg(Color::Rgb(155, 165, 179))),
                ],
                Selected::Empty => vec![Line::from("No recorded features on this page.")],
            },
            Content::Tasks(page) => match selection.lookup(&page.records) {
                Selected::Record(task) => vec![
                    Line::from(task.objective.to_string()),
                    Line::from(task.progress.summary.to_string())
                        .style(Style::default().fg(Color::Rgb(155, 165, 179))),
                ],
                Selected::Empty => vec![Line::from("No recorded tasks on this page.")],
            },
            Content::History(page) => match selection.lookup(&page.records) {
                Selected::Record(event) => vec![
                    Line::from(event.note.to_string()),
                    Line::from(format!(
                        "Recorded by  {}  ·  time {}",
                        ActorLabel(&event.actor),
                        event.task.last_update
                    ))
                    .style(Style::default().fg(Color::Rgb(155, 165, 179))),
                ],
                Selected::Empty => vec![Line::from("No recorded events on this page.")],
            },
            Content::Task(_) | Content::Event(_) | Content::Error(_) => vec![],
        };
        Paragraph::new(text)
    }
}
#[derive(From)]
struct RowNumber(usize);
impl fmt::Display for RowNumber {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self(index) = self;
        write!(formatter, "{:>2}", index.saturating_add(1))
    }
}
struct FeatureRow<'a> {
    feature: &'a Feature,
    index: RowNumber,
}
impl FeatureRow<'_> {
    fn item(&self, area: Rect) -> ListItem<'static> {
        let Self { feature, index } = self;
        ListItem::new(vec![
            EllipsisLine {
                line: Line::from(vec![
                    Span::styled(format!("{index:>2}  "), Style::default().fg(Color::Cyan)),
                    Span::styled(
                        feature.id.to_string(),
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                ]),
                area,
            }
            .fit(),
            EllipsisLine {
                line: Line::from(format!("    {}", feature.objective))
                    .style(Style::default().fg(Color::Rgb(155, 165, 179))),
                area,
            }
            .fit(),
        ])
    }
}
struct TaskRow<'a> {
    task: &'a Task,
    index: RowNumber,
}
impl TaskRow<'_> {
    fn item(&self, area: Rect) -> ListItem<'static> {
        let Self { task, index } = self;
        let prefix = Span::styled(format!("{index:>2}  "), Style::default().fg(Color::Cyan));
        let suffix = Line::from(vec![
            Span::raw("  "),
            TaskDetail(task).state(),
            Span::styled(
                format!("  r{}", task.revision),
                Style::default().fg(Color::Cyan),
            ),
        ]);
        let reserved =
            u16::try_from(prefix.width().saturating_add(suffix.width())).unwrap_or(u16::MAX);
        let identity = EllipsisLine {
            line: Line::from(task.id.to_string())
                .style(Style::default().add_modifier(Modifier::BOLD)),
            area: Rect {
                width: area.width.saturating_sub(reserved),
                ..area
            },
        }
        .fit();
        let primary = iter::once(prefix)
            .chain(identity.spans)
            .chain(suffix.spans)
            .collect::<Vec<_>>();
        ListItem::new(vec![
            Line::from(primary),
            EllipsisLine {
                line: Line::from(format!("    {}", task.objective))
                    .style(Style::default().fg(Color::Rgb(155, 165, 179))),
                area,
            }
            .fit(),
        ])
    }
}
struct EventRow<'a> {
    event: &'a Event,
    index: RowNumber,
}
impl EventRow<'_> {
    fn item(&self, area: Rect) -> ListItem<'static> {
        let Self { event, index } = self;
        ListItem::new(vec![
            EllipsisLine {
                line: Line::from(vec![
                    Span::styled(format!("{index:>2}  "), Style::default().fg(Color::Cyan)),
                    Span::styled(
                        format!("r{}  ", event.task.revision),
                        Style::default().fg(Color::Cyan),
                    ),
                    Span::styled(
                        format!("{:?}", event.kind),
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                    Span::styled(
                        format!("  · {}", ActorLabel(&event.actor)),
                        Style::default().fg(Color::Rgb(155, 165, 179)),
                    ),
                ]),
                area,
            }
            .fit(),
            EllipsisLine {
                line: Line::from(format!("    {}", event.note))
                    .style(Style::default().fg(Color::Rgb(155, 165, 179))),
                area,
            }
            .fit(),
        ])
    }
}
pub(super) struct EllipsisLine {
    pub line: Line<'static>,
    pub area: Rect,
}
impl EllipsisLine {
    pub fn fit(self) -> Line<'static> {
        let width = usize::from(self.area.width);
        match width {
            0 => Line::default(),
            _ => match self.line.width().cmp(&width) {
                Ordering::Less | Ordering::Equal => self.line,
                Ordering::Greater => self.truncated(),
            },
        }
    }
    fn truncated(self) -> Line<'static> {
        let width = usize::from(self.area.width);
        let mut spans = Vec::new();
        let mut used = 0usize;
        for grapheme in self.line.styled_graphemes(Style::default()) {
            let cells = Line::from(grapheme.symbol).width();
            match used.saturating_add(cells).cmp(&width.saturating_sub(1)) {
                Ordering::Greater => break,
                Ordering::Less | Ordering::Equal => {
                    spans.push(Span::styled(grapheme.symbol.to_owned(), grapheme.style));
                    used = used.saturating_add(cells);
                }
            }
        }
        spans.push(Span::raw("…"));
        Line::from(spans)
    }
}

#[cfg(test)]
mod tests {
    use super::EllipsisLine;
    use ratatui::layout::Rect;
    use ratatui::style::{Color, Style};
    use ratatui::text::{Line, Span};

    #[test]
    fn unicode_ellipsis_preserves_display_cell_budget_and_style() {
        for width in [0, 1, 2, 7, 18, 40] {
            let line = EllipsisLine {
                line: Line::from(vec![Span::styled(
                    "界面 🦀 é long recorded objective",
                    Style::default().fg(Color::Cyan),
                )]),
                area: Rect::new(0, 0, width, 1),
            }
            .fit();
            assert!(line.width() <= usize::from(width));
            match width {
                0 => assert!(line.to_string().is_empty()),
                40 => assert!(!line.to_string().ends_with('…')),
                _ => assert!(line.to_string().ends_with('…')),
            }
            assert!(
                line.spans
                    .iter()
                    .any(|span| span.style.fg == Some(Color::Cyan))
                    || width == 0
                    || width == 1
                    || width == 2
            );
        }
    }
}
