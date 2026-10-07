mod agent;
mod configuration;
mod information;
mod installation;
mod integration;
mod wrapper;

use agent::AgentCli;
use clap::{Parser, Subcommand};
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
    /// Open the recorded Workbench dashboard for the current repository.
    Dashboard,
    /// Execute a strictly typed YAML agent request; use - for stdin.
    Run {
        #[arg(long, default_value = "-")]
        request: PathBuf,
    },
}

impl Cli {
    fn run(self) -> ExitCode {
        match self.command {
            Command::List => AgentCli::list(),
            Command::Dashboard => AgentCli::dashboard(),
            Command::Run { request } => AgentCli::run(request),
        }
    }
}

fn main() -> ExitCode {
    Cli::parse().run()
}
