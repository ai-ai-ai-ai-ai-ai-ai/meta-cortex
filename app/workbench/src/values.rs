use super::LedgerError;
use derive_more::{Display, From};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

#[derive(
    Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(try_from = "String")]
#[schemars(with = "String")]
pub struct TaskId(String);

impl TryFrom<String> for TaskId {
    type Error = IdentifierParseError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.is_empty() {
            return Err(IdentifierParseError::Empty);
        }
        if value.len() > 128 {
            return Err(IdentifierParseError::TooLong);
        }
        if !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        {
            return Err(IdentifierParseError::InvalidCharacters);
        }
        Ok(TaskId(value))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "String")]
#[schemars(with = "String")]
pub struct FeatureId(String);

impl TryFrom<String> for FeatureId {
    type Error = IdentifierParseError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.is_empty() {
            return Err(IdentifierParseError::Empty);
        }
        if value.len() > 128 {
            return Err(IdentifierParseError::TooLong);
        }
        if !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        {
            return Err(IdentifierParseError::InvalidCharacters);
        }
        Ok(FeatureId(value))
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
#[schemars(with = "String")]
pub struct BranchName(String);

impl TryFrom<String> for BranchName {
    type Error = BranchNameParseError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.is_empty() {
            return Err(BranchNameParseError::Empty);
        }
        if value.starts_with('-') {
            return Err(BranchNameParseError::LeadingDash);
        }
        if value.contains(char::is_whitespace) {
            return Err(BranchNameParseError::Whitespace);
        }
        Ok(BranchName(value))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "String")]
#[schemars(with = "String")]
pub struct CommitId(String);

impl TryFrom<String> for CommitId {
    type Error = CommitIdParseError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        if !matches!(value.len(), 40 | 64) {
            return Err(CommitIdParseError::InvalidLength);
        }
        if !value.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Err(CommitIdParseError::InvalidHex);
        }
        Ok(CommitId(value.to_ascii_lowercase()))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
#[schemars(with = "i64")]
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
    type Error = RevisionParseError;

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 1 {
            return Err(RevisionParseError::NonPositive);
        }
        Ok(Revision(value))
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
#[schemars(with = "i64")]
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
    type Error = AttemptParseError;

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 0 {
            return Err(AttemptParseError::Negative);
        }
        Ok(Attempt(value))
    }
}

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(try_from = "i64")]
#[schemars(with = "i64")]
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
    type Error = TimestampParseError;

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 0 {
            return Err(TimestampParseError::BeforeEpoch);
        }
        Ok(Timestamp(value))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
#[schemars(with = "i64")]
pub struct LeaseSeconds(i64);

impl LeaseSeconds {
    pub const TEN_MINUTES: Self = Self(600);
}

impl TryFrom<i64> for LeaseSeconds {
    type Error = LeaseSecondsParseError;

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 1 {
            return Err(LeaseSecondsParseError::NonPositive);
        }
        if value > 86400 {
            return Err(LeaseSecondsParseError::TooLong);
        }
        Ok(LeaseSeconds(value))
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize, JsonSchema, From)]
#[serde(transparent)]
pub struct Extensions(pub BTreeMap<String, serde_json::Value>);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum IdentifierParseError {
    #[error("identifier must not be empty")]
    Empty,
    #[error("identifier exceeds 128 bytes")]
    TooLong,
    #[error("identifier requires ASCII letters, digits, -, _, or .")]
    InvalidCharacters,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum BranchNameParseError {
    #[error("branch name must not be empty")]
    Empty,
    #[error("branch name must not start with -")]
    LeadingDash,
    #[error("branch name must not contain whitespace")]
    Whitespace,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum CommitIdParseError {
    #[error("commit must be a full 40- or 64-character object ID")]
    InvalidLength,
    #[error("commit must contain only hexadecimal digits")]
    InvalidHex,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum RevisionParseError {
    #[error("revision must be positive")]
    NonPositive,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum AttemptParseError {
    #[error("attempt must not be negative")]
    Negative,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum TimestampParseError {
    #[error("timestamp must not be before the Unix epoch")]
    BeforeEpoch,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum LeaseSecondsParseError {
    #[error("lease duration must be positive")]
    NonPositive,
    #[error("lease duration exceeds 86400 seconds")]
    TooLong,
}

#[cfg(test)]
mod tests;
