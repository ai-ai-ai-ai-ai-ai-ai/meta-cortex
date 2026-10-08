use crate::LedgerError;
use crate::values::{IdentifierParseError, Note, TaskId};
use derive_more::Display;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Stable identity within one task, independent of summary text or checkpoint SHA.
#[derive(
    Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(try_from = "String")]
#[schemars(with = "String")]
pub struct OutcomeId(TaskId);

impl TryFrom<String> for OutcomeId {
    type Error = IdentifierParseError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        TaskId::try_from(value).map(Self)
    }
}

/// An explicitly recorded completed implementation milestone included by a checkpoint.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CheckpointOutcome {
    pub id: OutcomeId,
    pub summary: Note,
    pub detail: Note,
}

impl CheckpointOutcome {
    /// A checkpoint replaces its task's complete set; identical text is not identity.
    pub(crate) fn require_distinct(outcomes: &[Self]) -> Result<(), LedgerError> {
        let mut seen = BTreeSet::new();
        for outcome in outcomes {
            match seen.insert(&outcome.id) {
                true => {}
                false => return Err(LedgerError::Invalid("duplicate checkpoint outcome id")),
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{CheckpointOutcome, OutcomeId};
    use crate::values::Note;

    #[test]
    fn outcome_identity_validates_and_preserves_text_independently() -> anyhow::Result<()> {
        let first = CheckpointOutcome {
            id: OutcomeId::try_from("first".to_owned())?,
            summary: Note::from("Same summary".to_owned()),
            detail: Note::Empty,
        };
        let second = CheckpointOutcome {
            id: OutcomeId::try_from("second".to_owned())?,
            ..first.clone()
        };
        CheckpointOutcome::require_distinct(&[first.clone(), second])?;
        assert!(CheckpointOutcome::require_distinct(&[first.clone(), first.clone()]).is_err());
        let encoded = serde_json::to_string(&first)?;
        assert_eq!(serde_json::from_str::<CheckpointOutcome>(&encoded)?, first);
        for invalid in ["", "two words", "../outcome"] {
            assert!(OutcomeId::try_from(invalid.to_owned()).is_err());
            assert!(serde_json::from_str::<OutcomeId>(&serde_json::to_string(invalid)?).is_err());
        }
        Ok(())
    }
}
