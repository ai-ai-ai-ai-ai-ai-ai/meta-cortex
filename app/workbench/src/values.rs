use super::LedgerError;
use derive_more::{Display, From};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(
    Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(try_from = "String")]
pub struct TaskId(String);

impl TryFrom<String> for TaskId {
    type Error = LedgerError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.is_empty()
            || value.len() > 128
            || !value
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        {
            return Err(LedgerError::Invalid(
                "task IDs require 1–128 ASCII letters, digits, -, _, or .",
            ));
        }
        Ok(Self(value))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "String")]
pub struct FeatureId(String);

impl TryFrom<String> for FeatureId {
    type Error = LedgerError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        TaskId::try_from(value.clone())?;
        Ok(Self(value))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "String")]
pub struct AgentId(String);

impl TryFrom<String> for AgentId {
    type Error = LedgerError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        TaskId::try_from(value.clone())?;
        Ok(Self(value))
    }
}

// Preserve the established string wire format; emptiness is a domain state.
#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(from = "String", into = "String")]
pub enum Note {
    #[display("")]
    Empty,
    #[display("{_0}")]
    Text(NoteText),
}

// Construction belongs to Note so Text cannot contain an empty string.
#[derive(Clone, Debug, PartialEq, Eq, Display)]
pub struct NoteText(String);

impl From<String> for Note {
    fn from(value: String) -> Self {
        if value.is_empty() {
            Self::Empty
        } else {
            Self::Text(NoteText(value))
        }
    }
}

impl From<Note> for String {
    fn from(note: Note) -> Self {
        match note {
            Note::Empty => Self::new(),
            Note::Text(NoteText(text)) => text,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "String")]
pub struct BranchName(String);

impl TryFrom<String> for BranchName {
    type Error = LedgerError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.is_empty() || value.starts_with('-') || value.contains(char::is_whitespace) {
            return Err(LedgerError::Invalid("invalid branch name"));
        }
        Ok(Self(value))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "String")]
pub struct CommitId(String);

impl TryFrom<String> for CommitId {
    type Error = LedgerError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if !matches!(value.len(), 40 | 64) || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Err(LedgerError::Invalid(
                "commit must be a full 40- or 64-character object ID",
            ));
        }
        Ok(Self(value.to_ascii_lowercase()))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
pub struct Revision(i64);

impl Revision {
    pub const INITIAL: Self = Self(1);
    pub fn advance(self) -> Result<Self, LedgerError> {
        let Self(value) = self;
        value
            .checked_add(1)
            .map(Self)
            .ok_or(LedgerError::Invalid("revision overflow"))
    }
}

impl TryFrom<i64> for Revision {
    type Error = LedgerError;
    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 1 {
            return Err(LedgerError::Invalid("revision must be positive"));
        }
        Ok(Self(value))
    }
}

impl From<Revision> for i64 {
    fn from(value: Revision) -> Self {
        let Revision(revision) = value;
        revision
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
pub struct Attempt(i64);

impl Attempt {
    pub const UNCLAIMED: Self = Self(0);
    pub fn advance(self) -> Result<Self, LedgerError> {
        let Self(value) = self;
        value
            .checked_add(1)
            .map(Self)
            .ok_or(LedgerError::Invalid("attempt overflow"))
    }
}

impl TryFrom<i64> for Attempt {
    type Error = LedgerError;
    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 0 {
            return Err(LedgerError::Invalid("attempt must not be negative"));
        }
        Ok(Self(value))
    }
}

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(try_from = "i64")]
pub struct Timestamp(i64);

impl Timestamp {
    pub fn now() -> Result<Self, LedgerError> {
        let value = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis();
        Ok(Self(
            i64::try_from(value).map_err(|_| LedgerError::Invalid("timestamp overflow"))?,
        ))
    }
    pub fn expires(self, ttl: LeaseSeconds) -> Result<Self, LedgerError> {
        let Self(timestamp) = self;
        let LeaseSeconds(seconds) = ttl;
        timestamp
            .checked_add(seconds * 1000)
            .map(Self)
            .ok_or(LedgerError::Invalid("timestamp overflow"))
    }
}

impl TryFrom<i64> for Timestamp {
    type Error = LedgerError;
    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 0 {
            return Err(LedgerError::Invalid("timestamp must not be negative"));
        }
        Ok(Self(value))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
pub struct LeaseSeconds(i64);

impl TryFrom<i64> for LeaseSeconds {
    type Error = LedgerError;
    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if !(1..=86400).contains(&value) {
            return Err(LedgerError::Invalid(
                "ttl_seconds must be between 1 and 86400",
            ));
        }
        Ok(Self(value))
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize, JsonSchema, From)]
#[serde(transparent)]
pub struct Extensions(pub BTreeMap<String, serde_json::Value>);

#[cfg(test)]
mod tests {
    use super::Note;

    #[test]
    fn note_states_preserve_string_wire_values() -> serde_json::Result<()> {
        assert_eq!(Note::from(String::new()), Note::Empty);
        assert_eq!(Note::Empty.to_string(), "");
        assert_eq!(String::from(Note::Empty), "");
        for text in ["", " ", "\t\n", "Progress: \"ready\"\n次の作業"] {
            let note = Note::from(text.to_owned());
            match &note {
                Note::Empty => assert_eq!(text, ""),
                Note::Text(content) => {
                    assert!(!text.is_empty());
                    assert_eq!(content.to_string(), text);
                }
            }
            let encoded = serde_json::to_string(&note)?;
            assert_eq!(encoded, serde_json::to_string(text)?);
            assert_eq!(serde_json::from_str::<Note>(&encoded)?, note);
            assert_eq!(note.to_string(), text);
            assert_eq!(String::from(note), text);
        }
        Ok(())
    }

    #[test]
    fn notes_still_require_string_input() {
        for invalid in ["null", "42", "{}", "[]", "true"] {
            assert!(serde_json::from_str::<Note>(invalid).is_err());
        }
    }
}
