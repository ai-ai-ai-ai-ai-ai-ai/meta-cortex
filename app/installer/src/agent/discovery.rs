use super::{AgentExit, RequestSource};
use derive_more::{Display, From};
use serde::Serialize;
use std::fmt;
use std::path::PathBuf;

#[derive(Clone, Display, From)]
struct ExecutableName(&'static str);

#[derive(Clone, Display)]
#[display("{executable} run --request {source}")]
struct RunInvocation {
    executable: ExecutableName,
    source: RequestSource,
}

// Version 1 discovery exposes these guides as text. Keep typed components
// internally and render only when Serde crosses that existing output boundary.
#[derive(Clone, Serialize)]
#[serde(into = "String")]
pub(super) struct InvocationGuide {
    file: RunInvocation,
    stdin: RunInvocation,
}

impl InvocationGuide {
    pub fn example() -> Self {
        let executable = ExecutableName::from("meta-cortex");
        Self {
            file: RunInvocation {
                executable: executable.clone(),
                source: RequestSource::File(PathBuf::from("request.yaml")),
            },
            stdin: RunInvocation {
                executable,
                source: RequestSource::Stdin,
            },
        }
    }
}

impl From<InvocationGuide> for String {
    fn from(guide: InvocationGuide) -> Self {
        format!("{} (or {} for stdin)", guide.file, guide.stdin)
    }
}

#[derive(Clone, Copy, Display)]
enum DocumentEncoding {
    #[display("YAML")]
    Yaml,
}

#[derive(Clone, Copy, Display)]
enum ExchangeLifecycle {
    #[display("One {encoding} request and response per process")]
    SingleRequestProcess { encoding: DocumentEncoding },
}

#[derive(Clone, Copy, Display)]
enum ToolProtocol {
    #[display("local tool discovery/calls, no MCP server or JSON-RPC session")]
    LocalCli,
}

#[derive(Clone, Copy, Display)]
enum LegacyCommand {
    #[display("init")]
    Init,
    #[display("info")]
    Info,
}

#[derive(Clone, Copy, Display)]
enum DiscoveryCommand {
    #[display("list")]
    List,
    #[display("--help")]
    Help,
}

#[derive(Clone, Copy)]
struct ExitBehavior {
    success: AgentExit,
    structured_error: AgentExit,
}

#[derive(Clone, Serialize)]
#[serde(into = "String")]
pub(super) struct TransportGuide {
    exchange: ExchangeLifecycle,
    protocol: ToolProtocol,
    exits: ExitBehavior,
    installation: LegacyCommand,
    inspection: LegacyCommand,
    command_discovery: DiscoveryCommand,
    cli_help: DiscoveryCommand,
}

impl TransportGuide {
    pub const LOCAL_YAML: Self = Self {
        exchange: ExchangeLifecycle::SingleRequestProcess {
            encoding: DocumentEncoding::Yaml,
        },
        protocol: ToolProtocol::LocalCli,
        exits: ExitBehavior {
            success: AgentExit::Success,
            structured_error: AgentExit::StructuredError,
        },
        installation: LegacyCommand::Init,
        inspection: LegacyCommand::Info,
        command_discovery: DiscoveryCommand::List,
        cli_help: DiscoveryCommand::Help,
    };
}

impl fmt::Display for TransportGuide {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{}; {}. Exit {}: success; exit {}: structured error. Legacy {}/{} remain available; {}/{} discover the CLI.",
            self.exchange,
            self.protocol,
            u8::from(self.exits.success),
            u8::from(self.exits.structured_error),
            self.installation,
            self.inspection,
            self.command_discovery,
            self.cli_help,
        )
    }
}

impl From<TransportGuide> for String {
    fn from(guide: TransportGuide) -> Self {
        guide.to_string()
    }
}
