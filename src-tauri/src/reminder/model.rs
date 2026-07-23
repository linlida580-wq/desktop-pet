//! Reminder domain logic — pure, unit-testable (R-06 / R-10).
//!
//! The [`Reminder`] struct lives in `config::model` (it is part of the
//! persisted `Config`). This module provides the schedule-matching rules used
//! by the scheduler and covered by `cargo test`.

pub use crate::config::model::Reminder;

use chrono::{NaiveTime, Timelike, Weekday};

/// Tolerance for triggering: fire within `±TRIGGER_TOLERANCE_SEC` seconds of
/// the target time (R-06: error ≤ ±2s).
pub const TRIGGER_TOLERANCE_SEC: i64 = 2;

/// Parse a `"HH:MM"` 24h time string into `(hour, minute)`.
pub fn parse_time(t: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = t.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    // Strict `HH:MM`: require zero-padded two-digit hour and minute.
    if parts[0].len() != 2 || parts[1].len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    if h >= 24 || m >= 60 {
        return None;
    }
    Some((h, m))
}

/// Whether `now` is within tolerance of the reminder's target time.
pub fn should_trigger_at(time: &str, now: NaiveTime, tolerance_sec: i64) -> bool {
    match parse_time(time) {
        Some((h, m)) => match NaiveTime::from_hms_opt(h, m, 0) {
            Some(target) => {
                let diff = now.num_seconds_from_midnight() as i64
                    - target.num_seconds_from_midnight() as i64;
                diff >= 0 && diff <= tolerance_sec
            }
            None => false,
        },
        None => false,
    }
}

/// Whether the cycle rule permits firing on `weekday`.
pub fn cycle_allows(cycle: &str, weekday: Weekday) -> bool {
    match cycle {
        "daily" | "every" | "" => true,
        "weekday" => !matches!(weekday, Weekday::Sat | Weekday::Sun),
        "weekend" => matches!(weekday, Weekday::Sat | Weekday::Sun),
        // Unknown rules default to "always" so a typo never silently disables.
        _ => true,
    }
}

/// Build a stable per-minute key so each reminder fires at most once per minute.
pub fn fire_key(id: &str, now: chrono::DateTime<chrono::Local>) -> String {
    now.format(&format!("{}-%Y-%m-%d-%H-%M", id)).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Timelike;

    #[test]
    fn parse_time_basic() {
        assert_eq!(parse_time("09:30"), Some((9, 30)));
        assert_eq!(parse_time("23:59"), Some((23, 59)));
        assert_eq!(parse_time("24:00"), None);
        assert_eq!(parse_time("9:5"), None);
        assert_eq!(parse_time("nope"), None);
    }

    #[test]
    fn trigger_within_tolerance() {
        let target = NaiveTime::from_hms_opt(10, 0, 0).unwrap();
        // second 0 -> diff 0 -> should trigger
        assert!(should_trigger_at("10:00", target, 2));
        // 1s after -> diff 1 -> should trigger
        let t1 = NaiveTime::from_hms_opt(10, 0, 1).unwrap();
        assert!(should_trigger_at("10:00", t1, 2));
        // 3s after -> diff 3 -> outside tolerance
        let t3 = NaiveTime::from_hms_opt(10, 0, 3).unwrap();
        assert!(!should_trigger_at("10:00", t3, 2));
        // 1s before -> diff -1 -> before target, not yet
        let before = NaiveTime::from_hms_opt(9, 59, 59).unwrap();
        assert!(!should_trigger_at("10:00", before, 2));
    }

    #[test]
    fn cycle_rules() {
        assert!(cycle_allows("daily", Weekday::Mon));
        assert!(cycle_allows("daily", Weekday::Sun));
        assert!(cycle_allows("weekday", Weekday::Tue));
        assert!(!cycle_allows("weekday", Weekday::Sat));
        assert!(cycle_allows("weekend", Weekday::Sat));
        assert!(!cycle_allows("weekend", Weekday::Wed));
    }

    #[test]
    fn fire_key_unique_per_minute() {
        let now = chrono::Local::now();
        let k1 = fire_key("water", now);
        assert!(k1.starts_with("water-"));
        assert_eq!(k1, fire_key("water", now));
        let other = now
            .with_second(0)
            .unwrap()
            .with_minute(now.minute() + 1)
            .unwrap();
        assert_ne!(k1, fire_key("water", other));
    }
}
