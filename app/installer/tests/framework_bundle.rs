#[path = "../build_support.rs"]
mod build_support;

use build_support::FrameworkBundle;
use meta_cortex_workbench::agents::AgentId;
use schemars::generate::SchemaSettings;
use serde::{Deserialize, Serialize};
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

// JSON Schema owns oneOf/const/enum spellings. This projection consumes its
// generated alternatives rather than maintaining a second list of agent roles.
#[derive(Deserialize)]
struct AgentCatalogSchema {
    #[serde(rename = "oneOf")]
    teams: Vec<TeamSchema>,
}
#[derive(Deserialize)]
struct TeamSchema {
    properties: TeamProperties,
}
#[derive(Deserialize)]
struct TeamProperties {
    team: TeamConstant,
    role: RoleChoices,
}
#[derive(Deserialize)]
struct TeamConstant {
    #[serde(rename = "const")]
    name: CatalogTeam,
}
#[derive(Deserialize)]
struct RoleChoices {
    #[serde(rename = "enum")]
    roles: Vec<SchemaRoleName>,
}
#[derive(Deserialize, Serialize)]
#[serde(transparent)]
struct SchemaRoleName(String);

// Independent consumer of the schema's team constants, checked against the
// directory that actually owns each role. Role names come from the schema above.
#[derive(Clone, Copy, Deserialize, Serialize)]
enum CatalogTeam {
    Gizmo,
    Development,
    Ai,
    Security,
    Sre,
    Delivery,
}
impl CatalogTeam {
    fn agents_path(self) -> PathBuf {
        let directory = match self {
            Self::Gizmo => "gizmo-team",
            Self::Development => "dev-team",
            Self::Ai => "ai-team",
            Self::Security => "security-team",
            Self::Sre => "sre-team",
            Self::Delivery => "delivery-team",
        };
        PathBuf::from("teams").join(directory).join("agents")
    }
}

#[derive(Serialize)]
struct SchemaIdentity {
    team: CatalogTeam,
    role: SchemaRoleName,
}

#[test]
fn agent_hierarchy_matches_every_role_in_its_owning_team() -> anyhow::Result<()> {
    let mut settings = SchemaSettings::draft2020_12();
    settings.inline_subschemas = true;
    let schema = settings.into_generator().into_root_schema_for::<AgentId>();
    let catalog: AgentCatalogSchema = serde_json::from_value(serde_json::to_value(schema)?)?;
    let mut declared = BTreeSet::new();
    for team in catalog.teams {
        let team_name = team.properties.team.name;
        for role in team.properties.role.roles {
            let identity = SchemaIdentity {
                team: team_name,
                role,
            };
            let encoded = serde_json::to_string(&identity)?;
            let agent: AgentId = serde_json::from_str(&encoded)?;
            assert_eq!(
                serde_json::from_str::<AgentId>(&serde_json::to_string(&agent)?)?,
                agent
            );
            let path = agent.instructions_path();
            assert!(path.starts_with(team_name.agents_path()));
            assert!(declared.insert(path));
        }
    }
    let library = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../cortex");
    let mut bundled = BTreeSet::new();
    for team in fs::read_dir(library.join("teams"))? {
        let agents = team?.path().join("agents");
        if !agents.is_dir() {
            continue;
        }
        for agent in fs::read_dir(agents)? {
            let path = agent?.path().join("AGENTS.md");
            assert!(path.is_file());
            assert!(bundled.insert(path.strip_prefix(&library)?.to_path_buf()));
        }
    }
    assert_eq!(declared, bundled);
    Ok(())
}
