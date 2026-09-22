use thiserror::Error;
mod selection;

pub use selection::InitMode;

use derive_more::{Display, From};
use serde::{Deserialize, Serialize};
use toml::{de, ser};

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("invalid meta-cortex.toml: {0}")]
    Decode(#[from] de::Error),
    #[error("could not encode meta-cortex.toml: {0}")]
    Encode(#[from] ser::Error),
    #[error("{model} does not support reasoning effort {effort}")]
    UnsupportedEffort { model: Model, effort: Effort },
    #[error(
        "model selection requires a terminal; use --non-interactive to accept the bundled settings"
    )]
    TerminalRequired,
    #[error("initialization cancelled; no project files were written")]
    Cancelled,
    #[error("model selection failed: {0}")]
    Prompt(#[from] dialoguer::Error),
    #[error("the selected item is not in the model menu")]
    InvalidSelection,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Display)]
pub enum Model {
    #[serde(rename = "gpt-5.6-luna")]
    #[display("gpt-5.6-luna")]
    Luna,
    #[serde(rename = "gpt-5.6-terra")]
    #[display("gpt-5.6-terra")]
    Terra,
    #[serde(rename = "gpt-5.6-sol")]
    #[display("gpt-5.6-sol")]
    Sol,
    #[serde(rename = "gpt-6-astra")]
    #[display("gpt-6-astra")]
    Astra,
}

impl Model {
    pub const ALL: [Self; 4] = [Self::Luna, Self::Terra, Self::Sol, Self::Astra];

    pub fn efforts(self) -> &'static [Effort] {
        match self {
            Self::Luna => &Effort::ALL[..5],
            Self::Terra | Self::Sol | Self::Astra => &Effort::ALL,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Display)]
#[serde(rename_all = "lowercase")]
pub enum Effort {
    #[display("low")]
    Low,
    #[display("medium")]
    Medium,
    #[display("high")]
    High,
    #[display("xhigh")]
    Xhigh,
    #[display("max")]
    Max,
    #[display("ultra")]
    Ultra,
}

impl Effort {
    const ALL: [Self; 6] = [
        Self::Low,
        Self::Medium,
        Self::High,
        Self::Xhigh,
        Self::Max,
        Self::Ultra,
    ];
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AgentSettings {
    pub model: Model,
    pub reasoning_effort: Effort,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TeamSettings {
    pub gizmo: AgentSettings,
    pub agent: AgentSettings,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Configuration {
    // Preserve the framework's existing, published TOML key.
    #[serde(rename = "gizmo-prime")]
    pub gizmo_prime: AgentSettings,
    pub team: TeamSettings,
}

impl AgentSettings {
    fn validate(self) -> Result<(), ConfigError> {
        if self.model.efforts().contains(&self.reasoning_effort) {
            Ok(())
        } else {
            Err(ConfigError::UnsupportedEffort {
                model: self.model,
                effort: self.reasoning_effort,
            })
        }
    }
}

impl Configuration {
    pub fn bundled() -> Result<Self, ConfigError> {
        ConfigText::from(include_str!("../../../cortex/meta-cortex.toml").to_owned()).parse()
    }

    fn validate(self) -> Result<Self, ConfigError> {
        self.gizmo_prime.validate()?;
        self.team.gizmo.validate()?;
        self.team.agent.validate()?;
        Ok(self)
    }
}

#[derive(Debug, From, Display)]
pub struct ConfigText(String);

impl ConfigText {
    pub fn parse(&self) -> Result<Configuration, ConfigError> {
        let config: Configuration = toml::from_str(&self.0)?;
        config.validate()
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.0.as_bytes()
    }
}

impl TryFrom<Configuration> for ConfigText {
    type Error = ConfigError;

    fn try_from(config: Configuration) -> Result<Self, Self::Error> {
        Ok(Self(toml::to_string_pretty(&config.validate()?)?))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        AgentSettings, ConfigError, ConfigText, Configuration, Effort, Model, TeamSettings,
    };

    #[test]
    fn supported_model_efforts_round_trip() -> Result<(), ConfigError> {
        for model in Model::ALL {
            for &reasoning_effort in model.efforts() {
                let settings = AgentSettings {
                    model,
                    reasoning_effort,
                };
                let config = Configuration {
                    gizmo_prime: settings,
                    team: TeamSettings {
                        gizmo: settings,
                        agent: settings,
                    },
                };
                let encoded = ConfigText::try_from(config)?;
                assert_eq!(encoded.parse()?, config);
                assert!(
                    encoded
                        .to_string()
                        .contains(&format!("model = \"{model}\""))
                );
                assert!(
                    encoded
                        .to_string()
                        .contains(&format!("reasoning_effort = \"{reasoning_effort}\""))
                );
            }
        }
        Ok(())
    }

    #[test]
    fn rejects_invalid_or_incomplete_configuration() -> Result<(), ConfigError> {
        let text = ConfigText::try_from(Configuration::bundled()?)?.to_string();
        for invalid in [
            text.replace("gpt-5.6-terra", "unknown-model"),
            text.replace("\"low\"", "\"extreme\""),
            text.replace("[team.agent]", "[team.other]"),
            text.replace("reasoning_effort = \"low\"", ""),
            format!("{text}\nextra = true\n"),
            String::from("not valid TOML"),
        ] {
            assert!(ConfigText::from(invalid).parse().is_err());
        }
        let invalid = text.replace("\"xhigh\"", "\"ultra\"");
        assert!(matches!(
            ConfigText::from(invalid).parse(),
            Err(ConfigError::UnsupportedEffort {
                model: Model::Luna,
                effort: Effort::Ultra
            })
        ));
        Ok(())
    }
}
