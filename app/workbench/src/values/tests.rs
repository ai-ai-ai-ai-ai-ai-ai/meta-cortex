use super::{
    Attempt, AttemptParse, AttemptParseError, BranchName, BranchNameParse, BranchNameParseError,
    CommitId, CommitIdParse, CommitIdParseError, FeatureId, FeatureIdParse, IdentifierParseError,
    LeaseSeconds, LeaseSecondsParse, LeaseSecondsParseError, Note, Revision, RevisionParse,
    RevisionParseError, TaskId, TaskIdParse, Timestamp, TimestampParse, TimestampParseError,
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
fn identifiers_classify_each_rejection_and_preserve_valid_text() -> anyhow::Result<()> {
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
        assert_eq!(
            FeatureIdParse::from(input.text.clone()),
            FeatureIdParse::Invalid(input.reason)
        );
        assert_eq!(
            TaskIdParse::from(input.text.clone()),
            TaskIdParse::Invalid(input.reason)
        );
        let encoded = serde_json::to_string(&input.text)?;
        assert!(serde_json::from_str::<FeatureId>(&encoded).is_err());
        assert!(serde_json::from_str::<TaskId>(&encoded).is_err());
    }
    for text in ["review-1_A.b".to_owned(), "a".repeat(128)] {
        let feature = match FeatureIdParse::from(text.clone()) {
            FeatureIdParse::Parsed(feature) => feature,
            FeatureIdParse::Invalid(error) => return Err(error.into()),
        };
        let task = match TaskIdParse::from(text.clone()) {
            TaskIdParse::Parsed(task) => task,
            TaskIdParse::Invalid(error) => return Err(error.into()),
        };
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
fn branch_classification_does_not_hide_empty_dash_or_whitespace() -> anyhow::Result<()> {
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
            BranchNameParse::from(input.text.to_owned()),
            BranchNameParse::Invalid(input.reason)
        );
        assert!(serde_json::from_str::<BranchName>(&serde_json::to_string(input.text)?).is_err());
    }
    let branch = match BranchNameParse::from("codex/feature".to_owned()) {
        BranchNameParse::Parsed(branch) => branch,
        BranchNameParse::Invalid(error) => return Err(error.into()),
    };
    assert_eq!(branch.to_string(), "codex/feature");
    assert_eq!(
        serde_json::from_str::<BranchName>(&serde_json::to_string(&branch)?)?,
        branch
    );
    Ok(())
}

#[test]
fn commit_classification_checks_length_hex_and_normalizes_case() -> anyhow::Result<()> {
    assert_eq!(
        CommitIdParse::from("abc".to_owned()),
        CommitIdParse::Invalid(CommitIdParseError::InvalidLength)
    );
    assert_eq!(
        CommitIdParse::from("z".repeat(40)),
        CommitIdParse::Invalid(CommitIdParseError::InvalidHex)
    );
    for text in ["abc".to_owned(), "z".repeat(40)] {
        assert!(serde_json::from_str::<CommitId>(&serde_json::to_string(&text)?).is_err());
    }
    for length in [40, 64] {
        let commit = match CommitIdParse::from("A".repeat(length)) {
            CommitIdParse::Parsed(commit) => commit,
            CommitIdParse::Invalid(error) => return Err(error.into()),
        };
        assert_eq!(commit.to_string(), "a".repeat(length));
        assert_eq!(
            serde_json::from_str::<CommitId>(&serde_json::to_string(&commit)?)?,
            commit
        );
    }
    Ok(())
}

#[test]
fn numeric_classifications_preserve_zero_and_range_meaning() -> anyhow::Result<()> {
    assert_eq!(
        RevisionParse::from(0),
        RevisionParse::Invalid(RevisionParseError::NonPositive)
    );
    assert_eq!(
        RevisionParse::from(1),
        RevisionParse::Parsed(Revision::INITIAL)
    );
    assert_eq!(
        AttemptParse::from(-1),
        AttemptParse::Invalid(AttemptParseError::Negative)
    );
    assert_eq!(
        AttemptParse::from(0),
        AttemptParse::Parsed(Attempt::UNCLAIMED)
    );
    assert_eq!(
        TimestampParse::from(-1),
        TimestampParse::Invalid(TimestampParseError::BeforeEpoch)
    );
    assert_eq!(
        TimestampParse::from(0),
        TimestampParse::Parsed(Timestamp(0))
    );
    assert_eq!(
        LeaseSecondsParse::from(0),
        LeaseSecondsParse::Invalid(LeaseSecondsParseError::NonPositive)
    );
    assert_eq!(
        LeaseSecondsParse::from(86401),
        LeaseSecondsParse::Invalid(LeaseSecondsParseError::TooLong)
    );
    for seconds in [1, 600, 86400] {
        let lease = match LeaseSecondsParse::from(seconds) {
            LeaseSecondsParse::Parsed(lease) => lease,
            LeaseSecondsParse::Invalid(error) => return Err(error.into()),
        };
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
fn schema_describes_wire_scalars_not_internal_parse_states() -> anyhow::Result<()> {
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
