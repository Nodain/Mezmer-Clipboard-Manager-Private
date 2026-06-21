use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::clipboard::{self, ImagePayload};
use crate::db::{self, ClipRecord, SavedColor};
use crate::eyedropper;
use crate::screen;
use crate::settings::{self, AppSettings};
use crate::hotkey;
use crate::autostart;
use crate::{hide_picker_window, hide_settings_window, show_settings_window, AppState};
use crate::capture_protection;

type CmdResult<T> = Result<T, String>;

#[tauri::command]
pub fn list_clips(
    state: State<AppState>,
    search: Option<String>,
    limit: Option<i64>,
) -> CmdResult<Vec<ClipRecord>> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_clips(&conn, search.as_deref(), limit.unwrap_or(100))
}

#[tauri::command]
pub fn delete_clip(state: State<AppState>, id: i64) -> CmdResult<()> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_clip(&conn, id)
}

#[tauri::command]
pub fn clear_clips(state: State<AppState>, keep_pinned: Option<bool>) -> CmdResult<()> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::clear_clips(&conn, keep_pinned.unwrap_or(true))
}

#[tauri::command]
pub fn toggle_pin(state: State<AppState>, id: i64) -> CmdResult<bool> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::toggle_pin(&conn, id)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyResult {
    pub ok: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum CopyMode {
    #[default]
    Default,
    PlainText,
    Formatted,
}

#[tauri::command]
pub fn copy_clip(
    state: State<AppState>,
    id: i64,
    mode: Option<CopyMode>,
) -> CmdResult<CopyResult> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let clip = db::fetch_clip(&conn, id)?;
    drop(conn);

    clipboard::suppress_next_capture();
    let mut board = Clipboard::new().map_err(|e| e.to_string())?;
    let mode = mode.unwrap_or(CopyMode::Default);

    match clip.kind.as_str() {
        "text" | "url" => {
            let text = clip.content.unwrap_or_default();
            match mode {
                CopyMode::PlainText => {
                    board.set_text(text).map_err(|e| e.to_string())?;
                }
                CopyMode::Formatted => {
                    if let Some(html) = clip.html_content.filter(|h| !h.trim().is_empty()) {
                        board
                            .set_html(html, Some(text))
                            .map_err(|e| e.to_string())?;
                    } else {
                        board.set_text(text).map_err(|e| e.to_string())?;
                    }
                }
                CopyMode::Default => {
                    if let Some(html) = clip.html_content.filter(|h| !h.trim().is_empty()) {
                        board
                            .set_html(html, Some(text))
                            .map_err(|e| e.to_string())?;
                    } else {
                        board.set_text(text).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "image" => {
            let path = clip.image_path.ok_or("missing image path")?;
            let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
            let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
            let rgba = img.to_rgba8();
            let (w, h) = rgba.dimensions();
            board
                .set_image(arboard::ImageData {
                    width: w as usize,
                    height: h as usize,
                    bytes: rgba.into_raw().into(),
                })
                .map_err(|e| e.to_string())?;
        }
        "files" => {
            let json = clip.content.ok_or("missing file list")?;
            let paths: Vec<String> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
            #[cfg(windows)]
            {
                clipboard::copy_files_to_clipboard(&paths)?;
            }
            #[cfg(not(windows))]
            {
                let joined = paths.join("\n");
                board.set_text(joined).map_err(|e| e.to_string())?;
            }
        }
        _ => return Err(format!("unsupported clip kind: {}", clip.kind)),
    }

    Ok(CopyResult { ok: true })
}

#[tauri::command]
pub fn get_clip_image(
    state: State<AppState>,
    id: i64,
    thumbnail: Option<bool>,
) -> CmdResult<ImagePayload> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let clip = db::fetch_clip(&conn, id)?;
    let path = clip.image_path.ok_or("not an image clip")?;
    if thumbnail.unwrap_or(false) {
        clipboard::read_image_thumbnail_base64(&path)
    } else {
        clipboard::read_image_base64(&path)
    }
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> CmdResult<AppSettings> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    settings::get_settings(&conn)
}

#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    state: State<AppState>,
    mut settings: AppSettings,
) -> CmdResult<AppSettings> {
    settings.picker_hotkey = hotkey::normalize_hotkey(&settings.picker_hotkey)
        .unwrap_or_else(|_| hotkey::DEFAULT_PICKER_HOTKEY.to_string());

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let previous = settings::get_settings(&conn)?;

    #[cfg(windows)]
    hotkey::apply_windows_clipboard_hotkey_change(&previous, &mut settings)?;

    settings::set_settings(&conn, &settings)?;
    let mut saved = settings::get_settings(&conn)?;
    drop(conn);

    hotkey::apply_hotkey_settings(&app, &saved.picker_hotkey)?;

    #[cfg(desktop)]
    if let Ok(actual) = autostart::reconcile_autostart(&app, saved.autostart_enabled) {
        if actual != saved.autostart_enabled {
            let state = app.state::<AppState>();
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            saved.autostart_enabled = actual;
            settings::set_settings(&conn, &saved)?;
        }
    }

    #[cfg(not(desktop))]
    autostart::apply_autostart(&app, saved.autostart_enabled)?;

    if previous.carousel_mode != saved.carousel_mode
        || previous.open_on_cursor_monitor != saved.open_on_cursor_monitor
    {
        if let Some(picker) = app.get_webview_window("picker") {
            if picker.is_visible().unwrap_or(false) {
                let _ = crate::window_anchor::place_picker_window(&picker, &app);
            }
        }
    }

    if previous.hide_previews_from_capture != saved.hide_previews_from_capture {
        capture_protection::apply_picker_capture_protection(&app);
    }

    let _ = app.emit("settings-changed", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn hide_picker(app: AppHandle) -> CmdResult<()> {
    hide_picker_window(&app);
    Ok(())
}

#[tauri::command]
pub fn show_settings(app: AppHandle) -> CmdResult<()> {
    show_settings_window(&app);
    Ok(())
}

#[tauri::command]
pub fn hide_settings(app: AppHandle) -> CmdResult<()> {
    hide_settings_window(&app);
    Ok(())
}

#[tauri::command]
pub fn list_saved_colors(
    state: State<AppState>,
    limit: Option<i64>,
) -> CmdResult<Vec<SavedColor>> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::list_saved_colors(&conn, limit.unwrap_or(100))
}

#[tauri::command]
pub fn delete_saved_color(state: State<AppState>, id: i64) -> CmdResult<()> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_saved_color(&conn, id)
}

#[tauri::command]
pub fn copy_saved_color(state: State<AppState>, id: i64) -> CmdResult<CopyResult> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let colors = db::list_saved_colors(&conn, 1000)?;
    let color = colors
        .into_iter()
        .find(|c| c.id == id)
        .ok_or("color not found")?;
    drop(conn);

    clipboard::suppress_next_capture();
    let mut board = Clipboard::new().map_err(|e| e.to_string())?;
    board
        .set_text(color.hex.clone())
        .map_err(|e| e.to_string())?;
    Ok(CopyResult { ok: true })
}

#[tauri::command]
pub fn start_eyedropper(app: AppHandle) -> CmdResult<()> {
    eyedropper::show_eyedropper_window(&app)
}

#[tauri::command]
pub fn cancel_eyedropper(app: AppHandle) -> CmdResult<()> {
    eyedropper::finish_eyedropper(&app, true)
}

#[tauri::command]
pub fn pick_screen_color(app: AppHandle, state: State<AppState>) -> CmdResult<SavedColor> {
    let (_x, _y) = screen::cursor_position()?;
    let (r, g, b) = screen::sample_pixel(_x, _y)?;
    let hex = screen::rgb_to_hex(r, g, b);

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let saved = db::insert_saved_color(&conn, &hex, r, g, b)?;
    drop(conn);

    eyedropper::finish_eyedropper(&app, true)?;
    let _ = app.emit("colors-updated", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn copy_text(text: String) -> CmdResult<CopyResult> {
    clipboard::suppress_next_capture();
    let mut board = Clipboard::new().map_err(|e| e.to_string())?;
    board.set_text(text).map_err(|e| e.to_string())?;
    Ok(CopyResult { ok: true })
}

#[tauri::command]
pub fn copy_image_url(url: String) -> CmdResult<CopyResult> {
    clipboard::copy_gif_from_url(&url)?;
    Ok(CopyResult { ok: true })
}

#[tauri::command]
pub fn search_gifs(
    api_key: String,
    query: Option<String>,
    limit: Option<u32>,
) -> CmdResult<Vec<crate::gifs::GifItem>> {
    crate::gifs::search_klipy(&api_key, query.as_deref(), limit.unwrap_or(24))
}
