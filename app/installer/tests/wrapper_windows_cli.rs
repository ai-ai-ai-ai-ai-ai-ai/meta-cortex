#![cfg(windows)]

use meta_cortex_workbench::versions::ProtocolVersion;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Output};
use tempfile::{Builder, TempDir};

struct WindowsWrapperScenario {
    root: TempDir,
    caller: PathBuf,
    cache: PathBuf,
    downloads: PathBuf,
    driver: PathBuf,
    arguments: PathBuf,
    installer: PathBuf,
    wrapper: PathBuf,
}
impl WindowsWrapperScenario {
    fn new() -> anyhow::Result<Self> {
        let root = Builder::new()
            .prefix("wrapper project with spaces ")
            .tempdir()?;
        let caller = root.path().join("caller with spaces");
        fs::create_dir(&caller)?;
        let cache = root.path().join("cache with spaces");
        let downloads = root.path().join("downloads");
        let driver = root.path().join("driver.ps1");
        let arguments = root.path().join("arguments.txt");
        let installer = root.path().join("installer.ps1");
        let wrapper = root.path().join("meta-cortexw.ps1");
        fs::write(&driver, include_str!("wrapper/driver.ps1"))?;
        fs::write(&installer, include_str!("wrapper/installer.ps1"))?;
        fs::write(&wrapper, include_str!("../../../meta-cortexw.ps1"))?;
        fs::write(root.path().join(".meta-cortex-version"), "0.15.0\n")?;
        fs::write(&arguments, "--version\n")?;
        Ok(Self {
            root,
            caller,
            cache,
            downloads,
            driver,
            arguments,
            installer,
            wrapper,
        })
    }
    fn command(&self) -> Command {
        let mut command = Command::new("powershell.exe");
        command
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
            .arg(&self.driver)
            .current_dir(&self.caller)
            .env("META_CORTEX_WRAPPER_CACHE", &self.cache)
            .env("WRAPPER_DOWNLOAD_LOG", &self.downloads)
            .env("WRAPPER_TEST_BINARY", env!("CARGO_BIN_EXE_meta-cortex"))
            .env("WRAPPER_TEST_INSTALLER", &self.installer)
            .env("WRAPPER_TEST_ARGUMENTS", &self.arguments)
            .env("WRAPPER_TEST_SCRIPT", &self.wrapper)
            .env("META_CORTEX_INSTALL_DIR", "wrong")
            .env("CARGO_DIST_FORCE_INSTALL_DIR", "wrong")
            .env("META_CORTEX_DOWNLOAD_URL", "https://wrong")
            .env("INSTALLER_DOWNLOAD_URL", "https://wrong");
        command
    }
    fn invoke(&self) -> anyhow::Result<Output> {
        Ok(self.command().output()?)
    }
}

#[test]
fn powershell_bootstrap_cache_cwd_arguments_and_exit_status() -> anyhow::Result<()> {
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
    let scenario = WindowsWrapperScenario::new()?;
    let cold = scenario.invoke()?;
    assert!(
        cold.status.success(),
        "{}",
        String::from_utf8_lossy(&cold.stderr)
    );
    assert_eq!(String::from_utf8(cold.stdout)?.trim(), "meta-cortex 0.15.0");
    assert!(scenario.cache.join("0.15.0/meta-cortex.exe").is_file());
    let warm = scenario.invoke()?;
    assert!(warm.status.success());
    assert_eq!(String::from_utf8(warm.stdout)?.trim(), "meta-cortex 0.15.0");
    assert_eq!(fs::read_to_string(&scenario.downloads)?.lines().count(), 1);
    let request = Request {
        version: ProtocolVersion::CURRENT,
        project: scenario.caller.clone(),
        operation: Operation::Framework(FrameworkOperation::Wrapper(WrapperArguments {
            release: Release::V0_15_0,
        })),
    };
    fs::write(
        scenario.caller.join("request with spaces.yaml"),
        serde_saphyr::to_string(&request)?,
    )?;
    fs::write(
        &scenario.arguments,
        "run\n--request\nrequest with spaces.yaml\n",
    )?;
    let generated = scenario.invoke()?;
    assert!(
        generated.status.success(),
        "{}",
        String::from_utf8_lossy(&generated.stdout)
    );
    assert!(scenario.caller.join("meta-cortexw.ps1").is_file());
    assert_eq!(scenario.invoke()?.status.code(), Some(2));
    fs::write(
        scenario.root.path().join(".meta-cortex-version"),
        "0.16.0\n",
    )?;
    let mismatch = scenario.invoke()?;
    assert!(!mismatch.status.success());
    assert!(String::from_utf8(mismatch.stderr)?.contains("version mismatch"));
    assert!(scenario.cache.join("0.15.0/meta-cortex.exe").is_file());
    assert!(scenario.cache.join("0.16.0/meta-cortex.exe").is_file());
    Ok(())
}

#[test]
fn powershell_rejects_download_failure_and_invalid_pins() -> anyhow::Result<()> {
    let scenario = WindowsWrapperScenario::new()?;
    let failure = scenario
        .command()
        .env("WRAPPER_DOWNLOAD_FAILURE", "yes")
        .output()?;
    assert!(!failure.status.success());
    assert!(!scenario.cache.join("0.15.0/meta-cortex.exe").exists());
    for pin in [
        "0.14.0",
        "0.15.0-beta.1",
        "0.15.0+build",
        "00.15.0",
        "latest",
        "0.15.0/../../escape",
        "0.15.0.1",
        "0..15",
    ] {
        fs::write(scenario.root.path().join(".meta-cortex-version"), pin)?;
        assert!(!scenario.invoke()?.status.success());
    }
    Ok(())
}
