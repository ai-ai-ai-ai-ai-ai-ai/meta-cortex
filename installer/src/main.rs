mod configuration;
mod information;
mod installation;
mod integration;

use clap::builder::{BoolishValueParser, TypedValueParser};
use clap::{ArgAction, Parser, Subcommand};
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
    /// Install the framework and choose how to connect your AI harness.
    Init {
        /// Existing project directory.
        #[arg(default_value = ".")]
        project: PathBuf,
        /// Skip prompts and use bundled settings for a new installation.
        #[arg(long, action = ArgAction::SetTrue, value_parser = BoolishValueParser::new().map(InitMode::from))]
        non_interactive: InitMode,
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
    fn run(self) -> Result<(), InstallError> {
        match self.command {
            Command::Init {
                project,
                non_interactive,
                integration,
            } => {
                let installed = Project::open(project)?.prepare()?.install(InitRequest {
                    mode: non_interactive,
                    integration,
                })?;
                println!("Meta-Cortex is ready in {}", installed.path().display());
                Ok(())
            }
            Command::Info { project } => {
                let yaml = InfoYaml::try_from(Project::open(project)?.info()?)?;
                print!("{yaml}");
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
