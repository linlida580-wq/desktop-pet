//! Global mouse position polling (R-05 follow, R-09).
//!
//! Per architecture risk note Q8 we deliberately avoid a `WH_MOUSE_LL` global
//! hook (it would wake the process on every mouse event and break R-07). Instead
//! we poll `GetCursorPos` at a throttled ~30 Hz from a background thread and
//! forward the position to the frontend via the `mouse_move` event, which the
//! frontend consumes only when follow is enabled.

#![cfg(target_os = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::window::transparent;

/// Payload emitted on every poll tick.
#[derive(Serialize, Clone, Debug)]
pub struct MousePos {
    pub x: i32,
    pub y: i32,
}

/// Background poller. Cheap: a single thread sleeping ~33 ms between reads.
#[derive(Clone)]
pub struct MouseTracker {
    running: Arc<AtomicBool>,
}

impl MouseTracker {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start polling and emitting `mouse_move` events.
    pub fn start(&self, app: AppHandle) {
        let running = self.running.clone();
        if running.load(Ordering::SeqCst) {
            return;
        }
        running.store(true, Ordering::SeqCst);
        std::thread::spawn(move || {
            while running.load(Ordering::SeqCst) {
                if let Some((x, y)) = transparent::get_cursor_pos() {
                    let _ = app.emit("mouse_move", MousePos { x, y });
                }
                std::thread::sleep(Duration::from_millis(33));
            }
        });
    }

    /// Stop polling.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

impl Default for MouseTracker {
    fn default() -> Self {
        Self::new()
    }
}
