use super::DashboardError;
use super::navigation::{Action, Direction, Navigation};
use super::presentation::Content;
use super::screen::DashboardScreen;
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use ratatui::DefaultTerminal;
use std::io::{self, IsTerminal};
use std::time::Duration;

enum EventAvailability {
    Pending,
    Ready,
}
impl From<bool> for EventAvailability {
    fn from(ready: bool) -> Self {
        match ready {
            false => Self::Pending,
            true => Self::Ready,
        }
    }
}
enum TerminalPresence {
    Attached,
    Detached,
}
impl From<bool> for TerminalPresence {
    fn from(attached: bool) -> Self {
        match attached {
            true => Self::Attached,
            false => Self::Detached,
        }
    }
}
impl TerminalPresence {
    fn require(self) -> Result<(), DashboardError> {
        match self {
            Self::Attached => Ok(()),
            Self::Detached => Err(DashboardError::TerminalRequired),
        }
    }
}
pub(super) struct TerminalFrame<'a> {
    pub content: &'a Content,
    pub navigation: &'a Navigation,
}
enum Restoration {
    Active,
    Restored,
}
pub(super) struct TerminalSession {
    terminal: DefaultTerminal,
    restoration: Restoration,
}
impl TerminalSession {
    pub fn open() -> Result<Self, DashboardError> {
        TerminalPresence::from(io::stdin().is_terminal()).require()?;
        TerminalPresence::from(io::stdout().is_terminal()).require()?;
        let terminal = match ratatui::try_init() {
            Ok(terminal) => terminal,
            Err(error) => {
                ratatui::restore();
                return Err(error.into());
            }
        };
        Ok(Self {
            terminal,
            restoration: Restoration::Active,
        })
    }
    // Ratatui's externally owned terminal resource requires a mutable borrow for draw.
    pub fn draw(&mut self, content: TerminalFrame<'_>) -> io::Result<()> {
        self.terminal.draw(|frame| {
            frame.render_widget(
                DashboardScreen {
                    content: content.content,
                    navigation: content.navigation,
                },
                frame.area(),
            );
        })?;
        Ok(())
    }
    pub fn action(&self) -> io::Result<Action> {
        match EventAvailability::from(event::poll(Duration::from_millis(500))?) {
            EventAvailability::Pending => Ok(Action::Refresh),
            EventAvailability::Ready => Ok(Action::from(event::read()?)),
        }
    }
    pub fn close(mut self) -> io::Result<()> {
        ratatui::try_restore()?;
        self.restoration = Restoration::Restored;
        Ok(())
    }
}
impl Drop for TerminalSession {
    fn drop(&mut self) {
        match self.restoration {
            Restoration::Active => ratatui::restore(),
            Restoration::Restored => {}
        }
    }
}
impl From<Event> for Action {
    fn from(event: Event) -> Self {
        let Event::Key(key) = event else {
            return Self::Refresh;
        };
        match key.kind {
            KeyEventKind::Press | KeyEventKind::Repeat => Self::from(key),
            KeyEventKind::Release => Self::Refresh,
        }
    }
}
impl From<KeyEvent> for Action {
    fn from(key: KeyEvent) -> Self {
        match key.code {
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => Self::Quit,
            KeyCode::Char('q') => Self::Quit,
            KeyCode::Up | KeyCode::Char('k') => Self::Select(Direction::Up),
            KeyCode::Down | KeyCode::Char('j') => Self::Select(Direction::Down),
            KeyCode::Char('K') | KeyCode::PageUp => Self::Scroll(Direction::Up),
            KeyCode::Char('J') | KeyCode::PageDown => Self::Scroll(Direction::Down),
            KeyCode::Enter => Self::Enter,
            KeyCode::Esc | KeyCode::Backspace => Self::Back,
            KeyCode::Char('h') => Self::History,
            KeyCode::Char('n') => Self::NextPage,
            KeyCode::Char('p') => Self::PreviousPage,
            KeyCode::Left
            | KeyCode::Right
            | KeyCode::Home
            | KeyCode::End
            | KeyCode::Tab
            | KeyCode::BackTab
            | KeyCode::Delete
            | KeyCode::Insert
            | KeyCode::F(_)
            | KeyCode::Char(_)
            | KeyCode::Null
            | KeyCode::CapsLock
            | KeyCode::ScrollLock
            | KeyCode::NumLock
            | KeyCode::PrintScreen
            | KeyCode::Pause
            | KeyCode::Menu
            | KeyCode::KeypadBegin
            | KeyCode::Media(_)
            | KeyCode::Modifier(_) => Self::Refresh,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::{Action, Direction};
    use crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
    #[test]
    fn keyboard_adapter_maps_navigation_and_ignores_release_and_other_events() {
        for code in [
            KeyCode::Char('q'),
            KeyCode::Char('j'),
            KeyCode::Char('k'),
            KeyCode::Down,
            KeyCode::Up,
            KeyCode::Char('J'),
            KeyCode::Char('K'),
            KeyCode::PageDown,
            KeyCode::PageUp,
            KeyCode::Enter,
            KeyCode::Esc,
            KeyCode::Backspace,
            KeyCode::Char('h'),
            KeyCode::Char('n'),
            KeyCode::Char('p'),
            KeyCode::Char('r'),
        ] {
            let _action = Action::from(Event::Key(KeyEvent::new(code, KeyModifiers::NONE)));
        }
        assert!(matches!(
            Action::from(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL)),
            Action::Quit
        ));
        assert!(matches!(
            Action::from(KeyEvent::new(KeyCode::Down, KeyModifiers::NONE)),
            Action::Select(Direction::Down)
        ));
        assert!(matches!(
            Action::from(KeyEvent::new(KeyCode::Up, KeyModifiers::NONE)),
            Action::Select(Direction::Up)
        ));
        assert!(matches!(
            Action::from(Event::Resize(80, 24)),
            Action::Refresh
        ));
        let key = KeyEvent::new_with_kind(
            KeyCode::Char('q'),
            KeyModifiers::NONE,
            KeyEventKind::Release,
        );
        assert!(matches!(Action::from(Event::Key(key)), Action::Refresh));
    }
}
