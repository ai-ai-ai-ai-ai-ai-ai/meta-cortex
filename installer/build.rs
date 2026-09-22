mod build_support;

use build_support::FrameworkBundle;
use std::env;
use std::io;
use std::path::PathBuf;

fn main() -> io::Result<()> {
    println!("cargo:rerun-if-changed=../cortex");
    println!("cargo:rerun-if-changed=../LICENSE");
    println!("cargo:rerun-if-changed=build_support.rs");
    let manifest = env::var_os("CARGO_MANIFEST_DIR")
        .ok_or_else(|| io::Error::other("missing CARGO_MANIFEST_DIR"))?;
    let output = env::var_os("OUT_DIR").ok_or_else(|| io::Error::other("missing OUT_DIR"))?;
    let bundle = FrameworkBundle {
        source: PathBuf::from(manifest).join("../cortex"),
        destination: PathBuf::from(output).join("framework"),
    };
    bundle.stage()?;
    println!(
        "cargo:rustc-env=META_CORTEX_BUNDLE={}",
        bundle.destination.display()
    );
    Ok(())
}
