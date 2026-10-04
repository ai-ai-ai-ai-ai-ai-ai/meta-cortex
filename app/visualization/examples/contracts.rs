use meta_cortex_visualization::DesktopContract;

fn main() {
    println!("{}", schemars::schema_for!(DesktopContract).as_value());
}
