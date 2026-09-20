fn main() {
    println!("cargo:rerun-if-changed=../framework");
    println!("cargo:rerun-if-changed=../LICENSE");
}
