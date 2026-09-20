mod installation;

use clap::{Parser, Subcommand};
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
    },
}

impl Cli {
    fn run(self) -> Result<(), InstallError> {
        match self.command {
            Command::Init { project } => {
                let installed = Project::open(project)?.prepare()?.install()?;
                println!("Meta-Cortex is ready in {}", installed.path().display());
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
