use super::{AgentSettings, ConfigError, ConfigText, Configuration, Effort, Model, TeamSettings};

impl Model {
    const ALL: [Self; 5] = [Self::Luna, Self::Terra, Self::Sol, Self::Luna6, Self::Astra];
}

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
    let text = ConfigText::try_from(Configuration {
        gizmo_prime: AgentSettings {
            model: Model::Terra,
            reasoning_effort: Effort::Low,
        },
        team: TeamSettings {
            gizmo: AgentSettings {
                model: Model::Sol,
                reasoning_effort: Effort::Medium,
            },
            agent: AgentSettings {
                model: Model::Luna,
                reasoning_effort: Effort::Xhigh,
            },
        },
    })?
    .to_string();
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

#[test]
fn gpt_6_luna_rejects_ultra_effort() {
    let settings = AgentSettings {
        model: Model::Luna6,
        reasoning_effort: Effort::Ultra,
    };
    let config = Configuration {
        gizmo_prime: settings,
        team: TeamSettings {
            gizmo: settings,
            agent: settings,
        },
    };

    assert!(matches!(
        ConfigText::try_from(config),
        Err(ConfigError::UnsupportedEffort {
            model: Model::Luna6,
            effort: Effort::Ultra
        })
    ));
}
