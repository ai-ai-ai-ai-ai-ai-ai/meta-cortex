//! Export the public read-only workflow for a repository and feature.
use meta_cortex_workbench::Workbench;
use meta_cortex_workbench::values::FeatureId;
use std::path::PathBuf;

fn main() -> anyhow::Result<()> {
    let mut arguments = std::env::args_os().skip(1);
    let project = match arguments.next() {
        Some(path) => PathBuf::from(path),
        None => anyhow::bail!("provide repository path and feature ID"),
    };
    let feature = match arguments.next() {
        Some(value) => FeatureId::try_from(
            value
                .into_string()
                .map_err(|_| anyhow::anyhow!("feature ID must be UTF-8"))?,
        )?,
        None => anyhow::bail!("provide feature ID"),
    };
    let workbench = Workbench::discover(&project)?;
    let workflow = tokio::runtime::Builder::new_current_thread()
        .enable_time()
        .build()?
        .block_on(async { workbench.observe().await?.workflow(feature).await })?;
    println!("{}", serde_json::to_string_pretty(&workflow)?);
    Ok(())
}
