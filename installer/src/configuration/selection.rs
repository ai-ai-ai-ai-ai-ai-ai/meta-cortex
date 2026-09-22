use super::{AgentSettings, ConfigError, Configuration, Model, TeamSettings};
use derive_more::Display;
use dialoguer::Select;
use std::io::{self, IsTerminal};

#[derive(Clone, Copy, Debug)]
pub enum InitMode {
    Interactive,
    Bundled,
}

// clap owns the boolean flag; application behavior uses a named mode.
impl From<bool> for InitMode {
    fn from(interactive: bool) -> Self {
        if interactive {
            Self::Interactive
        } else {
            Self::Bundled
        }
    }
}

impl InitMode {
    pub fn configure(self) -> Result<Configuration, ConfigError> {
        let initial = Configuration::bundled()?;
        match self {
            Self::Bundled => Ok(initial),
            Self::Interactive => {
                if !io::stdin().is_terminal() || !io::stderr().is_terminal() {
                    return Err(ConfigError::TerminalRequired);
                }
                println!("Choose a model and reasoning effort for each role.");
                println!("Your AI host must support the selected model and effort.");
                let gizmo_prime = RolePrompt {
                    role: Role::GizmoPrime,
                    initial: initial.gizmo_prime,
                }
                .choose()?;
                let gizmo = RolePrompt {
                    role: Role::TeamGizmo,
                    initial: initial.team.gizmo,
                }
                .choose()?;
                let agent = RolePrompt {
                    role: Role::TeamAgent,
                    initial: initial.team.agent,
                }
                .choose()?;
                Ok(Configuration {
                    gizmo_prime,
                    team: TeamSettings { gizmo, agent },
                })
            }
        }
    }
}

#[derive(Clone, Copy, Display)]
enum Role {
    #[display("Gizmo Prime")]
    GizmoPrime,
    #[display("Team Gizmo")]
    TeamGizmo,
    #[display("Team agents")]
    TeamAgent,
}

struct RolePrompt {
    role: Role,
    initial: AgentSettings,
}

impl RolePrompt {
    fn choose(self) -> Result<AgentSettings, ConfigError> {
        let default_model = Model::ALL
            .iter()
            .position(|model| *model == self.initial.model)
            .ok_or(ConfigError::InvalidSelection)?;
        let selected = Select::new()
            .with_prompt(format!("{} model", self.role))
            .items(Model::ALL)
            .default(default_model)
            .interact_opt()?
            .ok_or(ConfigError::Cancelled)?;
        let model = *Model::ALL
            .get(selected)
            .ok_or(ConfigError::InvalidSelection)?;
        let efforts = model.efforts();
        let default_effort = efforts
            .iter()
            .position(|effort| *effort == self.initial.reasoning_effort)
            .ok_or(ConfigError::InvalidSelection)?;
        let selected = Select::new()
            .with_prompt(format!("{} reasoning effort", self.role))
            .items(efforts)
            .default(default_effort)
            .interact_opt()?
            .ok_or(ConfigError::Cancelled)?;
        let reasoning_effort = *efforts.get(selected).ok_or(ConfigError::InvalidSelection)?;
        Ok(AgentSettings {
            model,
            reasoning_effort,
        })
    }
}
