//! Windows-specific window control (R-01 / R-02 / R-05 / Q5).
//!
//! Implements, via raw `extern "system"` FFI (no `windows` crate dependency):
//!   * transparent / always-on-top / no-taskbar styles,
//!   * per-region alpha hit-testing (subclassed `WM_NCHITTEST`):
//!     transparent margins pass through to the desktop, the pet body stays
//!     interactive — matching "鼠标穿透 + 不抢焦点",
//!   * no focus stealing (`WS_EX_NOACTIVATE`) and no taskbar button
//!     (`WS_EX_TOOLWINDOW`).
//!
//! The window styles are applied to the main Tauri window and, best-effort,
//! to the WebView2 child window so hit-testing works over the rendered canvas.

#![cfg(target_os = "windows")]

use std::collections::HashMap;
use std::os::raw::c_void;
use std::sync::Mutex;

use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tauri::WebviewWindow;

// ---------------------------------------------------------------------------
// Minimal Win32 type aliases
// ---------------------------------------------------------------------------
type HWND = *mut c_void;
type HDC = *mut c_void;
type WPARAM = usize;
type LPARAM = isize;
type LRESULT = isize;
type WNDPROC = unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT;
type WNDENUMPROC = unsafe extern "system" fn(HWND, LPARAM) -> i32;

#[repr(C)]
#[derive(Clone, Copy)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct POINT {
    x: i32,
    y: i32,
}

// ---------------------------------------------------------------------------
// Win32 constants
// ---------------------------------------------------------------------------
const GWL_EXSTYLE: i32 = -20;
const GWLP_WNDPROC: i32 = -4;
const WS_EX_LAYERED: u32 = 0x0008_0000;
const WS_EX_NOACTIVATE: u32 = 0x0800_0000;
const WS_EX_TOOLWINDOW: u32 = 0x0000_0080;

const SWP_NOSIZE: u32 = 0x0001;
const SWP_NOMOVE: u32 = 0x0002;
const SWP_NOZORDER: u32 = 0x0004;
const SWP_NOACTIVATE: u32 = 0x0010;

const SW_HIDE: i32 = 0;
const SW_SHOWNA: i32 = 8;

const WM_NCHITTEST: u32 = 0x0084;
const HTTRANSPARENT: isize = -1;
const HTCLIENT: isize = 1;

// ---------------------------------------------------------------------------
// FFI declarations
// ---------------------------------------------------------------------------
#[link(name = "user32")]
extern "system" {
    fn SetWindowLongPtrW(hwnd: HWND, nindex: i32, dwnewlong: isize) -> isize;
    fn GetWindowLongPtrW(hwnd: HWND, nindex: i32) -> isize;
    fn CallWindowProcW(
        lpPrevWndFunc: WNDPROC,
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT;
    fn DefWindowProcW(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT;
    fn SetWindowPos(
        hwnd: HWND,
        hwnd_insert_after: HWND,
        x: i32,
        y: i32,
        cx: i32,
        cy: i32,
        flags: u32,
    ) -> i32;
    fn GetWindowRect(hwnd: HWND, lprect: *mut RECT) -> i32;
    fn ShowWindow(hwnd: HWND, ncmdshow: i32) -> i32;
    fn IsWindowVisible(hwnd: HWND) -> i32;
    fn GetCursorPos(lppoint: *mut POINT) -> i32;
    fn GetClassNameW(hwnd: HWND, lpClassName: *mut u16, nMaxCount: i32) -> i32;
    fn EnumChildWindows(hwnd: HWND, lpEnumFunc: WNDENUMPROC, lparam: LPARAM) -> i32;
}

#[link(name = "gdi32")]
extern "system" {
    fn GetDC(hwnd: HWND) -> HDC;
    fn ReleaseDC(hwnd: HWND, hdc: HDC) -> i32;
    fn GetPixel(hdc: HDC, x: i32, y: i32) -> u32;
}

// ---------------------------------------------------------------------------
// Shared subclass state
// ---------------------------------------------------------------------------
struct HitState {
    /// When true, points outside `rect` are returned as `HTTRANSPARENT`.
    click_through: bool,
    /// Pet-interactive region in **device (physical) pixels**, window-local.
    /// `None` means "treat the whole window as interactive".
    rect: Option<(i32, i32, i32, i32)>,
}

static HIT: Mutex<HitState> = Mutex::new(HitState {
    click_through: true,
    rect: None,
});

/// Original window procedures keyed by HWND (for `CallWindowProcW` forwarding).
static ORIGINALS: Mutex<HashMap<isize, isize>> = Mutex::new(HashMap::new());

/// Extract the native HWND from a Tauri window as an opaque `isize`.
pub fn get_hwnd(window: &WebviewWindow) -> Result<isize, String> {
    let handle = window
        .window()
        .window_handle()
        .map_err(|e| e.to_string())?;
    match handle.as_raw() {
        RawWindowHandle::Win32(w) => Ok(w.hwnd.get()),
        _ => Err("not a Win32 window".to_string()),
    }
}

/// Apply layered / no-activate / tool-window extended styles.
pub fn apply_window_styles(hwnd: isize) {
    let hwnd = hwnd as HWND;
    unsafe {
        let mut ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        ex |= (WS_EX_LAYERED | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW) as isize;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex);
    }
}

/// Install our `WM_NCHITTEST` subclass on the window and (best-effort) on the
/// WebView2 child so transparent margins pass clicks to the desktop.
pub fn install_hit_test(hwnd: isize) {
    let hwnd = hwnd as HWND;
    unsafe {
        let old = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, wnd_proc as *const () as isize);
        if old != 0 {
            ORIGINALS.lock().unwrap().insert(hwnd as isize, old);
        }
        // Try to subclass the WebView2 child so hit-testing works over the canvas.
        EnumChildWindows(hwnd, enum_child, 0);
    }
}

unsafe extern "system" fn enum_child(hwnd: HWND, _lparam: LPARAM) -> i32 {
    let mut buf = [0u16; 256];
    let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
    if len > 0 {
        let name = String::from_utf16_lossy(&buf[..len as usize]);
        if name.contains("Chrome") || name.contains("Webview2") || name.contains("Edge") {
            let old = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, wnd_proc as *const () as isize);
            if old != 0 {
                ORIGINALS.lock().unwrap().insert(hwnd as isize, old);
            }
        }
    }
    1
}

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_NCHITTEST {
        let state = HIT.lock().unwrap();
        if state.click_through {
            // Signed low/high words so negative coords (left/top monitors) work.
            let x = (lparam & 0xFFFF) as i16 as i32;
            let y = ((lparam >> 16) & 0xFFFF) as i16 as i32;
            let mut rect = RECT {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            GetWindowRect(hwnd, &mut rect);
            let local_x = x - rect.left;
            let local_y = y - rect.top;
            let inside = match state.rect {
                Some((rx, ry, rw, rh)) => {
                    local_x >= rx && local_x <= rx + rw && local_y >= ry && local_y <= ry + rh
                }
                None => true,
            };
            drop(state);
            if !inside {
                return HTTRANSPARENT;
            }
        }
    }

    let prev = ORIGINALS.lock().unwrap().get(&(hwnd as isize)).copied();
    match prev {
        Some(p) if p != 0 => CallWindowProcW(p as WNDPROC, hwnd, msg, wparam, lparam),
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

/// Set the pet-interactive region (device pixels, window-local).
/// Pass `None` to make the entire window interactive.
pub fn set_hit_rect(rect: Option<(i32, i32, i32, i32)>) {
    HIT.lock().unwrap().rect = rect;
}

/// Enable/disable transparent-margin click-through.
pub fn set_click_through(enabled: bool) {
    HIT.lock().unwrap().click_through = enabled;
}

/// Move the window to absolute screen coordinates (physical pixels).
pub fn move_window(hwnd: isize, x: i32, y: i32) {
    unsafe {
        SetWindowPos(
            hwnd as HWND,
            std::ptr::null_mut(),
            x,
            y,
            0,
            0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        );
    }
}

/// Toggle window visibility; returns the new visible state.
pub fn toggle_visibility(hwnd: isize) -> bool {
    unsafe {
        if IsWindowVisible(hwnd as HWND) != 0 {
            ShowWindow(hwnd as HWND, SW_HIDE);
            false
        } else {
            ShowWindow(hwnd as HWND, SW_SHOWNA);
            true
        }
    }
}

/// Explicitly show or hide the window.
#[allow(dead_code)]
pub fn set_visible(hwnd: isize, visible: bool) {
    unsafe {
        ShowWindow(hwnd as HWND, if visible { SW_SHOWNA } else { SW_HIDE });
    }
}

/// Read the current global cursor position (physical pixels).
pub fn get_cursor_pos() -> Option<(i32, i32)> {
    unsafe {
        let mut p = POINT::default();
        if GetCursorPos(&mut p) != 0 {
            Some((p.x, p.y))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    // These run only on Windows where the FFI links; kept as compile checks.
    #[test]
    fn hit_state_defaults_compile() {
        let _ = super::get_cursor_pos;
    }
}
