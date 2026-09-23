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
#[serde(try_from = "TaskIdParse")]
#[schemars(with = "String")]
pub struct TaskId(String);

/// Complete classification of the external representation of a TaskId.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "String")]
pub enum TaskIdParse {
    Parsed(TaskId),
    Invalid(IdentifierParseError),
}

impl From<String> for TaskIdParse {
    fn from(value: String) -> Self {
        if value.is_empty() {
            return Self::Invalid(IdentifierParseError::Empty);
        }
        if value.len() > 128 {
            return Self::Invalid(IdentifierParseError::TooLong);
        }
        if !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        {
            return Self::Invalid(IdentifierParseError::InvalidCharacters);
        }
        Self::Parsed(TaskId(value))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<TaskIdParse> for TaskId {
    type Error = IdentifierParseError;
    fn try_from(parsed: TaskIdParse) -> Result<Self, Self::Error> {
        match parsed {
            TaskIdParse::Parsed(value) => Ok(value),
            TaskIdParse::Invalid(error) => Err(error),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "FeatureIdParse")]
#[schemars(with = "String")]
pub struct FeatureId(String);

/// Complete classification of the external representation of a FeatureId.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "String")]
pub enum FeatureIdParse {
    Parsed(FeatureId),
    Invalid(IdentifierParseError),
}

impl From<String> for FeatureIdParse {
    fn from(value: String) -> Self {
        if value.is_empty() {
            return Self::Invalid(IdentifierParseError::Empty);
        }
        if value.len() > 128 {
            return Self::Invalid(IdentifierParseError::TooLong);
        }
        if !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        {
            return Self::Invalid(IdentifierParseError::InvalidCharacters);
        }
        Self::Parsed(FeatureId(value))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<FeatureIdParse> for FeatureId {
    type Error = IdentifierParseError;
    fn try_from(parsed: FeatureIdParse) -> Result<Self, Self::Error> {
        match parsed {
            FeatureIdParse::Parsed(value) => Ok(value),
            FeatureIdParse::Invalid(error) => Err(error),
        }
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
#[serde(try_from = "BranchNameParse")]
#[schemars(with = "String")]
pub struct BranchName(String);

/// Complete classification of the external representation of a BranchName.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "String")]
pub enum BranchNameParse {
    Parsed(BranchName),
    Invalid(BranchNameParseError),
}

impl From<String> for BranchNameParse {
    fn from(value: String) -> Self {
        if value.is_empty() {
            return Self::Invalid(BranchNameParseError::Empty);
        }
        if value.starts_with('-') {
            return Self::Invalid(BranchNameParseError::LeadingDash);
        }
        if value.contains(char::is_whitespace) {
            return Self::Invalid(BranchNameParseError::Whitespace);
        }
        Self::Parsed(BranchName(value))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<BranchNameParse> for BranchName {
    type Error = BranchNameParseError;
    fn try_from(parsed: BranchNameParse) -> Result<Self, Self::Error> {
        match parsed {
            BranchNameParse::Parsed(value) => Ok(value),
            BranchNameParse::Invalid(error) => Err(error),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "CommitIdParse")]
#[schemars(with = "String")]
pub struct CommitId(String);

/// Complete classification of the external representation of a CommitId.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "String")]
pub enum CommitIdParse {
    Parsed(CommitId),
    Invalid(CommitIdParseError),
}

impl From<String> for CommitIdParse {
    fn from(value: String) -> Self {
        if !matches!(value.len(), 40 | 64) {
            return Self::Invalid(CommitIdParseError::InvalidLength);
        }
        if !value.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Self::Invalid(CommitIdParseError::InvalidHex);
        }
        Self::Parsed(CommitId(value.to_ascii_lowercase()))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<CommitIdParse> for CommitId {
    type Error = CommitIdParseError;
    fn try_from(parsed: CommitIdParse) -> Result<Self, Self::Error> {
        match parsed {
            CommitIdParse::Parsed(value) => Ok(value),
            CommitIdParse::Invalid(error) => Err(error),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "RevisionParse")]
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

/// Complete classification of the external representation of a Revision.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "i64")]
pub enum RevisionParse {
    Parsed(Revision),
    Invalid(RevisionParseError),
}

impl From<i64> for RevisionParse {
    fn from(value: i64) -> Self {
        if value < 1 {
            return Self::Invalid(RevisionParseError::NonPositive);
        }
        Self::Parsed(Revision(value))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<RevisionParse> for Revision {
    type Error = RevisionParseError;
    fn try_from(parsed: RevisionParse) -> Result<Self, Self::Error> {
        match parsed {
            RevisionParse::Parsed(value) => Ok(value),
            RevisionParse::Invalid(error) => Err(error),
        }
    }
}

impl From<Revision> for i64 {
    fn from(value: Revision) -> Self {
        let Revision(revision) = value;
        revision
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "AttemptParse")]
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

/// Complete classification of the external representation of a Attempt.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "i64")]
pub enum AttemptParse {
    Parsed(Attempt),
    Invalid(AttemptParseError),
}

impl From<i64> for AttemptParse {
    fn from(value: i64) -> Self {
        if value < 0 {
            return Self::Invalid(AttemptParseError::Negative);
        }
        Self::Parsed(Attempt(value))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<AttemptParse> for Attempt {
    type Error = AttemptParseError;
    fn try_from(parsed: AttemptParse) -> Result<Self, Self::Error> {
        match parsed {
            AttemptParse::Parsed(value) => Ok(value),
            AttemptParse::Invalid(error) => Err(error),
        }
    }
}

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Display, Serialize, Deserialize, JsonSchema,
)]
#[serde(try_from = "TimestampParse")]
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

/// Complete classification of the external representation of a Timestamp.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "i64")]
pub enum TimestampParse {
    Parsed(Timestamp),
    Invalid(TimestampParseError),
}

impl From<i64> for TimestampParse {
    fn from(value: i64) -> Self {
        if value < 0 {
            return Self::Invalid(TimestampParseError::BeforeEpoch);
        }
        Self::Parsed(Timestamp(value))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<TimestampParse> for Timestamp {
    type Error = TimestampParseError;
    fn try_from(parsed: TimestampParse) -> Result<Self, Self::Error> {
        match parsed {
            TimestampParse::Parsed(value) => Ok(value),
            TimestampParse::Invalid(error) => Err(error),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "LeaseSecondsParse")]
#[schemars(with = "i64")]
pub struct LeaseSeconds(i64);

impl LeaseSeconds {
    pub const TEN_MINUTES: Self = Self(600);
}

/// Complete classification of the external representation of a LeaseSeconds.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(from = "i64")]
pub enum LeaseSecondsParse {
    Parsed(LeaseSeconds),
    Invalid(LeaseSecondsParseError),
}

impl From<i64> for LeaseSecondsParse {
    fn from(value: i64) -> Self {
        if value < 1 {
            return Self::Invalid(LeaseSecondsParseError::NonPositive);
        }
        if value > 86400 {
            return Self::Invalid(LeaseSecondsParseError::TooLong);
        }
        Self::Parsed(LeaseSeconds(value))
    }
}

// Serde requires Result; application callers match the classification directly.
impl TryFrom<LeaseSecondsParse> for LeaseSeconds {
    type Error = LeaseSecondsParseError;
    fn try_from(parsed: LeaseSecondsParse) -> Result<Self, Self::Error> {
        match parsed {
            LeaseSecondsParse::Parsed(value) => Ok(value),
            LeaseSecondsParse::Invalid(error) => Err(error),
        }
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
