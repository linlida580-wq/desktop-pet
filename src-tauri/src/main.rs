// Windows-only desktop pet. Hides the console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod commands;
mod config;
mod mouse;
mod pet;
mod reminder;
mod tray;
mod window;

use tauri::Manager;

use crate::config::model::Config;
use crate::mouse::MouseTracker;
use crate::reminder::scheduler::ReminderScheduler;

#[cfg(target_os = "windows")]
use crate::window::transparent;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            // --- Config (in-memory + persisted) ---
            let cfg: Config = config::load_config(&handle);
            app.manage(std::sync::Mutex::new(cfg.clone()));

            // --- Reminder scheduler (1s tick loop) ---
            let scheduler = ReminderScheduler::new();
            scheduler.set_reminders(cfg.reminders.clone());
            scheduler.start(handle.clone());
            app.manage(scheduler);

            // --- Global mouse poller (follow feature) ---
            let mouse = MouseTracker::new();
            if cfg.behavior.follow_mouse {
                mouse.start(handle.clone());
            }
            app.manage(mouse);

            // --- Window styling + hit-test subclass (Windows only) ---
            #[cfg(target_os = "windows")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    if let Ok(hwnd) = transparent::get_hwnd(&win) {
                        transparent::apply_window_styles(hwnd);
                        transparent::install_hit_test(hwnd);
                        transparent::set_click_through(cfg.behavior.click_through);
                        // The frontend sets the precise pet hit-rect once it knows
                        // its size and DPI (via `window_set_hit_rect`).
                    }
                }
            }

            // --- Keep registry auto-start in sync with config (R-12) ---
            if cfg.autostart {
                let _ = crate::autostart::enable();
            } else {
                let _ = crate::autostart::disable();
            }

            // --- System tray (R-04) ---
            #[cfg(target_os = "windows")]
            crate::tray::build_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window_move,
            commands::window_toggle,
            commands::window_set_hit_rect,
            commands::window_set_click_through,
            commands::config_load,
            commands::config_save,
            commands::config_save_position,
            commands::reminder_add,
            commands::reminder_remove,
            commands::reminder_update,
            commands::autostart_set,
            commands::reminder_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running desktop-pet");
}
