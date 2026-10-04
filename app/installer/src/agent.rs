mod catalog;
mod discovery;
mod protocol;

use crate::installation::InstallError;
use catalog::Catalog;
use derive_more::{Display, From};
use meta_cortex_visualization::{
    Dashboard, DashboardError, DashboardExecution, DashboardRequest, DesktopLaunch,
};
use meta_cortex_workbench::versions::ProtocolVersion;
use meta_cortex_workbench::{LedgerError, Workbench};
use protocol::{Reply, Request};
use serde::Serialize;
use std::io::{self, Read};
use std::path::PathBuf;
use std::process::ExitCode;
use std::{env, fs};
use thiserror::Error;
use tokio::runtime::Builder;

#[derive(Debug, Error)]
pub enum AgentError {
    #[error(transparent)]
    Dashboard(#[from] meta_cortex_visualization::DashboardError),
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
    Native,
}

#[derive(Serialize, From)]
#[serde(transparent)]
struct FailureMessage(String);

#[derive(Serialize)]
pub struct Failure {
    code: ErrorCode,
    message: FailureMessage,
}

impl From<&AgentError> for Failure {
    fn from(error: &AgentError) -> Self {
        let code = match error {
            AgentError::Dashboard(DashboardError::Runtime(_)) => ErrorCode::Io,
            AgentError::Dashboard(DashboardError::Native(_) | DashboardError::Exit(_)) => {
                ErrorCode::Native
            }
            AgentError::Request(_) => ErrorCode::InvalidRequest,
            AgentError::Response(_) => ErrorCode::Response,
            AgentError::Io(_) => ErrorCode::Io,
            AgentError::Install(_) => ErrorCode::Installation,
            AgentError::Ledger(error) | AgentError::Dashboard(DashboardError::Ledger(error)) => {
                ErrorCode::ledger(error)
            }
        };
        Self {
            code,
            message: FailureMessage::from(error.to_string()),
        }
    }
}

impl ErrorCode {
    fn ledger(error: &LedgerError) -> Self {
        match error {
            LedgerError::Conflict | LedgerError::AlreadyExists => ErrorCode::Conflict,
            LedgerError::NotFound | LedgerError::Uninitialized => ErrorCode::NotFound,
            LedgerError::Invalid(_)
            | LedgerError::Identifier(_)
            | LedgerError::BranchName(_)
            | LedgerError::CommitId(_)
            | LedgerError::TaskRevision(_)
            | LedgerError::Attempt(_)
            | LedgerError::Timestamp(_)
            | LedgerError::LeaseSeconds(_) => ErrorCode::InvalidRequest,
            LedgerError::InvalidTransition => ErrorCode::InvalidState,
            LedgerError::AssignmentChanged => ErrorCode::AssignmentChanged,
            LedgerError::Expired => ErrorCode::Expired,
            LedgerError::DependencyPending => ErrorCode::DependencyPending,
            LedgerError::ObservationMigrationRequired(_) | LedgerError::UnsupportedVersion(_) => {
                ErrorCode::UnsupportedVersion
            }
            LedgerError::Git(_) => ErrorCode::Git,
            LedgerError::Io(_) | LedgerError::Clock(_) => ErrorCode::Io,
            LedgerError::Database(_)
            | LedgerError::Json(_)
            | LedgerError::SqlBuild(_)
            | LedgerError::UnsupportedSqlBinding => ErrorCode::Storage,
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

pub(super) enum Execution {
    Reply(Box<Reply>),
    Desktop(DesktopLaunch),
}
impl From<Reply> for Execution {
    fn from(reply: Reply) -> Self {
        Self::Reply(Box::new(reply))
    }
}
impl From<DashboardExecution> for Execution {
    fn from(execution: DashboardExecution) -> Self {
        match execution {
            DashboardExecution::Snapshot(report) => Self::from(Reply::Dashboard(report)),
            DashboardExecution::Desktop(launch) => Self::Desktop(launch),
        }
    }
}
impl Execution {
    fn finish(self) -> Result<Reply, AgentError> {
        match self {
            Self::Reply(reply) => Ok(*reply),
            Self::Desktop(launch) => Ok(Reply::Dashboard(launch.run()?)),
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

    pub fn dashboard() -> ExitCode {
        Self::report(Self::execute_dashboard())
    }

    fn execute_dashboard() -> Result<Reply, AgentError> {
        let project = env::current_dir()?;
        let workbench = Workbench::discover(&project)?;
        let runtime = Builder::new_current_thread().enable_time().build()?;
        let execution =
            runtime.block_on(Dashboard::from(workbench).execute(DashboardRequest::Desktop {}))?;
        drop(runtime);
        Execution::from(execution).finish()
    }

    pub fn run(path: PathBuf) -> ExitCode {
        Self::report(Self::execute(path))
    }

    fn execute(path: PathBuf) -> Result<Reply, AgentError> {
        let source = RequestSource::from(path);
        let request = Request::decode(&source.read()?)?;
        let runtime = Builder::new_current_thread().enable_time().build()?;
        let execution = runtime.block_on(request.execute())?;
        drop(runtime);
        execution.finish()
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
