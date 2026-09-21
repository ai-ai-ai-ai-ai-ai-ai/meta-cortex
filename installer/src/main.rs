mod configuration;
mod information;
mod installation;

use clap::builder::{BoolishValueParser, TypedValueParser};
use clap::{ArgAction, Parser, Subcommand};
use configuration::InitMode;
use installation::{InstallError, Project};
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
    /// Install the bundled framework and connect the project's AGENTS.md.
    Init {
        /// Existing project directory.
        #[arg(default_value = ".")]
        project: PathBuf,
        /// Skip prompts and use bundled settings for a new installation.
        #[arg(long, action = ArgAction::SetTrue, value_parser = BoolishValueParser::new().map(InitMode::from))]
        non_interactive: InitMode,
    },
    /// Show the project's installed framework and configured agent models.
    Info {
        /// Existing project directory.
        #[arg(default_value = ".")]
        project: PathBuf,
    },
}

impl Cli {
    fn run(self) -> Result<(), InstallError> {
        match self.command {
            Command::Init {
                project,
                non_interactive,
            } => {
                let installed = Project::open(project)?
                    .prepare()?
                    .install(non_interactive)?;
                println!("Meta-Cortex is ready in {}", installed.path().display());
                Ok(())
            }
            Command::Info { project } => {
                println!("{}", Project::open(project)?.info()?);
                Ok(())
            }
        }
    }
}

fn main() -> ExitCode {
    match Cli::parse().run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}
