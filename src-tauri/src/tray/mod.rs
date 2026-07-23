//! System tray (R-04): always-resident icon + context menu.
//!
//! Menu items:
//!   * 显示/隐藏宠物  -> toggles the pet window (emits `visibility_changed`)
//!   * 设置…          -> emits `open_settings`
//!   * 立即提醒测试    -> emits a test `reminder_trigger`
//!   * 关于           -> emits `open_about`
//!   * 退出           -> terminates the process

#![cfg(target_os = "windows")]

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

use crate::window::transparent;

/// Build and register the system tray.
pub fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(include_bytes!("../../icons/tray.png"))
        .expect("failed to load bundled tray icon");

    let toggle = MenuItem::with_id(app, "toggle", "显示/隐藏宠物", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
    let test = MenuItem::with_id(app, "test", "立即提醒测试", true, None::<&str>)?;
    let about = MenuItem::with_id(app, "about", "关于", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle, &settings, &test, &about, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("桌面宠物")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => {
                if let Some(win) = app.get_webview_window("main") {
                    if let Ok(hwnd) = transparent::get_hwnd(&win) {
                        let visible = transparent::toggle_visibility(hwnd);
                        let _ = app.emit("visibility_changed", crate::commands::VisibilityState { visible });
                        let _ = app.emit("tray_toggle_visibility", ());
                    }
                }
            }
            "settings" => {
                let _ = app.emit("open_settings", ());
            }
            "test" => {
                let _ = app.emit(
                    "reminder_trigger",
                    crate::reminder::scheduler::ReminderTrigger {
                        id: "test".to_string(),
                        message: "这是一条测试提醒 ✨".to_string(),
                        with_sound: true,
                    },
                );
            }
            "about" => {
                let _ = app.emit("open_about", ());
            }
            "quit" => {
                std::process::exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
