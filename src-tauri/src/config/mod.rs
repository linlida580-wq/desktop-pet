//! JSON persistence layer for [`Config`] (Q3: local JSON, no network).

pub mod model;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::Manager;
use tauri::AppHandle;

pub use model::{Config, Point};

/// Resolve the absolute path of `config.json` inside the OS config directory.
///
/// Falls back to the current working directory if the platform config dir is
/// unavailable (e.g. some sandboxed/test environments).
pub fn config_path(app: &AppHandle) -> PathBuf {
    match app.path().app_config_dir() {
        Ok(dir) => dir.join("config.json"),
        Err(_) => PathBuf::from("config.json"),
    }
}

/// Load config, creating a default file on first run.
pub fn load_config(app: &AppHandle) -> Config {
    let path = config_path(app);
    if path.exists() {
        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(cfg) = serde_json::from_str::<Config>(&text) {
                return cfg;
            }
        }
    }
    let cfg = Config::default_config();
    let _ = save_config(app, &cfg);
    cfg
}

/// Persist the full config to disk (pretty-printed for easy debugging).
pub fn save_config(app: &AppHandle, cfg: &Config) -> Result<(), String> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let text = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(())
}

/// Convenience: update only the persisted window position.
pub fn save_position(app: &AppHandle, x: i32, y: i32) -> Result<(), String> {
    let mut cfg = load_config(app);
    cfg.position = Point { x, y };
    save_config(app, &cfg)
}

/// Shared in-memory config state managed by Tauri.
pub struct ConfigState;

/// Type alias used by command handlers: `State<'_, Mutex<Config>>`.
pub type SharedConfig = Mutex<Config>;

/// Helper to flush the in-memory config to disk.
pub fn flush(app: &AppHandle, cfg: &Config) -> Result<(), String> {
    save_config(app, cfg)
}
