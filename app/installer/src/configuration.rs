use std::num::NonZeroU32;

use thiserror::Error;

use derive_more::{Display, From};
use serde::{Deserialize, Serialize};
use toml::{de, ser};

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("invalid meta-cortex.toml: {0}")]
    Decode(#[from] de::Error),
    #[error("could not encode meta-cortex.toml: {0}")]
    Encode(#[from] ser::Error),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct MaxTotalAgents(NonZeroU32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostSettings {
    pub max_total_agents: MaxTotalAgents,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Configuration {
    pub host: HostSettings,
}

impl Configuration {
    pub fn bundled() -> Result<Self, ConfigError> {
        ConfigText::from(include_str!("../../../cortex/meta-cortex.toml").to_owned()).parse()
    }
}

#[derive(Debug, From, Display)]
pub struct ConfigText(String);

impl ConfigText {
    pub fn parse(&self) -> Result<Configuration, ConfigError> {
        let Self(text) = self;
        Ok(toml::from_str(text)?)
    }

    pub fn as_bytes(&self) -> &[u8] {
        let Self(text) = self;
        text.as_bytes()
    }
}

impl TryFrom<Configuration> for ConfigText {
    type Error = ConfigError;

    fn try_from(config: Configuration) -> Result<Self, Self::Error> {
        Ok(Self(toml::to_string_pretty(&config)?))
    }
}

#[cfg(test)]
mod tests {
    use std::num::NonZeroU32;

    use super::{ConfigError, ConfigText, Configuration, MaxTotalAgents};

    impl MaxTotalAgents {
        const STANDARD: Self = Self(NonZeroU32::MIN.saturating_add(19));
    }

    #[test]
    fn bundled_configuration_contains_only_host_capacity() -> Result<(), ConfigError> {
        let config = Configuration::bundled()?;
        assert_eq!(config.host.max_total_agents, MaxTotalAgents::STANDARD);
        let encoded = ConfigText::try_from(config)?;
        assert_eq!(encoded.parse()?, config);
        assert_eq!(encoded.to_string(), "[host]\nmax_total_agents = 20\n");
        Ok(())
    }

    #[test]
    fn rejects_static_execution_settings() -> Result<(), ConfigError> {
        let text = ConfigText::try_from(Configuration::bundled()?)?.to_string();
        for obsolete in [
            "[gizmo-prime]\nmodel = \"gpt-6.1-sol\"\nreasoning_effort = \"low\"",
            "[team.gizmo]\nmodel = \"gpt-6.1-sol\"\nreasoning_effort = \"low\"",
            "[team.agent]\nmodel = \"gpt-6.1-sol\"\nreasoning_effort = \"low\"",
            "model = \"gpt-6.1-sol\"",
            "reasoning_effort = \"max\"",
            "service_tier = \"priority\"",
            "mode = \"fast\"",
        ] {
            assert!(matches!(
                ConfigText::from(format!("{text}\n{obsolete}\n")).parse(),
                Err(ConfigError::Decode(_))
            ));
        }
        Ok(())
    }

    #[test]
    fn custom_host_capacity_round_trips() -> Result<(), ConfigError> {
        let text = ConfigText::try_from(Configuration::bundled()?)?.to_string();
        let customized =
            ConfigText::from(text.replace("max_total_agents = 20", "max_total_agents = 37"));
        let config = customized.parse()?;
        assert_ne!(config.host.max_total_agents, MaxTotalAgents::STANDARD);
        let encoded = ConfigText::try_from(config)?;
        assert_eq!(encoded.parse()?, config);
        assert!(encoded.to_string().contains("max_total_agents = 37"));
        Ok(())
    }

    #[test]
    fn accepts_single_agent_ceiling_and_rejects_the_old_minimum() -> Result<(), ConfigError> {
        let config = Configuration {
            host: super::HostSettings {
                max_total_agents: MaxTotalAgents(NonZeroU32::MIN),
            },
        };
        let encoded = ConfigText::try_from(config)?;
        assert_eq!(encoded.parse()?, config);
        assert!(matches!(
            ConfigText::from("[host]\nrequired_total_agents = 20\n".to_owned()).parse(),
            Err(ConfigError::Decode(_))
        ));
        Ok(())
    }

    #[test]
    fn rejects_invalid_or_missing_host_capacity() -> Result<(), ConfigError> {
        let text = ConfigText::try_from(Configuration::bundled()?)?.to_string();
        for value in ["0", "-1", "1.5", "true", "\"20\"", "4294967296"] {
            let invalid = text.replace(
                "max_total_agents = 20",
                &format!("max_total_agents = {value}"),
            );
            assert!(matches!(
                ConfigText::from(invalid).parse(),
                Err(ConfigError::Decode(_))
            ));
        }
        for invalid in [
            text.replace("max_total_agents = 20", ""),
            text.replace("[host]\nmax_total_agents = 20", ""),
            text.replace("[host]", "[host]\nunknown = true"),
        ] {
            assert!(matches!(
                ConfigText::from(invalid).parse(),
                Err(ConfigError::Decode(_))
            ));
        }
        Ok(())
    }
}
