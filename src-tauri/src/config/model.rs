//! Configuration data models (Rust serde) and pure helpers.
//!
//! These structs mirror the JSON `config.json` schema documented in
//! `architecture.md` §7. Field names use `snake_case` in Rust and are
//! (re)named to `camelCase` for the JSON wire format so the frontend and
//! backend agree on a single schema.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::CommandArg;

/// A 2D screen point in **physical (device) pixels**.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

/// Appearance customization (R-08): body colors + worn accessories + scale.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Appearance {
    /// Map of color slot -> hex color, e.g. `{"body": "#ff9eb5"}`.
    #[serde(default)]
    pub colors: HashMap<String, String>,
    /// Ordered list of accessory ids, e.g. `["hat", "bow"]`.
    #[serde(default)]
    pub accessories: Vec<String>,
    /// Pet draw scale multiplier (1.0 = manifest default).
    #[serde(default = "default_scale")]
    pub scale: f32,
}

fn default_scale() -> f32 {
    1.0
}

/// The active pet profile (single pet in v1; `id` reserved for multi-pet, R-13).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct PetProfile {
    pub id: String,
    pub name: String,
    /// Path/reference to the sprite manifest (frontend resolves the bundled asset).
    pub manifest: String,
}

/// A single reminder (R-06 / R-10).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, CommandArg)]
pub struct Reminder {
    pub id: String,
    /// Reminder category: "water" | "rest" | "eye" | "custom".
    #[serde(rename = "type", default)]
    pub rem_type: String,
    /// Trigger time in "HH:MM" (24h) local time.
    #[serde(default)]
    pub time: String,
    /// Cycle rule: "daily" | "weekday" | "weekend".
    #[serde(default = "default_cycle")]
    pub cycle: String,
    #[serde(default = true)]
    pub enabled: bool,
    #[serde(default)]
    pub message: String,
    #[serde(rename = "withSound", default = true)]
    pub with_sound: bool,
}

fn default_cycle() -> String {
    "daily".to_string()
}

/// Behaviour switches (R-05 / R-09 / R-11).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Behavior {
    #[serde(rename = "followMouse", default)]
    pub follow_mouse: bool,
    #[serde(rename = "followSpeed", default = "default_follow_speed")]
    pub follow_speed: i32,
    #[serde(rename = "clickThrough", default = "default_click_through")]
    pub click_through: bool,
}

fn default_follow_speed() -> i32 {
    120
}

fn default_click_through() -> bool {
    true
}

/// Top-level configuration root persisted to `config.json`.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, CommandArg)]
pub struct Config {
    #[serde(default = "default_version")]
    pub version: i32,
    #[serde(default)]
    pub pet: PetProfile,
    #[serde(default)]
    pub appearance: Appearance,
    #[serde(default)]
    pub reminders: Vec<Reminder>,
    #[serde(default)]
    pub behavior: Behavior,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default)]
    pub position: Point,
}

fn default_version() -> i32 {
    1
}

impl Config {
    /// Build a sensible first-run configuration with the bundled default pet.
    pub fn default_config() -> Config {
        let mut colors = HashMap::new();
        colors.insert("body".to_string(), "#ff9eb5".to_string());
        colors.insert("hair".to_string(), "#3a3a3a".to_string());
        colors.insert("dress".to_string(), "#d9d9d9".to_string());
        colors.insert("cheek".to_string(), "#ff96aa".to_string());

        Config {
            version: 1,
            pet: PetProfile {
                id: "default".to_string(),
                name: "豆豆".to_string(),
                manifest: "assets/default_pet/manifest.json".to_string(),
            },
            appearance: Appearance {
                colors,
                accessories: vec![],
                scale: 1.0,
            },
            reminders: vec![
                Reminder {
                    id: "water".to_string(),
                    rem_type: "water".to_string(),
                    time: "10:00".to_string(),
                    cycle: "daily".to_string(),
                    enabled: true,
                    message: "该喝水啦 💧".to_string(),
                    with_sound: true,
                },
                Reminder {
                    id: "rest".to_string(),
                    rem_type: "rest".to_string(),
                    time: "15:00".to_string(),
                    cycle: "daily".to_string(),
                    enabled: true,
                    message: "起来走动走动，休息一下 🌿".to_string(),
                    with_sound: true,
                },
                Reminder {
                    id: "eye".to_string(),
                    rem_type: "eye".to_string(),
                    time: "21:00".to_string(),
                    cycle: "daily".to_string(),
                    enabled: true,
                    message: "看屏幕太久，远眺 20 秒 👀".to_string(),
                    with_sound: true,
                },
            ],
            behavior: Behavior {
                follow_mouse: false,
                follow_speed: 120,
                click_through: true,
            },
            autostart: false,
            position: Point { x: 200, y: 200 },
        }
    }
}

/// Pure coordinate/DPI helper used by the frontend bridge and unit-tested.
/// Multiplies a physical point by a DPI scale factor (e.g. 1.0 = 100% DPI).
pub fn scale_point(p: Point, factor: f64) -> Point {
    Point {
        x: (p.x as f64 * factor).round() as i32,
        y: (p.y as f64 * factor).round() as i32,
    }
}

/// Invert [`scale_point`] — divide by the DPI factor.
pub fn unscale_point(p: Point, factor: f64) -> Point {
    if factor == 0.0 {
        return p;
    }
    Point {
        x: (p.x as f64 / factor).round() as i32,
        y: (p.y as f64 / factor).round() as i32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_serialization_roundtrip() {
        let cfg = Config::default_config();
        let json = serde_json::to_string(&cfg).expect("serialize");
        let back: Config = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(cfg, back);
    }

    #[test]
    fn reminder_field_renames_match_json_schema() {
        let json = r#"{
            "id": "x", "type": "water", "time": "09:30",
            "cycle": "weekday", "enabled": false,
            "message": "hi", "withSound": false
        }"#;
        let r: Reminder = serde_json::from_str(json).unwrap();
        assert_eq!(r.rem_type, "water");
        assert_eq!(r.with_sound, false);
        assert_eq!(r.cycle, "weekday");
        assert!(!r.enabled);
    }

    #[test]
    fn scale_point_works() {
        let p = Point { x: 100, y: 50 };
        let scaled = scale_point(p, 1.5);
        assert_eq!(scaled, Point { x: 150, y: 75 });
        let back = unscale_point(scaled, 1.5);
        assert_eq!(back, p);
    }

    #[test]
    fn default_config_has_three_reminders() {
        assert_eq!(Config::default_config().reminders.len(), 3);
    }
}
