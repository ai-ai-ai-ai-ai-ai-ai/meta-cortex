use serde::Deserialize;
use std::path::PathBuf;
use thiserror::Error;

// This is the CLI's external YAML contract, decoded independently of its writer.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct InfoDocument {
    pub(super) schema_version: ReportSchemaVersion,
    pub(super) cli_version: ReportVersion,
    pub(super) framework_version: ReportVersion,
    pub(super) paths: ReportPaths,
    pub(super) integrations: Vec<ReportIntegration>,
    pub(super) models: ReportModels,
    pub(super) model_availability: ModelAvailability,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(try_from = "u32")]
pub(super) enum ReportSchemaVersion {
    V5,
}

#[derive(Debug, Error)]
pub(super) enum ReportSchemaVersionError {
    #[error("unsupported report schema version")]
    Unsupported,
}

impl TryFrom<u32> for ReportSchemaVersion {
    type Error = ReportSchemaVersionError;

    fn try_from(version: u32) -> Result<Self, Self::Error> {
        match version {
            5 => Ok(Self::V5),
            _ => Err(ReportSchemaVersionError::Unsupported),
        }
    }
}

// Independent decoder for the established semantic-release strings in report schema 5.
#[derive(Debug, PartialEq, Eq, Deserialize)]
pub(super) enum ReportVersion {
    #[serde(rename = "0.6.2")]
    V0_6_2,
    #[serde(rename = "0.7.0")]
    V0_7_0,
    #[serde(rename = "0.8.0")]
    V0_8_0,
    #[serde(rename = "0.8.1")]
    V0_8_1,
    #[serde(rename = "0.9.0")]
    V0_9_0,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
pub(super) enum Integration {
    Connected,
    Missing,
    Conflict,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
pub(super) enum ReportHarness {
    Codex,
    Claude,
    Cursor,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ReportIntegration {
    pub(super) harness: ReportHarness,
    pub(super) path: PathBuf,
    pub(super) status: Integration,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
pub(super) enum ModelAvailability {
    NotChecked,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ReportPaths {
    pub(super) project: PathBuf,
    pub(super) framework: PathBuf,
    pub(super) configuration: PathBuf,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ReportModels {
    #[serde(rename = "gizmo-prime")]
    pub(super) gizmo_prime: ReportAgent,
    pub(super) team: ReportTeam,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ReportTeam {
    pub(super) gizmo: ReportAgent,
    pub(super) agent: ReportAgent,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ReportAgent {
    pub(super) model: String,
    pub(super) reasoning_effort: String,
    pub(super) service_tier: ReportServiceTier,
}

#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum ReportServiceTier {
    Priority,
}

#[cfg(test)]
pub mod tests {
    use super::{ReportSchemaVersion, ReportVersion};

    #[test]
    fn report_consumer_rejects_undeclared_or_malformed_versions() {
        for input in ["0", "1", "2", "3", "4", "6", "-1", "3.5", "\"6\"", "null"] {
            assert!(
                serde_saphyr::from_str::<ReportSchemaVersion>(input).is_err(),
                "{input}"
            );
        }
        for input in [
            "arbitrary",
            "0.0.1",
            "0.6.3",
            "0.6.2-beta.1",
            "v0.6.2",
            "6",
            "null",
        ] {
            assert!(
                serde_saphyr::from_str::<ReportVersion>(input).is_err(),
                "{input}"
            );
        }
    }
}
