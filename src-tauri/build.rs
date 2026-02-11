fn main() {
    // Ensure Cargo watches ACL files when we use explicit patterns.
    println!("cargo:rerun-if-changed=capabilities");
    println!("cargo:rerun-if-changed=permissions");

    let attributes = tauri_build::Attributes::new()
        .capabilities_path_pattern("capabilities/**/*")
        .app_manifest(tauri_build::AppManifest::new().permissions_path_pattern("permissions/**/*"));

    tauri_build::try_build(attributes).expect("error while running tauri build");
}
