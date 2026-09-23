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

#[derive(Clone, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "String")]
pub struct Note(String);

impl TryFrom<String> for Note {
    type Error = LedgerError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.trim().is_empty() {
            return Err(LedgerError::Invalid("notes must not be blank"));
        }
        Ok(Self(value))
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
        self.0
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
        value.0
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Display, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "i64")]
pub struct Attempt(i64);

impl Attempt {
    pub const UNCLAIMED: Self = Self(0);
    pub fn advance(self) -> Result<Self, LedgerError> {
        self.0
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
        self.0
            .checked_add(ttl.0 * 1000)
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
