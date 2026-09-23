mod catalog;
mod discovery;
mod protocol;

use crate::installation::InstallError;
use catalog::Catalog;
use derive_more::Display;
use meta_cortex_workbench::LedgerError;
use meta_cortex_workbench::versions::ProtocolVersion;
use protocol::{Reply, Request};
use serde::Serialize;
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use std::process::ExitCode;
use thiserror::Error;
use tokio::runtime::Builder;

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("invalid request YAML: {0}")]
    Request(#[from] serde_saphyr::DeserializeError),
    #[error("could not encode response: {0}")]
    Response(#[from] serde_saphyr::SerializeError),
    #[error(transparent)]
    Ledger(#[from] LedgerError),
    #[error(transparent)]
    Install(#[from] InstallError),
    #[error("input/output failure: {0}")]
    Io(#[from] io::Error),
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    InvalidRequest,
    Conflict,
    NotFound,
    InvalidState,
    AssignmentChanged,
    Expired,
    DependencyPending,
    UnsupportedVersion,
    Git,
    Storage,
    Io,
    Installation,
    Response,
}

#[derive(Serialize)]
pub struct Failure {
    code: ErrorCode,
    message: String,
}

impl From<&AgentError> for Failure {
    fn from(error: &AgentError) -> Self {
        let code = match error {
            AgentError::Request(_) => ErrorCode::InvalidRequest,
            AgentError::Response(_) => ErrorCode::Response,
            AgentError::Io(_) => ErrorCode::Io,
            AgentError::Install(_) => ErrorCode::Installation,
            AgentError::Ledger(error) => match error {
                LedgerError::Conflict | LedgerError::AlreadyExists => ErrorCode::Conflict,
                LedgerError::NotFound | LedgerError::Uninitialized => ErrorCode::NotFound,
                LedgerError::Invalid(_)
                | LedgerError::Identifier(_)
                | LedgerError::BranchName(_)
                | LedgerError::CommitId(_)
                | LedgerError::Revision(_)
                | LedgerError::Attempt(_)
                | LedgerError::Timestamp(_)
                | LedgerError::LeaseSeconds(_) => ErrorCode::InvalidRequest,
                LedgerError::InvalidTransition => ErrorCode::InvalidState,
                LedgerError::AssignmentChanged => ErrorCode::AssignmentChanged,
                LedgerError::Expired => ErrorCode::Expired,
                LedgerError::DependencyPending => ErrorCode::DependencyPending,
                LedgerError::UnsupportedVersion(_) => ErrorCode::UnsupportedVersion,
                LedgerError::Git(_) => ErrorCode::Git,
                LedgerError::Io(_) | LedgerError::Clock(_) => ErrorCode::Io,
                LedgerError::Database(_)
                | LedgerError::Json(_)
                | LedgerError::SqlBuild(_)
                | LedgerError::UnsupportedSqlBinding => ErrorCode::Storage,
            },
        };
        Self {
            code,
            message: error.to_string(),
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "status", content = "data", rename_all = "snake_case")]
enum Outcome {
    Success(Box<Reply>),
    Error(Failure),
}

#[derive(Serialize)]
struct Response {
    version: ProtocolVersion,
    result: Outcome,
}

#[derive(Clone, Copy)]
#[repr(u8)]
enum AgentExit {
    Success = 0,
    StructuredError = 2,
}

impl From<AgentExit> for u8 {
    fn from(status: AgentExit) -> Self {
        status as Self
    }
}

impl From<AgentExit> for ExitCode {
    fn from(status: AgentExit) -> Self {
        Self::from(u8::from(status))
    }
}

struct CommandResult {
    outcome: Outcome,
    exit: AgentExit,
}

impl From<Result<Reply, AgentError>> for CommandResult {
    fn from(result: Result<Reply, AgentError>) -> Self {
        match result {
            Ok(reply) => Self {
                outcome: Outcome::Success(Box::new(reply)),
                exit: AgentExit::Success,
            },
            Err(error) => Self {
                outcome: Outcome::Error(Failure::from(&error)),
                exit: AgentExit::StructuredError,
            },
        }
    }
}

#[derive(Clone, Display)]
enum RequestSource {
    #[display("{}", _0.display())]
    File(PathBuf),
    #[display("-")]
    Stdin,
}

impl From<PathBuf> for RequestSource {
    fn from(path: PathBuf) -> Self {
        if path.as_os_str() == "-" {
            Self::Stdin
        } else {
            Self::File(path)
        }
    }
}

impl RequestSource {
    fn read(&self) -> Result<String, io::Error> {
        match self {
            Self::File(path) => fs::read_to_string(path),
            Self::Stdin => {
                let mut text = String::new();
                io::stdin().read_to_string(&mut text)?;
                Ok(text)
            }
        }
    }
}

pub struct AgentCli;

impl AgentCli {
    pub fn list() -> ExitCode {
        match Catalog::discover().and_then(|catalog| catalog.render()) {
            Ok(output) => {
                print!("{output}");
                ExitCode::from(AgentExit::Success)
            }
            Err(error) => Self::report(Err(error)),
        }
    }

    pub fn run(path: PathBuf) -> ExitCode {
        Self::report(Self::execute(path))
    }

    fn execute(path: PathBuf) -> Result<Reply, AgentError> {
        let source = RequestSource::from(path);
        let request = Request::decode(&source.read()?)?;
        let runtime = Builder::new_current_thread().enable_time().build()?;
        runtime.block_on(request.execute())
    }

    fn report(result: Result<Reply, AgentError>) -> ExitCode {
        let result = CommandResult::from(result);
        match serde_saphyr::to_string(&Response {
            version: ProtocolVersion::CURRENT,
            result: result.outcome,
        }) {
            Ok(output) => print!("{output}"),
            Err(error) => {
                eprintln!("could not encode response: {error}");
                return ExitCode::from(AgentExit::StructuredError);
            }
        }
        ExitCode::from(result.exit)
    }
}
