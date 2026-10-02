use std::io;
use std::process::{Command, ExitStatus};
use thiserror::Error;

struct FrontendBuild {
    command: Command,
}
enum BuildOutcome {
    Built,
    Failed,
}
#[derive(Debug, Error)]
enum BuildFailure {
    #[error(
        "Could not run bun frontend build: {0}. Install frontend dependencies with bun install --frozen-lockfile."
    )]
    Spawn(#[from] io::Error),
    #[error(
        "Frontend build failed. From app/visualization/frontend run bun install --frozen-lockfile, then bun run build."
    )]
    Frontend,
}
impl From<ExitStatus> for BuildOutcome {
    fn from(status: ExitStatus) -> Self {
        match status.success() {
            true => Self::Built,
            false => Self::Failed,
        }
    }
}
impl FrontendBuild {
    fn run(mut self) -> Result<(), BuildFailure> {
        println!("cargo:rerun-if-changed=frontend/src");
        println!("cargo:rerun-if-changed=frontend/index.html");
        println!("cargo:rerun-if-changed=frontend/svelte.config.js");
        println!("cargo:rerun-if-changed=frontend/package.json");
        println!("cargo:rerun-if-changed=frontend/bun.lock");
        println!("cargo:rerun-if-changed=frontend/vite.config.ts");
        println!("cargo:rerun-if-changed=frontend/tsconfig.json");
        match BuildOutcome::from(self.command.status()?) {
            BuildOutcome::Built => {
                tauri_build::build();
                Ok(())
            }
            BuildOutcome::Failed => Err(BuildFailure::Frontend),
        }
    }
}
fn main() -> Result<(), BuildFailure> {
    let mut command = Command::new("bun");
    command.args(["run", "build"]).current_dir("frontend");
    FrontendBuild { command }.run()
}
