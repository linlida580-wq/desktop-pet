//! Windows registry auto-start (R-12, default OFF).
//!
//! Writes/removes a `Run` key entry pointing at the current executable. Uses
//! raw `advapi32` FFI to avoid a `windows` crate version dependency.

#![cfg(target_os = "windows")]

use std::os::raw::c_void;

type HKEY = *mut c_void;

const HKEY_CURRENT_USER: HKEY = 0x8000_0001usize as HKEY;
const KEY_WRITE: u32 = 0x20006;
const KEY_READ: u32 = 0x20019;
const REG_SZ: u32 = 1;

#[link(name = "advapi32")]
extern "system" {
    fn RegOpenKeyExW(
        hkey: HKEY,
        lpSubKey: *const u16,
        ulOptions: u32,
        samDesired: u32,
        phkResult: *mut HKEY,
    ) -> i32;
    fn RegSetValueExW(
        hkey: HKEY,
        lpValueName: *const u16,
        reserved: u32,
        dwType: u32,
        lpData: *const u8,
        cbData: u32,
    ) -> i32;
    fn RegDeleteValueW(hkey: HKEY, lpValueName: *const u16) -> i32;
    fn RegQueryValueExW(
        hkey: HKEY,
        lpValueName: *const u16,
        lpReserved: *mut u32,
        lpType: *mut u32,
        lpData: *mut u8,
        lpcbData: *mut u32,
    ) -> i32;
    fn RegCloseKey(hkey: HKEY) -> i32;
}

const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const VALUE_NAME: &str = "DesktopPet";

/// Convert a Rust string to a null-terminated UTF-16 vector.
fn to_wide(s: &str) -> Vec<u16> {
    let mut v: Vec<u16> = s.encode_utf16().collect();
    v.push(0);
    v
}

/// Enable auto-start: write the Run key with the current executable path.
pub fn enable() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let path = exe.to_string_lossy().to_string();
    let sub = to_wide(RUN_KEY);
    let value = to_wide(VALUE_NAME);
    let mut hkey: HKEY = std::ptr::null_mut();
    unsafe {
        let code = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            sub.as_ptr(),
            0,
            KEY_WRITE,
            &mut hkey,
        );
        if code != 0 {
            return Err(format!("RegOpenKeyExW failed: {code}"));
        }
        let mut data: Vec<u16> = path.encode_utf16().collect();
        data.push(0); // RegSetValueExW REG_SZ requires the trailing null.
        let bytes = data.len() * 2;
        let code = RegSetValueExW(
            hkey,
            value.as_ptr(),
            0,
            REG_SZ,
            data.as_ptr() as *const u8,
            bytes as u32,
        );
        RegCloseKey(hkey);
        if code != 0 {
            return Err(format!("RegSetValueExW failed: {code}"));
        }
    }
    Ok(())
}

/// Disable auto-start: delete the Run key value.
pub fn disable() -> Result<(), String> {
    let sub = to_wide(RUN_KEY);
    let value = to_wide(VALUE_NAME);
    let mut hkey: HKEY = std::ptr::null_mut();
    unsafe {
        let code = RegOpenKeyExW(HKEY_CURRENT_USER, sub.as_ptr(), 0, KEY_WRITE, &mut hkey);
        if code != 0 {
            return Err(format!("RegOpenKeyExW failed: {code}"));
        }
        let code = RegDeleteValueW(hkey, value.as_ptr());
        RegCloseKey(hkey);
        // 2 == ERROR_FILE_NOT_FOUND: already disabled, treat as success.
        if code != 0 && code != 2 {
            return Err(format!("RegDeleteValueW failed: {code}"));
        }
    }
    Ok(())
}

/// True if the Run key value currently exists.
pub fn is_enabled() -> bool {
    let sub = to_wide(RUN_KEY);
    let value = to_wide(VALUE_NAME);
    let mut hkey: HKEY = std::ptr::null_mut();
    unsafe {
        let code = RegOpenKeyExW(HKEY_CURRENT_USER, sub.as_ptr(), 0, KEY_READ, &mut hkey);
        if code != 0 {
            return false;
        }
        let mut cb: u32 = 0;
        let code = RegQueryValueExW(hkey, value.as_ptr(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), &mut cb);
        RegCloseKey(hkey);
        code == 0
    }
}

#[cfg(test)]
mod tests {
    // Registry tests require Windows + registry access; this is a compile check.
    #[test]
    fn wide_encoding_has_null_terminator() {
        let w = super::to_wide("abc");
        assert_eq!(w.last(), Some(&0));
        assert_eq!(w.len(), 4);
    }
}
