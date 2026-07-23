// Tauri build script. Generates the codegen required by `tauri::generate_context!`
// (embeds tauri.conf.json, icons, and the capability ACL manifests).
fn main() {
    tauri_build::build();
}
