#[path = "../build_support.rs"]
mod build_support;

use build_support::FrameworkBundle;
use meta_cortex_workbench::values::AgentId;
use schemars::schema_for;
use serde::Deserialize;
use std::collections::BTreeSet;
use std::fs;
use std::io;
use std::os::unix::fs::symlink;
use std::path::PathBuf;
use tempfile::{TempDir, tempdir};

struct BundleFixture {
    directory: TempDir,
}

impl BundleFixture {
    fn create() -> io::Result<Self> {
        Ok(Self {
            directory: tempdir()?,
        })
    }

    fn excludes_dependencies(self) -> io::Result<()> {
        let source = self.directory.path().join("source");
        let destination = self.directory.path().join("bundle");
        fs::create_dir_all(source.join("agents/skill/scripts/node_modules"))?;
        fs::create_dir_all(source.join("node_modules"))?;
        fs::write(source.join("node_modules/large-package"), "dependency")?;
        fs::write(
            source.join("agents/skill/scripts/node_modules/nested"),
            "dependency",
        )?;
        fs::write(source.join("agents/skill/scripts/package.json"), "{}")?;
        fs::write(source.join("bun.lock"), "workspace-lock")?;
        let bundle = FrameworkBundle {
            source,
            destination,
        };
        bundle.stage()?;
        assert!(!bundle.destination.join("node_modules").exists());
        assert!(
            !bundle
                .destination
                .join("agents/skill/scripts/node_modules")
                .exists()
        );
        assert_eq!(
            fs::read_to_string(bundle.destination.join("bun.lock"))?,
            "workspace-lock"
        );
        assert!(
            bundle
                .destination
                .join("agents/skill/scripts/package.json")
                .is_file()
        );
        fs::remove_file(bundle.source.join("bun.lock"))?;
        bundle.stage()?;
        assert!(!bundle.destination.join("bun.lock").exists());
        Ok(())
    }

    fn rejects_source_links(self) -> io::Result<()> {
        let source = self.directory.path().join("source");
        fs::create_dir(&source)?;
        symlink(self.directory.path(), source.join("loop"))?;
        let bundle = FrameworkBundle {
            source,
            destination: self.directory.path().join("bundle"),
        };
        assert!(bundle.stage().is_err());
        Ok(())
    }
}

#[test]
fn bundles_framework_without_local_dependencies_or_stale_files() -> io::Result<()> {
    BundleFixture::create()?.excludes_dependencies()
}

#[test]
fn rejects_symlinks_in_framework_source() -> io::Result<()> {
    BundleFixture::create()?.rejects_source_links()
}

// Consume the generated enum schema, so a new variant cannot evade this check
// by being omitted from a separately maintained list of known agents.
#[derive(Deserialize)]
struct AgentCatalogSchema {
    #[serde(rename = "enum")]
    agents: Vec<AgentId>,
}

#[test]
fn agent_enum_matches_every_bundled_role() -> anyhow::Result<()> {
    let schema: AgentCatalogSchema =
        serde_json::from_value(serde_json::to_value(schema_for!(AgentId))?)?;
    let mut declared = BTreeSet::new();
    for agent in schema.agents {
        let encoded = serde_json::to_string(&agent)?;
        assert_eq!(serde_json::from_str::<AgentId>(&encoded)?, agent);
        assert_eq!(serde_json::from_str::<String>(&encoded)?, agent.to_string());
        assert!(declared.insert(PathBuf::from(agent.to_string())));
    }
    let teams = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../cortex/teams");
    let mut bundled = BTreeSet::new();
    for team in fs::read_dir(teams)? {
        let agents = team?.path().join("agents");
        if !agents.is_dir() {
            continue;
        }
        for agent in fs::read_dir(agents)? {
            let agent = agent?;
            assert!(agent.path().join("AGENTS.md").is_file());
            assert!(bundled.insert(PathBuf::from(agent.file_name())));
        }
    }
    assert_eq!(declared, bundled);
    Ok(())
}
