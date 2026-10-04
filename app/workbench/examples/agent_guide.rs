//! Export the embedded guide without repository discovery or ledger access.
use meta_cortex_workbench::guide::AgentGuide;
fn main() -> anyhow::Result<()> {
    println!(
        "{}",
        serde_json::to_string_pretty(&AgentGuide::embedded()?)?
    );
    Ok(())
}
