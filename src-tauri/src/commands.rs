//! IPC command handlers (frontend -> backend bridge).
//!
//! Naming follows `verb_noun` (architecture §7). Each command maps to a
//! Tauri `invoke` call wrapped by `src/ipc/api.ts` on the frontend.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::autostart;
use crate::config::{self, model::Config, model::Reminder, SharedConfig};
use crate::mouse::MouseTracker;
use crate::reminder::scheduler::{ReminderScheduler, ReminderTrigger};
use crate::window::transparent;

/// Result of a visibility toggle, emitted as `visibility_changed`.
#[derive(Serialize, Clone, Debug)]
pub struct VisibilityState {
    pub visible: bool,
}

// ---------------------------------------------------------------------------
// Window commands
// ---------------------------------------------------------------------------

/// Move the pet window to absolute screen coordinates (physical pixels).
#[tauri::command]
pub fn window_move(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        if let Ok(hwnd) = transparent::get_hwnd(&win) {
            transparent::move_window(hwnd, x, y);
        }
    }
    Ok(())
}

/// Toggle pet window visibility; emits `visibility_changed`.
#[tauri::command]
pub fn window_toggle(app: AppHandle) -> Result<bool, String> {
    let visible = if let Some(win) = app.get_webview_window("main") {
        if let Ok(hwnd) = transparent::get_hwnd(&win) {
            transparent::toggle_visibility(hwnd)
        } else {
            false
        }
    } else {
        false
    };
    let _ = app.emit("visibility_changed", VisibilityState { visible });
    Ok(visible)
}

/// Set the pet-interactive hit region (device px, window-local).
#[tauri::command]
pub fn window_set_hit_rect(x: i32, y: i32, w: i32, h: i32) {
    if w > 0 && h > 0 {
        transparent::set_hit_rect(Some((x, y, w, h)));
    } else {
        transparent::set_hit_rect(None);
    }
}

/// Enable/disable transparent-margin click-through.
#[tauri::command]
pub fn window_set_click_through(enabled: bool) {
    transparent::set_click_through(enabled);
}

// ---------------------------------------------------------------------------
// Config commands
// ---------------------------------------------------------------------------

/// Load the current in-memory config.
#[tauri::command]
pub fn config_load(state: State<'_, SharedConfig>) -> Config {
    state.lock().unwrap().clone()
}

/// Apply a config mutation, persist to disk, and sync dependent subsystems.
fn with_config<F>(app: &AppHandle, state: &State<'_, SharedConfig>, f: F) -> Result<(), String>
where
    F: FnOnce(&mut Config),
{
    let cfg = {
        let mut guard = state.lock().unwrap();
        f(&mut guard);
        guard.clone()
    };
    config::save_config(app, &cfg)?;
    if let Some(sched) = app.try_state::<ReminderScheduler>() {
        sched.set_reminders(cfg.reminders.clone());
    }
    if let Some(mouse) = app.try_state::<MouseTracker>() {
        if cfg.behavior.follow_mouse {
            mouse.start(app.clone());
        } else {
            mouse.stop();
        }
    }
    Ok(())
}

/// Save the whole config.
#[tauri::command]
pub fn config_save(app: AppHandle, state: State<'_, SharedConfig>, cfg: Config) -> Result<(), String> {
    with_config(&app, &state, |c| *c = cfg.clone())?;
    // Re-apply click-through preference.
    transparent::set_click_through(cfg.behavior.click_through);
    Ok(())
}

/// Persist only the window position (called on drag release, R-02).
#[tauri::command]
pub fn config_save_position(
    app: AppHandle,
    state: State<'_, SharedConfig>,
    x: i32,
    y: i32,
) -> Result<(), String> {
    with_config(&app, &state, |c| {
        c.position.x = x;
        c.position.y = y;
    })
}

// ---------------------------------------------------------------------------
// Reminder commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn reminder_add(
    app: AppHandle,
    state: State<'_, SharedConfig>,
    reminder: Reminder,
) -> Result<(), String> {
    with_config(&app, &state, |c| c.reminders.push(reminder))
}

#[tauri::command]
pub fn reminder_remove(
    app: AppHandle,
    state: State<'_, SharedConfig>,
    id: String,
) -> Result<(), String> {
    with_config(&app, &state, |c| {
        c.reminders.retain(|r| r.id != id);
    })
}

#[tauri::command]
pub fn reminder_update(
    app: AppHandle,
    state: State<'_, SharedConfig>,
    reminder: Reminder,
) -> Result<(), String> {
    with_config(&app, &state, |c| {
        if let Some(r) = c.reminders.iter_mut().find(|r| r.id == reminder.id) {
            *r = reminder;
        }
    })
}

// ---------------------------------------------------------------------------
// Auto-start command
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn autostart_set(
    app: AppHandle,
    state: State<'_, SharedConfig>,
    enabled: bool,
) -> Result<(), String> {
    let res = if enabled {
        autostart::enable()
    } else {
        autostart::disable()
    };
    if let Err(e) = res {
        return Err(e);
    }
    with_config(&app, &state, |c| c.autostart = enabled)
}

/// Emit a test reminder immediately (used by the tray "立即提醒测试" item).
#[tauri::command]
pub fn reminder_test(app: AppHandle) -> Result<(), String> {
    let _ = app.emit(
        "reminder_trigger",
        ReminderTrigger {
            id: "test".to_string(),
            message: "这是一条测试提醒 ✨".to_string(),
            with_sound: true,
        },
    );
    Ok(())
}
