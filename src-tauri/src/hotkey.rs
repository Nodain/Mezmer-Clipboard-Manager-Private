use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::{hide_picker_window, show_picker_window};

pub const DEFAULT_PICKER_HOTKEY: &str = "control+shift+KeyV";
pub const WIN_V_PICKER_HOTKEY: &str = "super+KeyV";

pub fn normalize_hotkey(value: &str) -> Result<String, String> {
    let shortcut: Shortcut = value
        .trim()
        .parse::<Shortcut>()
        .map_err(|e| e.to_string())?;
    Ok(shortcut.into_string())
}

pub fn is_windows_clipboard_hotkey(hotkey: &str) -> bool {
    normalize_hotkey(hotkey)
        .map(|normalized| normalized.eq_ignore_ascii_case(WIN_V_PICKER_HOTKEY))
        .unwrap_or(false)
}

pub fn apply_hotkey_settings(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        if is_windows_clipboard_hotkey(hotkey) {
            let gs = app.global_shortcut();
            let _ = gs.unregister_all();
            windows_clipboard::prepare_system_for_win_v(false)?;
            return win_hotkey::register(app.clone());
        }
        win_hotkey::unregister()?;
    }

    register_picker_hotkey(app, hotkey)
}

pub fn register_picker_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let parsed: Shortcut = normalize_hotkey(hotkey)?
        .parse::<Shortcut>()
        .map_err(|e| e.to_string())?;

    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let _ = gs.unregister(parsed);

    gs.on_shortcut(parsed, |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            toggle_picker_window(app);
        }
    })
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("already registered") {
            format!(
                "Shortcut \"{hotkey}\" is already in use. Quit other Mezmer Clipboard instances or choose a different shortcut in Settings."
            )
        } else {
            msg
        }
    })?;

    Ok(())
}

pub fn toggle_picker_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("picker") {
        if window.is_visible().unwrap_or(false) {
            hide_picker_window(app);
        } else {
            show_picker_window(app);
        }
    }
}

#[cfg(windows)]
pub mod windows_clipboard {
    use std::process::Command;
    use std::thread;
    use std::time::Duration;

    use winreg::enums::*;
    use winreg::RegKey;

    const CLIPBOARD_KEY: &str = r"Software\Microsoft\Clipboard";
    const ENABLE_HISTORY: &str = "EnableClipboardHistory";
    const EXPLORER_ADVANCED_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
    const DISABLED_HOTKEYS: &str = "DisabledHotkeys";

    pub fn read_clipboard_history_enabled() -> Option<u32> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = hkcu.open_subkey(CLIPBOARD_KEY).ok()?;
        key.get_value(ENABLE_HISTORY).ok()
    }

    pub fn set_clipboard_history_enabled(value: u32) -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu
            .create_subkey(CLIPBOARD_KEY)
            .map_err(|e| e.to_string())?;
        key.set_value(ENABLE_HISTORY, &value)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn disable_clipboard_history() -> Result<(), String> {
        set_clipboard_history_enabled(0)
    }

    pub fn read_disabled_hotkeys() -> Option<String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = hkcu.open_subkey(EXPLORER_ADVANCED_KEY).ok()?;
        key.get_value(DISABLED_HOTKEYS).ok()
    }

    pub fn disabled_hotkeys_contains_v(value: &str) -> bool {
        value.to_ascii_uppercase().contains('V')
    }

    fn set_disabled_hotkeys(value: &str) -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu
            .create_subkey(EXPLORER_ADVANCED_KEY)
            .map_err(|e| e.to_string())?;
        key.set_value(DISABLED_HOTKEYS, &value)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn delete_disabled_hotkeys() -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = hkcu
            .open_subkey_with_flags(EXPLORER_ADVANCED_KEY, KEY_SET_VALUE)
            .map_err(|e| e.to_string())?;
        key.delete_value(DISABLED_HOTKEYS)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn ensure_win_v_blocked_in_explorer() -> Result<bool, String> {
        let current = read_disabled_hotkeys().unwrap_or_default();
        if disabled_hotkeys_contains_v(&current) {
            return Ok(false);
        }
        let mut next = current;
        next.push('V');
        set_disabled_hotkeys(&next)?;
        Ok(true)
    }

    pub fn restore_disabled_hotkeys(backup: &str) -> Result<(), String> {
        if backup.is_empty() {
            match read_disabled_hotkeys() {
                Some(current) if disabled_hotkeys_contains_v(&current) => {
                    let restored = current
                        .chars()
                        .filter(|ch| !ch.eq_ignore_ascii_case(&'v'))
                        .collect::<String>();
                    if restored.is_empty() {
                        delete_disabled_hotkeys()?;
                    } else {
                        set_disabled_hotkeys(&restored)?;
                    }
                }
                _ => {}
            }
            return Ok(());
        }
        set_disabled_hotkeys(backup)
    }

    pub fn restart_explorer() -> Result<(), String> {
        let kill = Command::new("taskkill")
            .args(["/F", "/IM", "explorer.exe"])
            .output()
            .map_err(|e| e.to_string())?;
        if !kill.status.success() {
            let detail = String::from_utf8_lossy(&kill.stderr);
            return Err(format!(
                "Could not restart File Explorer ({detail}). Close and reopen File Explorer manually, then try Win + V again."
            ));
        }

        thread::sleep(Duration::from_millis(400));

        Command::new("explorer.exe")
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn prepare_system_for_win_v(force_restart: bool) -> Result<(), String> {
        let mut changed = false;

        if read_clipboard_history_enabled() != Some(0) {
            disable_clipboard_history()?;
            changed = true;
        }

        if ensure_win_v_blocked_in_explorer()? {
            changed = true;
        }

        if changed || force_restart {
            restart_explorer()?;
        }

        Ok(())
    }
}

#[cfg(windows)]
mod win_hotkey {
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::{Arc, Mutex};
    use std::thread::{self, JoinHandle};
    use std::time::Duration;

    use tauri::AppHandle;
    use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
    use windows::Win32::System::Threading::GetCurrentThreadId;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT, MOD_WIN, VK_V,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        DispatchMessageW, GetMessageW, PostThreadMessageW, TranslateMessage, WM_HOTKEY, WM_QUIT,
        MSG,
    };

    const HOTKEY_ID: i32 = 0x4D5A;

    struct WinVHotkeyState {
        thread: JoinHandle<()>,
        thread_id: u32,
    }

    static WIN_V_HOTKEY: Mutex<Option<WinVHotkeyState>> = Mutex::new(None);

    pub fn register(app: AppHandle) -> Result<(), String> {
        unregister()?;

        let ready = Arc::new(AtomicBool::new(false));
        let ready_flag = ready.clone();
        let thread_id_slot = Arc::new(AtomicU32::new(0));
        let thread_id_for_thread = thread_id_slot.clone();
        let error = Arc::new(Mutex::new(None::<String>));
        let error_slot = error.clone();

        let handle = thread::spawn(move || {
            unsafe {
                thread_id_for_thread.store(GetCurrentThreadId(), Ordering::Release);

                if RegisterHotKey(
                    HWND::default(),
                    HOTKEY_ID,
                    MOD_WIN | MOD_NOREPEAT,
                    VK_V.0 as u32,
                )
                .is_err()
                {
                    *error_slot.lock().unwrap() = Some(
                        "Win + V is still reserved by Windows. Use the Win + V preset in Settings, then try again after File Explorer restarts.".to_string(),
                    );
                    return;
                }

                ready_flag.store(true, Ordering::Release);

                let mut msg = MSG::default();
                while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                    if msg.message == WM_HOTKEY && msg.wParam.0 == HOTKEY_ID as usize {
                        let app_for_cb = app.clone();
                        let _ = app.run_on_main_thread(move || {
                            super::toggle_picker_window(&app_for_cb);
                        });
                    }
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                let _ = UnregisterHotKey(HWND::default(), HOTKEY_ID);
            }
        });

        for _ in 0..100 {
            if ready.load(Ordering::Acquire) && thread_id_slot.load(Ordering::Acquire) != 0 {
                *WIN_V_HOTKEY.lock().unwrap() = Some(WinVHotkeyState {
                    thread: handle,
                    thread_id: thread_id_slot.load(Ordering::Acquire),
                });
                return Ok(());
            }
            if let Some(message) = error.lock().unwrap().clone() {
                let _ = handle.join();
                return Err(message);
            }
            thread::sleep(Duration::from_millis(10));
        }

        let _ = handle.join();
        Err("Timed out while registering Win + V.".to_string())
    }

    pub fn unregister() -> Result<(), String> {
        let state = WIN_V_HOTKEY.lock().unwrap().take();
        if let Some(state) = state {
            unsafe {
                let _ = PostThreadMessageW(state.thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
            }
            let _ = state.thread.join();
        }
        Ok(())
    }
}

#[cfg(windows)]
pub fn apply_windows_clipboard_hotkey_change(
    previous: &crate::settings::AppSettings,
    next: &mut crate::settings::AppSettings,
) -> Result<(), String> {
    let was_win_v = is_windows_clipboard_hotkey(&previous.picker_hotkey);
    let is_win_v = is_windows_clipboard_hotkey(&next.picker_hotkey);

    if is_win_v && !was_win_v {
        let hist_backup = windows_clipboard::read_clipboard_history_enabled().unwrap_or(1);
        let hotkeys_backup = windows_clipboard::read_disabled_hotkeys().unwrap_or_default();
        next.windows_clipboard_history_backup = Some(hist_backup);
        next.windows_disabled_hotkeys_backup = Some(hotkeys_backup);
        windows_clipboard::prepare_system_for_win_v(true)?;
    } else if !is_win_v && was_win_v {
        if let Some(backup) = previous.windows_clipboard_history_backup {
            windows_clipboard::set_clipboard_history_enabled(backup)?;
        }
        if let Some(backup) = &previous.windows_disabled_hotkeys_backup {
            windows_clipboard::restore_disabled_hotkeys(backup)?;
            windows_clipboard::restart_explorer()?;
        }
        next.windows_clipboard_history_backup = None;
        next.windows_disabled_hotkeys_backup = None;
    } else if is_win_v {
        windows_clipboard::prepare_system_for_win_v(false)?;
    }

    Ok(())
}
