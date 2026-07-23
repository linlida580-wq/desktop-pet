//! Reminder scheduler (R-06 / R-10).
//!
//! Runs a 1-second tick (tokio task on Tauri's runtime). On each tick it scans
//! the enabled reminders, applies the cycle rule + time tolerance, and emits a
//! `reminder_trigger` event to the frontend (which shows a Toast). A per-minute
//! fired-set prevents duplicate triggers within the tolerance window.

#![cfg(target_os = "windows")]

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use chrono::Datelike;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::reminder::model::{cycle_allows, fire_key, should_trigger_at, Reminder, TRIGGER_TOLERANCE_SEC};

/// Payload delivered to the frontend on trigger.
#[derive(Serialize, Clone, Debug)]
pub struct ReminderTrigger {
    pub id: String,
    pub message: String,
    /// Serialized as `withSound` to match the frontend `ReminderTrigger` type
    /// and the `ToastHost` payload field.
    #[serde(rename = "withSound")]
    pub with_sound: bool,
}

/// Shared, mutable reminder list (kept in sync with `Config.reminders`).
#[derive(Clone)]
pub struct ReminderScheduler {
    reminders: Arc<Mutex<Vec<Reminder>>>,
    fired: Arc<Mutex<HashSet<String>>>,
    running: Arc<AtomicBool>,
}

impl ReminderScheduler {
    pub fn new() -> Self {
        Self {
            reminders: Arc::new(Mutex::new(Vec::new())),
            fired: Arc::new(Mutex::new(HashSet::new())),
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Replace the active reminder list (called from `config_load`/edits).
    pub fn set_reminders(&self, reminders: Vec<Reminder>) {
        *self.reminders.lock().unwrap() = reminders;
    }

    /// Start the background tick loop.
    pub fn start(&self, app: AppHandle) {
        let reminders = self.reminders.clone();
        let fired = self.fired.clone();
        let running = self.running.clone();
        if running.load(Ordering::SeqCst) {
            return;
        }
        running.store(true, Ordering::SeqCst);

        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));
            while running.load(Ordering::SeqCst) {
                interval.tick().await;
                let now = chrono::Local::now();
                let weekday = now.weekday();

                let snapshot = reminders.lock().unwrap().clone();
                let mut fired_guard = fired.lock().unwrap();
                for r in snapshot.iter() {
                    if !r.enabled {
                        continue;
                    }
                    if !cycle_allows(&r.cycle, weekday) {
                        continue;
                    }
                    if should_trigger_at(&r.time, now.naive_local().time(), TRIGGER_TOLERANCE_SEC) {
                        let key = fire_key(&r.id, now);
                        if !fired_guard.contains(&key) {
                            fired_guard.insert(key);
                            let _ = app.emit(
                                "reminder_trigger",
                                ReminderTrigger {
                                    id: r.id.clone(),
                                    message: r.message.clone(),
                                    with_sound: r.with_sound,
                                },
                            );
                        }
                    }
                }
                // Periodic cleanup of stale fired keys (> 1 hour old is impossible
                // to collide, but keep the set bounded).
                if fired_guard.len() > 256 {
                    fired_guard.clear();
                }
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

impl Default for ReminderScheduler {
    fn default() -> Self {
        Self::new()
    }
}
