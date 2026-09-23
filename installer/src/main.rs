mod agent;
mod configuration;
mod information;
mod installation;
mod integration;
mod ledger;

use agent::AgentCli;
use clap::builder::{BoolishValueParser, TypedValueParser};
use clap::{Arg, ArgAction, Parser, Subcommand};
use configuration::InitMode;
use information::InfoYaml;
use installation::{InitRequest, InstallError, Project};
use integration::IntegrationOptions;
use std::path::PathBuf;
use std::process::ExitCode;

#[derive(Parser)]
#[command(version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Discover agent commands, typed schemas, and complete YAML requests.
    List,
    /// Execute a strictly typed YAML agent request; use - for stdin.
    Run {
        #[arg(long, default_value = "-")]
        request: PathBuf,
    },
    /// Install the framework with bundled defaults, without prompting.
    #[command(arg(Arg::new("non-interactive")
        .long("non-interactive")
        .help("Use bundled defaults without prompts (the default; retained for compatibility)")
        .action(ArgAction::SetTrue)
        .conflicts_with("interactive")))]
    Init {
        /// Existing project directory.
        #[arg(default_value = ".")]
        project: PathBuf,
        /// Interactively choose harness integration and model settings.
        #[arg(long, action = ArgAction::SetTrue, value_parser = BoolishValueParser::new().map(InitMode::from))]
        interactive: InitMode,
        #[command(flatten)]
        integration: IntegrationOptions,
    },
    /// Print YAML describing the installed framework and configured agent models.
    Info {
        /// Existing project directory.
        #[arg(default_value = ".")]
        project: PathBuf,
    },
}

impl Cli {
    fn run(self) -> Result<ExitCode, InstallError> {
        match self.command {
            Command::List => Ok(AgentCli::list()),
            Command::Run { request } => Ok(AgentCli::run(request)),
            Command::Init {
                project,
                interactive,
                integration,
            } => {
                let installed = Project::open(project)?.prepare()?.install(InitRequest {
                    mode: interactive,
                    integration,
                })?;
                println!("Meta-Cortex is ready in {}", installed.path().display());
                Ok(ExitCode::SUCCESS)
            }
            Command::Info { project } => {
                let yaml = InfoYaml::try_from(Project::open(project)?.info()?)?;
                print!("{yaml}");
                Ok(ExitCode::SUCCESS)
            }
        }
    }
}

fn main() -> ExitCode {
    match Cli::parse().run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}
