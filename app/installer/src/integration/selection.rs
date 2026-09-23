use super::instructions::PreparedInstructions;
use super::{Harness, InstructionError, IntegrationPlan, ProjectHarnesses};

#[derive(Clone, Copy, Debug)]
pub enum HarnessChoice {
    Selected(Harness),
    None,
}

#[derive(Clone, Copy, Debug)]
pub enum InstructionAction {
    Write,
    Skip,
}

pub struct IntegrationOptions {
    pub harness: HarnessChoice,
    pub instructions: InstructionAction,
}

impl IntegrationOptions {
    pub fn plan(self, project: ProjectHarnesses) -> Result<IntegrationPlan, InstructionError> {
        match self.instructions {
            InstructionAction::Skip => Ok(IntegrationPlan::Skip),
            InstructionAction::Write => match self.harness {
                HarnessChoice::None => Ok(IntegrationPlan::Skip),
                HarnessChoice::Selected(harness) => Ok(IntegrationPlan::Write(
                    PreparedInstructions::read(project.target(harness)?)?,
                )),
            },
        }
    }
}
