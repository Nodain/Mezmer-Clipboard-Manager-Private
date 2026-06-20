use tauri::{AppHandle, Manager};

use crate::settings;
use crate::AppState;

fn picker_capture_protection_enabled(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    let Ok(conn) = state.conn.lock() else {
        return false;
    };
    settings::get_settings(&conn)
        .map(|s| s.hide_previews_from_capture)
        .unwrap_or(false)
}

/// Windows: WDA_EXCLUDEFROMCAPTURE — you see the picker normally; screen capture shows black.
pub fn apply_picker_capture_protection(app: &AppHandle) {
    let Some(picker) = app.get_webview_window("picker") else {
        return;
    };
    let enabled = picker_capture_protection_enabled(app);
    let _ = picker.set_content_protected(enabled);
}
