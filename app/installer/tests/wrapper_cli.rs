#![cfg(unix)]

use anyhow::Context;
use meta_cortex_workbench::versions::ProtocolVersion;
use std::fs::{self, Permissions};
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::{Command, Output};
use tempfile::{Builder, TempDir};

struct WrapperScenario {
    root: TempDir,
    caller: PathBuf,
    tools: PathBuf,
    cache: PathBuf,
    downloads: PathBuf,
}
impl WrapperScenario {
    fn new() -> anyhow::Result<Self> {
        let root = Builder::new()
            .prefix("wrapper project with spaces ")
            .tempdir()?;
        fs::write(
            root.path().join("meta-cortexw"),
            include_str!("../../../meta-cortexw"),
        )?;
        fs::write(root.path().join(".meta-cortex-version"), "0.15.0\n")?;
        let caller = root.path().join("caller with spaces");
        let tools = root.path().join("tools");
        let cache = root.path().join("cache with spaces");
        let downloads = root.path().join("downloads");
        fs::create_dir(&caller)?;
        let caller = caller.canonicalize()?;
        fs::create_dir(&tools)?;
        fs::write(tools.join("curl"), include_str!("wrapper/curl.sh"))?;
        fs::set_permissions(tools.join("curl"), Permissions::from_mode(0o755))?;
        Ok(Self {
            root,
            caller,
            tools,
            cache,
            downloads,
        })
    }
    fn command(&self) -> Command {
        let mut command = Command::new("sh");
        command
            .arg(self.root.path().join("meta-cortexw"))
            .current_dir(&self.caller)
            .env("META_CORTEX_WRAPPER_CACHE", &self.cache)
            .env("WRAPPER_DOWNLOAD_LOG", &self.downloads)
            .env("META_CORTEX_INSTALL_DIR", "/wrong")
            .env("CARGO_DIST_FORCE_INSTALL_DIR", "/wrong")
            .env("META_CORTEX_DOWNLOAD_URL", "https://wrong")
            .env("INSTALLER_DOWNLOAD_URL", "https://wrong")
            .env("PATH", format!("{}:/usr/bin:/bin", self.tools.display()));
        command
    }
    fn invoke(&self) -> anyhow::Result<Output> {
        Ok(self
            .command()
            .args([
                "run",
                "--request",
                "request with spaces.yaml",
                "",
                "$literal",
            ])
            .output()?)
    }
}

#[test]
fn cold_bootstrap_warm_cache_and_pin_switch_preserve_invocation() -> anyhow::Result<()> {
    let scenario = WrapperScenario::new()?;
    let cold = scenario.invoke()?;
    assert!(
        cold.status.success(),
        "{}",
        String::from_utf8_lossy(&cold.stderr)
    );
    let expected = format!(
        "cwd={}\narg=run\narg=--request\narg=request with spaces.yaml\narg=\narg=$literal\n",
        scenario.caller.display()
    );
    assert_eq!(String::from_utf8(cold.stdout)?, expected);
    assert!(scenario.cache.join("0.15.0/meta-cortex").is_file());
    assert!(scenario.invoke()?.status.success());
    assert_eq!(fs::read_to_string(&scenario.downloads)?.lines().count(), 1);
    fs::write(
        scenario.root.path().join(".meta-cortex-version"),
        "0.16.0\n",
    )?;
    assert!(scenario.invoke()?.status.success());
    assert_eq!(fs::read_to_string(&scenario.downloads)?.lines().count(), 2);
    assert!(scenario.cache.join("0.16.0/meta-cortex").is_file());
    assert!(scenario.cache.join("0.15.0/meta-cortex").is_file());
    let failure = scenario
        .command()
        .arg("list")
        .env("WRAPPER_BINARY_EXIT", "37")
        .output()?;
    assert_eq!(failure.status.code(), Some(37));
    Ok(())
}

#[test]
fn rejects_download_failure_bad_pin_and_wrong_cached_release() -> anyhow::Result<()> {
    let scenario = WrapperScenario::new()?;
    let failure = scenario
        .command()
        .arg("list")
        .env("WRAPPER_DOWNLOAD_FAILURE", "yes")
        .output()?;
    assert_eq!(failure.status.code(), Some(22));
    assert!(!scenario.cache.join("0.15.0/meta-cortex").exists());
    for pin in [
        "0.14.0",
        "0.15.0-beta.1",
        "0.15.0+build",
        "00.15.0",
        "latest",
        "0.15.0/../../escape",
        "0.15.0.1",
        "0..15",
        "0.15.0\n0.14.0",
    ] {
        fs::write(scenario.root.path().join(".meta-cortex-version"), pin)?;
        assert!(!scenario.invoke()?.status.success());
    }
    fs::write(scenario.root.path().join(".meta-cortex-version"), "0.15.0")?;
    assert!(scenario.invoke()?.status.success());
    let binary = scenario.cache.join("0.15.0/meta-cortex");
    let contents = fs::read_to_string(&binary)?.replace("0.15.0", "0.14.0");
    fs::write(binary, contents)?;
    let mismatch = scenario.invoke()?;
    assert!(!mismatch.status.success());
    assert!(String::from_utf8(mismatch.stderr)?.contains("version mismatch"));
    Ok(())
}

#[test]
fn typed_discovery_and_scaffolding_create_committable_wrapper() -> anyhow::Result<()> {
    #[derive(serde::Serialize)]
    struct Request {
        version: ProtocolVersion,
        project: PathBuf,
        operation: Operation,
    }
    #[derive(serde::Serialize)]
    #[serde(tag = "group", content = "command")]
    enum Operation {
        Framework(FrameworkOperation),
    }
    #[derive(serde::Serialize)]
    #[serde(tag = "name", content = "arguments")]
    enum FrameworkOperation {
        Wrapper(WrapperArguments),
    }
    #[derive(serde::Serialize)]
    struct WrapperArguments {
        release: Release,
    }
    #[derive(serde::Serialize)]
    enum Release {
        #[serde(rename = "0.15.0")]
        V0_15_0,
    }
    let root = tempfile::tempdir()?;
    let request = Request {
        version: ProtocolVersion::CURRENT,
        project: root.path().to_path_buf(),
        operation: Operation::Framework(FrameworkOperation::Wrapper(WrapperArguments {
            release: Release::V0_15_0,
        })),
    };
    let path = root.path().join("request.yaml");
    fs::write(&path, serde_saphyr::to_string(&request)?)?;
    let binary = env!("CARGO_BIN_EXE_meta-cortex");
    let catalog = Command::new(binary).arg("list").output()?;
    assert!(catalog.status.success());
    assert!(String::from_utf8(catalog.stdout)?.contains("name: Wrapper"));
    let generated = Command::new(binary)
        .args(["run", "--request"])
        .arg(&path)
        .output()?;
    assert!(
        generated.status.success(),
        "{}",
        String::from_utf8_lossy(&generated.stdout)
    );
    assert_eq!(
        fs::read_to_string(root.path().join(".meta-cortex-version"))?,
        "0.15.0\n"
    );
    assert_ne!(
        fs::metadata(root.path().join("meta-cortexw"))?
            .permissions()
            .mode()
            & 0o111,
        0
    );
    assert!(root.path().join("meta-cortexw.ps1").is_file());
    let repeated = Command::new(binary)
        .args(["run", "--request"])
        .arg(&path)
        .output()
        .context("repeat scaffold")?;
    assert_eq!(repeated.status.code(), Some(2));
    Ok(())
}
