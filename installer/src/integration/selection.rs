use super::instructions::PreparedInstructions;
use super::{Harness, InstructionError, IntegrationPlan, ProjectHarnesses};
use crate::configuration::InitMode;
use clap::{Args, ValueEnum};
use dialoguer::{Confirm, Select};
use std::io::{self, IsTerminal};
use std::str::FromStr;

#[derive(Clone, Copy, Debug)]
pub enum HarnessChoice {
    Ask,
    Selected(Harness),
    None,
}

impl FromStr for HarnessChoice {
    type Err = InstructionError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "ask" => Ok(Self::Ask),
            "none" => Ok(Self::None),
            "codex" => Ok(Self::Selected(Harness::Codex)),
            "claude" => Ok(Self::Selected(Harness::Claude)),
            "cursor" => Ok(Self::Selected(Harness::Cursor)),
            _ => Err(InstructionError::InvalidHarness),
        }
    }
}

#[derive(Clone, Copy, Debug, ValueEnum)]
pub enum InstructionAction {
    Ask,
    Write,
    Skip,
}

impl From<bool> for InstructionAction {
    fn from(consent: bool) -> Self {
        if consent { Self::Write } else { Self::Skip }
    }
}

#[derive(Args)]
pub struct IntegrationOptions {
    /// Harness to connect: codex, claude, cursor, or none. Default: none, or ask with --interactive.
    #[arg(long, default_value = "ask", hide_default_value = true)]
    pub harness: HarnessChoice,
    /// Write or skip harness instructions. Default: skip, or ask with --interactive.
    #[arg(long, value_enum, default_value = "ask", hide_default_value = true)]
    pub instructions: InstructionAction,
}

pub struct IntegrationRequest {
    pub project: ProjectHarnesses,
    pub mode: InitMode,
}

impl IntegrationOptions {
    pub fn plan(self, request: IntegrationRequest) -> Result<IntegrationPlan, InstructionError> {
        let choice = match self.harness {
            HarnessChoice::Ask => match request.mode {
                InitMode::Bundled => HarnessChoice::None,
                InitMode::Interactive => request.project.choose()?,
            },
            selected @ (HarnessChoice::Selected(_) | HarnessChoice::None) => selected,
        };
        let harness = match choice {
            HarnessChoice::None => return Ok(IntegrationPlan::Skip),
            HarnessChoice::Selected(harness) => harness,
            HarnessChoice::Ask => return Err(InstructionError::InvalidHarness),
        };
        if matches!(self.instructions, InstructionAction::Skip) {
            return Ok(IntegrationPlan::Skip);
        }
        let target = request.project.target(harness)?;
        let action = match self.instructions {
            InstructionAction::Ask => {
                if matches!(request.mode, InitMode::Bundled) {
                    return Ok(IntegrationPlan::Skip);
                }
                Self::require_terminal()?;
                target.check_parents()?;
                let prompt = match target.path().symlink_metadata() {
                    Ok(_) => format!(
                        "Add Meta-Cortex instructions to {} for {}?",
                        target.relative.display(),
                        target.harness
                    ),
                    Err(error) if error.kind() == io::ErrorKind::NotFound => format!(
                        "Create {} with Meta-Cortex instructions for {}?",
                        target.relative.display(),
                        target.harness
                    ),
                    Err(error) => return Err(error.into()),
                };
                match Confirm::new()
                    .with_prompt(prompt)
                    .wait_for_newline(true)
                    .default(false)
                    .interact_opt()?
                {
                    Some(consent) => InstructionAction::from(consent),
                    None => return Err(InstructionError::Cancelled),
                }
            }
            action @ (InstructionAction::Write | InstructionAction::Skip) => action,
        };
        match action {
            InstructionAction::Write => {
                Ok(IntegrationPlan::Write(PreparedInstructions::read(target)?))
            }
            InstructionAction::Skip => Ok(IntegrationPlan::Skip),
            InstructionAction::Ask => Err(InstructionError::ExplicitChoiceRequired),
        }
    }

    fn require_terminal() -> Result<(), InstructionError> {
        if io::stdin().is_terminal() && io::stderr().is_terminal() {
            Ok(())
        } else {
            Err(InstructionError::TerminalRequired)
        }
    }
}

impl ProjectHarnesses {
    fn choose(&self) -> Result<HarnessChoice, InstructionError> {
        IntegrationOptions::require_terminal()?;
        println!("Choose the AI harness you use for this project.");
        let mut menu = Vec::new();
        for harness in Harness::ALL {
            let target = self.target(harness)?;
            let detection = if self.root.join(harness.marker()).symlink_metadata().is_ok()
                || target.path().symlink_metadata().is_ok()
            {
                "detected"
            } else {
                "not detected"
            };
            menu.push(format!(
                "{harness} — {detection}; {}",
                target.relative.display()
            ));
        }
        menu.push("None — install the framework without connecting a harness".to_owned());
        match Select::new()
            .with_prompt("Harness")
            .items(&menu)
            .interact_opt()?
        {
            Some(index) => match Harness::ALL.get(index) {
                Some(harness) => Ok(HarnessChoice::Selected(*harness)),
                None => Ok(HarnessChoice::None),
            },
            None => Err(InstructionError::Cancelled),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{HarnessChoice, InstructionAction, IntegrationOptions, IntegrationRequest};
    use crate::configuration::InitMode;
    use crate::integration::{Harness, InstructionError, IntegrationPlan, ProjectHarnesses};
    use tempfile::tempdir;

    #[test]
    fn bundled_mode_skips_unspecified_instructions_without_prompting()
    -> Result<(), InstructionError> {
        let directory = tempdir()?;
        for harness in [HarnessChoice::Ask, HarnessChoice::Selected(Harness::Codex)] {
            let plan = IntegrationOptions {
                harness,
                instructions: InstructionAction::Ask,
            }
            .plan(IntegrationRequest {
                project: ProjectHarnesses {
                    root: directory.path().to_path_buf(),
                },
                mode: InitMode::Bundled,
            })?;
            assert!(matches!(plan, IntegrationPlan::Skip));
        }
        Ok(())
    }
}
