fn main() {
    println!("cargo:rerun-if-changed=../cortex");
    println!("cargo:rerun-if-changed=../LICENSE");
}
