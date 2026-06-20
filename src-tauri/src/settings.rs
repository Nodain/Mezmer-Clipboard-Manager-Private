use std::collections::HashMap;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

pub const DEFAULT_MAX_HISTORY: i64 = 200;
pub const DEFAULT_PICKER_HOTKEY: &str = "control+shift+KeyV";
pub const DEFAULT_NAV_PREV_KEY: &str = "ArrowLeft";
pub const DEFAULT_NAV_NEXT_KEY: &str = "ArrowRight";
pub const DEFAULT_COPY_KEY: &str = "Enter";
pub const DEFAULT_CLOSE_KEY: &str = "Escape";

pub const DEFAULT_THEME_ACCENT: &str = "#7e5ed7";
pub const DEFAULT_THEME_BORDER: &str = "#262626";
pub const DEFAULT_THEME_VIEW_BG: &str = "#141414";
pub const DEFAULT_THEME_PANEL: &str = "#1a1a1a";

pub const DEFAULT_LIST_IMAGE_PREVIEW_HEIGHT: i64 = 220;
pub const MIN_LIST_IMAGE_PREVIEW_HEIGHT: i64 = 80;
pub const MAX_LIST_IMAGE_PREVIEW_HEIGHT: i64 = 400;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeSettings {
    pub accent: String,
    pub border: String,
    pub view_bg: String,
    pub panel: String,
}

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            accent: DEFAULT_THEME_ACCENT.to_string(),
            border: DEFAULT_THEME_BORDER.to_string(),
            view_bg: DEFAULT_THEME_VIEW_BG.to_string(),
            panel: DEFAULT_THEME_PANEL.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub max_history: i64,
    pub mezmer_pairing_enabled: bool,
    pub mezmer_forward_folder_id: Option<i64>,
    pub theme: ThemeSettings,
    pub picker_hotkey: String,
    pub windows_clipboard_history_backup: Option<u32>,
    pub windows_disabled_hotkeys_backup: Option<String>,
    pub keep_picker_open_on_copy: bool,
    pub autostart_enabled: bool,
    pub carousel_mode: bool,
    pub last_clip_filter: String,
    pub open_on_cursor_monitor: bool,
    pub hide_previews_from_capture: bool,
    pub list_image_preview_height: i64,
    pub picker_nav_prev_key: String,
    pub picker_nav_next_key: String,
    pub picker_copy_key: String,
    pub picker_close_key: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            max_history: DEFAULT_MAX_HISTORY,
            mezmer_pairing_enabled: false,
            mezmer_forward_folder_id: None,
            theme: ThemeSettings::default(),
            picker_hotkey: DEFAULT_PICKER_HOTKEY.to_string(),
            windows_clipboard_history_backup: None,
            windows_disabled_hotkeys_backup: None,
            keep_picker_open_on_copy: false,
            autostart_enabled: false,
            carousel_mode: true,
            last_clip_filter: "text".to_string(),
            open_on_cursor_monitor: true,
            hide_previews_from_capture: false,
            list_image_preview_height: DEFAULT_LIST_IMAGE_PREVIEW_HEIGHT,
            picker_nav_prev_key: DEFAULT_NAV_PREV_KEY.to_string(),
            picker_nav_next_key: DEFAULT_NAV_NEXT_KEY.to_string(),
            picker_copy_key: DEFAULT_COPY_KEY.to_string(),
            picker_close_key: DEFAULT_CLOSE_KEY.to_string(),
        }
    }
}

fn clamp_list_image_preview_height(value: i64) -> i64 {
    value.clamp(
        MIN_LIST_IMAGE_PREVIEW_HEIGHT,
        MAX_LIST_IMAGE_PREVIEW_HEIGHT,
    )
}

fn normalize_nav_key(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return fallback.to_string();
    }
    let valid = trimmed.starts_with("Arrow")
        || trimmed.starts_with("Key")
        || trimmed.starts_with("Digit")
        || trimmed.starts_with("Page")
        || trimmed.starts_with("Numpad")
        || trimmed == "Home"
        || trimmed == "End"
        || trimmed == "Enter"
        || trimmed == "Escape"
        || trimmed == "Space"
        || trimmed == "Tab"
        || trimmed == "Backspace"
        || trimmed == "Delete";
    if valid {
        trimmed.to_string()
    } else {
        fallback.to_string()
    }
}

fn normalize_clip_filter(value: Option<String>) -> String {
    match value.as_deref() {
        Some("pinned") | Some("text") | Some("image") | Some("color") => {
            value.unwrap()
        }
        _ => "text".to_string(),
    }
}

pub fn ensure_defaults(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| e.to_string())?;

    let defaults = AppSettings::default();
    if get_raw(conn, "max_history")?.is_none() {
        set_raw(conn, "max_history", &defaults.max_history.to_string())?;
    }
    if get_raw(conn, "mezmer_pairing_enabled")?.is_none() {
        set_raw(conn, "mezmer_pairing_enabled", "false")?;
    }
    if get_raw(conn, "carousel_mode")?.is_none() {
        set_raw(conn, "carousel_mode", "true")?;
    }
    Ok(())
}

fn get_raw(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

fn set_raw(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn normalize_hex(value: &str, fallback: &str) -> String {
    let trimmed = value.trim().trim_start_matches('#');
    if trimmed.len() == 6 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return format!("#{}", trimmed.to_ascii_lowercase());
    }
    fallback.to_string()
}

fn get_theme(conn: &Connection) -> Result<ThemeSettings, String> {
    let defaults = ThemeSettings::default();
    Ok(ThemeSettings {
        accent: get_raw(conn, "theme_accent")?
            .map(|v| normalize_hex(&v, &defaults.accent))
            .unwrap_or(defaults.accent),
        border: get_raw(conn, "theme_border")?
            .map(|v| normalize_hex(&v, &defaults.border))
            .unwrap_or(defaults.border),
        view_bg: get_raw(conn, "theme_view_bg")?
            .map(|v| normalize_hex(&v, &defaults.view_bg))
            .unwrap_or(defaults.view_bg),
        panel: get_raw(conn, "theme_panel")?
            .map(|v| normalize_hex(&v, &defaults.panel))
            .unwrap_or(defaults.panel),
    })
}

pub fn get_settings(conn: &Connection) -> Result<AppSettings, String> {
    let max_history = get_raw(conn, "max_history")?
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_MAX_HISTORY);
    let mezmer_pairing_enabled = get_raw(conn, "mezmer_pairing_enabled")?
        .map(|v| v == "true")
        .unwrap_or(false);
    let mezmer_forward_folder_id = get_raw(conn, "mezmer_forward_folder_id")?
        .and_then(|v| v.parse().ok());
    let theme = get_theme(conn)?;
    let picker_hotkey = get_raw(conn, "picker_hotkey")?
        .unwrap_or_else(|| DEFAULT_PICKER_HOTKEY.to_string());
    let windows_clipboard_history_backup = get_raw(conn, "win_clipboard_hist_backup")?
        .and_then(|v| v.parse().ok());
    let windows_disabled_hotkeys_backup = get_raw(conn, "win_disabled_hotkeys_backup")?;
    let keep_picker_open_on_copy = get_raw(conn, "keep_picker_open_on_copy")?
        .map(|v| v == "true")
        .unwrap_or(false);
    let autostart_enabled = get_raw(conn, "autostart_enabled")?
        .map(|v| v == "true")
        .unwrap_or(false);
    let carousel_mode = get_raw(conn, "carousel_mode")?
        .map(|v| v == "true")
        .unwrap_or(true);
    let last_clip_filter = normalize_clip_filter(get_raw(conn, "last_clip_filter")?);
    let open_on_cursor_monitor = get_raw(conn, "open_on_cursor_monitor")?
        .map(|v| v == "true")
        .unwrap_or(true);
    let hide_previews_from_capture = get_raw(conn, "hide_previews_from_capture")?
        .map(|v| v == "true")
        .unwrap_or(false);
    let list_image_preview_height = get_raw(conn, "list_image_preview_height")?
        .and_then(|v| v.parse().ok())
        .map(clamp_list_image_preview_height)
        .unwrap_or(DEFAULT_LIST_IMAGE_PREVIEW_HEIGHT);
    let picker_nav_prev_key = get_raw(conn, "picker_nav_prev_key")?
        .map(|v| normalize_nav_key(&v, DEFAULT_NAV_PREV_KEY))
        .unwrap_or_else(|| DEFAULT_NAV_PREV_KEY.to_string());
    let picker_nav_next_key = get_raw(conn, "picker_nav_next_key")?
        .map(|v| normalize_nav_key(&v, DEFAULT_NAV_NEXT_KEY))
        .unwrap_or_else(|| DEFAULT_NAV_NEXT_KEY.to_string());
    let picker_copy_key = get_raw(conn, "picker_copy_key")?
        .map(|v| normalize_nav_key(&v, DEFAULT_COPY_KEY))
        .unwrap_or_else(|| DEFAULT_COPY_KEY.to_string());
    let picker_close_key = get_raw(conn, "picker_close_key")?
        .map(|v| normalize_nav_key(&v, DEFAULT_CLOSE_KEY))
        .unwrap_or_else(|| DEFAULT_CLOSE_KEY.to_string());
    Ok(AppSettings {
        max_history,
        mezmer_pairing_enabled,
        mezmer_forward_folder_id,
        theme,
        picker_hotkey,
        windows_clipboard_history_backup,
        windows_disabled_hotkeys_backup,
        keep_picker_open_on_copy,
        autostart_enabled,
        carousel_mode,
        last_clip_filter,
        open_on_cursor_monitor,
        hide_previews_from_capture,
        list_image_preview_height,
        picker_nav_prev_key,
        picker_nav_next_key,
        picker_copy_key,
        picker_close_key,
    })
}

pub fn set_settings(conn: &Connection, settings: &AppSettings) -> Result<(), String> {
    let defaults = ThemeSettings::default();
    let theme = ThemeSettings {
        accent: normalize_hex(&settings.theme.accent, &defaults.accent),
        border: normalize_hex(&settings.theme.border, &defaults.border),
        view_bg: normalize_hex(&settings.theme.view_bg, &defaults.view_bg),
        panel: normalize_hex(&settings.theme.panel, &defaults.panel),
    };

    set_raw(conn, "max_history", &settings.max_history.max(1).to_string())?;
    set_raw(
        conn,
        "mezmer_pairing_enabled",
        if settings.mezmer_pairing_enabled {
            "true"
        } else {
            "false"
        },
    )?;
    match settings.mezmer_forward_folder_id {
        Some(id) => set_raw(conn, "mezmer_forward_folder_id", &id.to_string())?,
        None => {
            let _ = conn.execute(
                "DELETE FROM settings WHERE key = 'mezmer_forward_folder_id'",
                [],
            );
        }
    }
    set_raw(conn, "theme_accent", &theme.accent)?;
    set_raw(conn, "theme_border", &theme.border)?;
    set_raw(conn, "theme_view_bg", &theme.view_bg)?;
    set_raw(conn, "theme_panel", &theme.panel)?;
    set_raw(conn, "picker_hotkey", &settings.picker_hotkey)?;
    match settings.windows_clipboard_history_backup {
        Some(v) => set_raw(conn, "win_clipboard_hist_backup", &v.to_string())?,
        None => {
            let _ = conn.execute(
                "DELETE FROM settings WHERE key = 'win_clipboard_hist_backup'",
                [],
            );
        }
    }
    match &settings.windows_disabled_hotkeys_backup {
        Some(v) => set_raw(conn, "win_disabled_hotkeys_backup", v)?,
        None => {
            let _ = conn.execute(
                "DELETE FROM settings WHERE key = 'win_disabled_hotkeys_backup'",
                [],
            );
        }
    }
    set_raw(
        conn,
        "keep_picker_open_on_copy",
        if settings.keep_picker_open_on_copy {
            "true"
        } else {
            "false"
        },
    )?;
    set_raw(
        conn,
        "autostart_enabled",
        if settings.autostart_enabled {
            "true"
        } else {
            "false"
        },
    )?;
    set_raw(
        conn,
        "carousel_mode",
        if settings.carousel_mode {
            "true"
        } else {
            "false"
        },
    )?;
    set_raw(
        conn,
        "last_clip_filter",
        &normalize_clip_filter(Some(settings.last_clip_filter.clone())),
    )?;
    set_raw(
        conn,
        "open_on_cursor_monitor",
        if settings.open_on_cursor_monitor {
            "true"
        } else {
            "false"
        },
    )?;
    set_raw(
        conn,
        "hide_previews_from_capture",
        if settings.hide_previews_from_capture {
            "true"
        } else {
            "false"
        },
    )?;
    set_raw(
        conn,
        "list_image_preview_height",
        &clamp_list_image_preview_height(settings.list_image_preview_height).to_string(),
    )?;
    let mut picker_nav_prev_key =
        normalize_nav_key(&settings.picker_nav_prev_key, DEFAULT_NAV_PREV_KEY);
    let mut picker_nav_next_key =
        normalize_nav_key(&settings.picker_nav_next_key, DEFAULT_NAV_NEXT_KEY);
    if picker_nav_prev_key == picker_nav_next_key {
        picker_nav_next_key = DEFAULT_NAV_NEXT_KEY.to_string();
        if picker_nav_prev_key == picker_nav_next_key {
            picker_nav_prev_key = DEFAULT_NAV_PREV_KEY.to_string();
        }
    }
    set_raw(conn, "picker_nav_prev_key", &picker_nav_prev_key)?;
    set_raw(conn, "picker_nav_next_key", &picker_nav_next_key)?;
    let mut picker_copy_key = normalize_nav_key(&settings.picker_copy_key, DEFAULT_COPY_KEY);
    let mut picker_close_key = normalize_nav_key(&settings.picker_close_key, DEFAULT_CLOSE_KEY);
    if picker_copy_key == picker_close_key {
        picker_close_key = DEFAULT_CLOSE_KEY.to_string();
        if picker_copy_key == picker_close_key {
            picker_copy_key = DEFAULT_COPY_KEY.to_string();
        }
    }
    set_raw(conn, "picker_copy_key", &picker_copy_key)?;
    set_raw(conn, "picker_close_key", &picker_close_key)?;
    Ok(())
}

#[derive(Debug, Clone, Copy)]
pub struct PickerPosition {
    pub x: i32,
    pub y: i32,
}

pub fn get_picker_position(conn: &Connection) -> Result<Option<PickerPosition>, String> {
    let x = get_raw(conn, "picker_pos_x")?
        .and_then(|v| v.parse().ok());
    let y = get_raw(conn, "picker_pos_y")?
        .and_then(|v| v.parse().ok());
    match (x, y) {
        (Some(x), Some(y)) => Ok(Some(PickerPosition { x, y })),
        _ => Ok(None),
    }
}

const PICKER_POSITIONS_BY_MONITOR_KEY: &str = "picker_positions_by_monitor";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PickerPositionEntry {
    x: i32,
    y: i32,
}

fn load_picker_positions_by_monitor(
    conn: &Connection,
) -> Result<HashMap<String, PickerPositionEntry>, String> {
    match get_raw(conn, PICKER_POSITIONS_BY_MONITOR_KEY)? {
        Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        None => Ok(HashMap::new()),
    }
}

fn save_picker_positions_by_monitor(
    conn: &Connection,
    map: &HashMap<String, PickerPositionEntry>,
) -> Result<(), String> {
    let json = serde_json::to_string(map).map_err(|e| e.to_string())?;
    set_raw(conn, PICKER_POSITIONS_BY_MONITOR_KEY, &json)
}

pub fn get_picker_position_for_monitor(
    conn: &Connection,
    monitor_key: &str,
) -> Result<Option<PickerPosition>, String> {
    let map = load_picker_positions_by_monitor(conn)?;
    if let Some(entry) = map.get(monitor_key) {
        return Ok(Some(PickerPosition {
            x: entry.x,
            y: entry.y,
        }));
    }

    // One-time fallback for installs that only have the legacy global position.
    if map.is_empty() {
        return get_picker_position(conn);
    }

    Ok(None)
}

pub fn set_picker_position_for_monitor(
    conn: &Connection,
    monitor_key: &str,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let mut map = load_picker_positions_by_monitor(conn)?;
    map.insert(
        monitor_key.to_string(),
        PickerPositionEntry { x, y },
    );
    save_picker_positions_by_monitor(conn, &map)?;
    Ok(())
}

#[derive(Debug, Clone, Copy)]
pub struct PickerSize {
    pub width: f64,
    pub height: f64,
}

pub fn get_picker_size(conn: &Connection, carousel: bool) -> Result<Option<PickerSize>, String> {
    let (width_key, height_key) = if carousel {
        ("picker_carousel_width", "picker_carousel_height")
    } else {
        ("picker_list_width", "picker_list_height")
    };

    let width = get_raw(conn, width_key)?.and_then(|v| v.parse().ok());
    let height = get_raw(conn, height_key)?.and_then(|v| v.parse().ok());

    if let (Some(width), Some(height)) = (width, height) {
        return Ok(Some(PickerSize { width, height }));
    }

    // One-time fallback for installs that only have the legacy global picker size.
    if !carousel {
        let width = get_raw(conn, "picker_width")?.and_then(|v| v.parse().ok());
        let height = get_raw(conn, "picker_height")?.and_then(|v| v.parse().ok());
        if let (Some(width), Some(height)) = (width, height) {
            return Ok(Some(PickerSize { width, height }));
        }
    }

    Ok(None)
}

pub fn set_picker_size(
    conn: &Connection,
    carousel: bool,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let (width_key, height_key) = if carousel {
        ("picker_carousel_width", "picker_carousel_height")
    } else {
        ("picker_list_width", "picker_list_height")
    };
    set_raw(conn, width_key, &width.to_string())?;
    set_raw(conn, height_key, &height.to_string())?;
    Ok(())
}

pub fn set_settings_window_size(conn: &Connection, width: f64, height: f64) -> Result<(), String> {
    set_raw(conn, "settings_window_width", &width.to_string())?;
    set_raw(conn, "settings_window_height", &height.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Copy)]
pub struct SettingsWindowPosition {
    pub x: i32,
    pub y: i32,
}

pub fn get_settings_window_position(conn: &Connection) -> Result<Option<SettingsWindowPosition>, String> {
    let x = get_raw(conn, "settings_window_x")?
        .and_then(|v| v.parse().ok());
    let y = get_raw(conn, "settings_window_y")?
        .and_then(|v| v.parse().ok());
    match (x, y) {
        (Some(x), Some(y)) => Ok(Some(SettingsWindowPosition { x, y })),
        _ => Ok(None),
    }
}

pub fn set_settings_window_position(conn: &Connection, x: i32, y: i32) -> Result<(), String> {
    set_raw(conn, "settings_window_x", &x.to_string())?;
    set_raw(conn, "settings_window_y", &y.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Copy)]
pub struct SettingsWindowSize {
    pub width: f64,
    pub height: f64,
}

pub fn get_settings_window_size(conn: &Connection) -> Result<Option<SettingsWindowSize>, String> {
    let width = get_raw(conn, "settings_window_width")?
        .and_then(|v| v.parse().ok());
    let height = get_raw(conn, "settings_window_height")?
        .and_then(|v| v.parse().ok());
    match (width, height) {
        (Some(width), Some(height)) => Ok(Some(SettingsWindowSize { width, height })),
        _ => Ok(None),
    }
}

