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
mod tests {
    use super::{
        Attempt, AttemptParseError, BranchName, BranchNameParseError, CommitId, CommitIdParseError,
        FeatureId, IdentifierParseError, LeaseSeconds, LeaseSecondsParseError, Note, Revision,
        RevisionParseError, TaskId, Timestamp, TimestampParseError,
    };
    use schemars::schema_for;
    use serde::Deserialize;

    #[test]
    fn named_lease_preserves_duration_and_external_validation() -> serde_json::Result<()> {
        let encoded = serde_json::to_string(&LeaseSeconds::TEN_MINUTES)?;
        assert_eq!(encoded, "600");
        assert_eq!(
            serde_json::from_str::<LeaseSeconds>(&encoded)?,
            LeaseSeconds::TEN_MINUTES
        );
        for input in ["0", "-1", "86401"] {
            assert!(serde_json::from_str::<LeaseSeconds>(input).is_err());
        }
        Ok(())
    }

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
    #[test]
    fn identifiers_return_typed_errors_and_preserve_valid_text() -> anyhow::Result<()> {
        struct InvalidIdentifier {
            text: String,
            reason: IdentifierParseError,
        }
        for input in [
            InvalidIdentifier {
                text: String::new(),
                reason: IdentifierParseError::Empty,
            },
            InvalidIdentifier {
                text: "a".repeat(129),
                reason: IdentifierParseError::TooLong,
            },
            InvalidIdentifier {
                text: "two words".to_owned(),
                reason: IdentifierParseError::InvalidCharacters,
            },
            InvalidIdentifier {
                text: "../task".to_owned(),
                reason: IdentifierParseError::InvalidCharacters,
            },
            InvalidIdentifier {
                text: "é".to_owned(),
                reason: IdentifierParseError::InvalidCharacters,
            },
        ] {
            assert_eq!(FeatureId::try_from(input.text.clone()), Err(input.reason));
            assert_eq!(TaskId::try_from(input.text.clone()), Err(input.reason));
            let encoded = serde_json::to_string(&input.text)?;
            assert!(serde_json::from_str::<FeatureId>(&encoded).is_err());
            assert!(serde_json::from_str::<TaskId>(&encoded).is_err());
        }
        for text in ["review-1_A.b".to_owned(), "a".repeat(128)] {
            let feature = FeatureId::try_from(text.clone())?;
            let task = TaskId::try_from(text.clone())?;
            assert_eq!(feature.to_string(), text);
            assert_eq!(task.to_string(), text);
            let encoded = serde_json::to_string(&text)?;
            assert_eq!(serde_json::to_string(&feature)?, encoded);
            assert_eq!(serde_json::to_string(&task)?, encoded);
            assert_eq!(serde_json::from_str::<FeatureId>(&encoded)?, feature);
            assert_eq!(serde_json::from_str::<TaskId>(&encoded)?, task);
        }
        Ok(())
    }

    #[test]
    fn branch_validation_reports_empty_dash_and_whitespace() -> anyhow::Result<()> {
        struct InvalidBranch {
            text: &'static str,
            reason: BranchNameParseError,
        }
        for input in [
            InvalidBranch {
                text: "",
                reason: BranchNameParseError::Empty,
            },
            InvalidBranch {
                text: "-branch",
                reason: BranchNameParseError::LeadingDash,
            },
            InvalidBranch {
                text: "a b",
                reason: BranchNameParseError::Whitespace,
            },
            InvalidBranch {
                text: "a\tb",
                reason: BranchNameParseError::Whitespace,
            },
        ] {
            assert_eq!(
                BranchName::try_from(input.text.to_owned()),
                Err(input.reason)
            );
            assert!(
                serde_json::from_str::<BranchName>(&serde_json::to_string(input.text)?).is_err()
            );
        }
        let branch = BranchName::try_from("codex/feature".to_owned())?;
        assert_eq!(branch.to_string(), "codex/feature");
        assert_eq!(
            serde_json::from_str::<BranchName>(&serde_json::to_string(&branch)?)?,
            branch
        );
        Ok(())
    }

    #[test]
    fn commit_parsing_checks_length_hex_and_normalizes_case() -> anyhow::Result<()> {
        assert_eq!(
            CommitId::try_from("abc".to_owned()),
            Err(CommitIdParseError::InvalidLength)
        );
        assert_eq!(
            CommitId::try_from("z".repeat(40)),
            Err(CommitIdParseError::InvalidHex)
        );
        for text in ["abc".to_owned(), "z".repeat(40)] {
            assert!(serde_json::from_str::<CommitId>(&serde_json::to_string(&text)?).is_err());
        }
        for length in [40, 64] {
            let commit = CommitId::try_from("A".repeat(length))?;
            assert_eq!(commit.to_string(), "a".repeat(length));
            assert_eq!(
                serde_json::from_str::<CommitId>(&serde_json::to_string(&commit)?)?,
                commit
            );
        }
        Ok(())
    }

    #[test]
    fn numeric_validation_preserves_zero_and_range_meaning() -> anyhow::Result<()> {
        assert_eq!(Revision::try_from(0), Err(RevisionParseError::NonPositive));
        assert_eq!(Revision::try_from(1), Ok(Revision::INITIAL));
        assert_eq!(Attempt::try_from(-1), Err(AttemptParseError::Negative));
        assert_eq!(Attempt::try_from(0), Ok(Attempt::UNCLAIMED));
        assert_eq!(
            Timestamp::try_from(-1),
            Err(TimestampParseError::BeforeEpoch)
        );
        assert_eq!(Timestamp::try_from(0), Ok(Timestamp(0)));
        assert_eq!(
            LeaseSeconds::try_from(0),
            Err(LeaseSecondsParseError::NonPositive)
        );
        assert_eq!(
            LeaseSeconds::try_from(86401),
            Err(LeaseSecondsParseError::TooLong)
        );
        for seconds in [1, 600, 86400] {
            let lease = LeaseSeconds::try_from(seconds)?;
            assert_eq!(
                serde_json::from_str::<LeaseSeconds>(&serde_json::to_string(&lease)?)?,
                lease
            );
        }
        assert!(serde_json::from_str::<Revision>("0").is_err());
        assert!(serde_json::from_str::<Attempt>("-1").is_err());
        assert!(serde_json::from_str::<Timestamp>("-1").is_err());
        assert_eq!(serde_json::from_str::<Timestamp>("0")?, Timestamp(0));
        Ok(())
    }

    #[test]
    fn schema_preserves_scalar_wire_types() -> anyhow::Result<()> {
        #[derive(Deserialize)]
        struct ScalarSchema {
            #[serde(rename = "type")]
            kind: ScalarKind,
        }
        #[derive(Debug, PartialEq, Deserialize)]
        #[serde(rename_all = "snake_case")]
        enum ScalarKind {
            String,
            Integer,
        }
        for schema in [
            schema_for!(FeatureId),
            schema_for!(TaskId),
            schema_for!(BranchName),
            schema_for!(CommitId),
        ] {
            let decoded: ScalarSchema = serde_json::from_value(serde_json::to_value(schema)?)?;
            assert_eq!(decoded.kind, ScalarKind::String);
        }
        for schema in [
            schema_for!(Revision),
            schema_for!(Attempt),
            schema_for!(Timestamp),
            schema_for!(LeaseSeconds),
        ] {
            let decoded: ScalarSchema = serde_json::from_value(serde_json::to_value(schema)?)?;
            assert_eq!(decoded.kind, ScalarKind::Integer);
        }
        Ok(())
    }
}
