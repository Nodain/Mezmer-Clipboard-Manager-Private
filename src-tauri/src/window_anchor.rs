use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, LogicalSize, Manager, Monitor, PhysicalPosition, Position, WebviewWindow};

use crate::settings;
use crate::AppState;

/// Margin from the monitor work-area edge (logical px, DPI-aware).
const MARGIN_X: f64 = 14.0;
const MARGIN_Y: f64 = 10.0;

/// Fraction of work-area used for the list picker (clamped).
const WIDTH_FRAC: f64 = 0.205;
const HEIGHT_FRAC: f64 = 0.40;
const MIN_WIDTH: f64 = 320.0;
const MAX_WIDTH: f64 = 440.0;
const MIN_HEIGHT: f64 = 280.0;
const MAX_HEIGHT: f64 = 580.0;

const CAROUSEL_DEFAULT_WIDTH: f64 = 720.0;
const CAROUSEL_DEFAULT_HEIGHT: f64 = 280.0;
const CAROUSEL_MIN_WIDTH: f64 = 420.0;
const CAROUSEL_MIN_HEIGHT: f64 = 200.0;

const SETTINGS_DEFAULT_WIDTH: f64 = 360.0;
const SETTINGS_MIN_WIDTH: f64 = 300.0;
const SETTINGS_MAX_WIDTH: f64 = 520.0;
const SETTINGS_MIN_HEIGHT: f64 = 320.0;
const SETTINGS_DEFAULT_HEIGHT: f64 = 480.0;
const SETTINGS_GAP: i32 = 10;

static SKIP_MOVE_SAVE: AtomicBool = AtomicBool::new(false);
static SKIP_SETTINGS_MOVE_SAVE: AtomicBool = AtomicBool::new(false);

pub fn consume_skip_move_save() -> bool {
    SKIP_MOVE_SAVE.swap(false, Ordering::SeqCst)
}

pub fn consume_skip_settings_move_save() -> bool {
    SKIP_SETTINGS_MOVE_SAVE.swap(false, Ordering::SeqCst)
}

fn picker_carousel_mode(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    let Ok(conn) = state.conn.lock() else {
        return false;
    };
    settings::get_settings(&conn)
        .map(|s| s.carousel_mode)
        .unwrap_or(false)
}

fn open_on_cursor_monitor(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    let Ok(conn) = state.conn.lock() else {
        return true;
    };
    settings::get_settings(&conn)
        .map(|s| s.open_on_cursor_monitor)
        .unwrap_or(true)
}

fn set_position_programmatic(
    window: &WebviewWindow,
    position: Position,
) -> Result<(), String> {
    SKIP_MOVE_SAVE.store(true, Ordering::SeqCst);
    window.set_position(position).map_err(|e| e.to_string())
}

fn set_settings_position_programmatic(
    window: &WebviewWindow,
    position: Position,
) -> Result<(), String> {
    SKIP_SETTINGS_MOVE_SAVE.store(true, Ordering::SeqCst);
    window.set_position(position).map_err(|e| e.to_string())
}

pub fn default_picker_dimensions(
    window: &WebviewWindow,
    carousel: bool,
    prefer_cursor: bool,
) -> Result<(f64, f64), String> {
    if carousel {
        return Ok((CAROUSEL_DEFAULT_WIDTH, CAROUSEL_DEFAULT_HEIGHT));
    }

    let monitor = pick_monitor(window, prefer_cursor).ok_or("no display found")?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();

    let work_w_logical = work.size.width as f64 / scale;
    let work_h_logical = work.size.height as f64 / scale;

    let width = (work_w_logical * WIDTH_FRAC).clamp(MIN_WIDTH, MAX_WIDTH);
    let height = (work_h_logical * HEIGHT_FRAC).clamp(MIN_HEIGHT, MAX_HEIGHT);

    Ok((width, height))
}

fn work_area_logical(window: &WebviewWindow, prefer_cursor: bool) -> Result<(f64, f64), String> {
    let monitor = pick_monitor(window, prefer_cursor).ok_or("no display found")?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    Ok((
        work.size.width as f64 / scale,
        work.size.height as f64 / scale,
    ))
}

/// Largest picker size that still fits the current monitor work area (logical px).
fn picker_max_dimensions(window: &WebviewWindow, prefer_cursor: bool) -> Result<(f64, f64), String> {
    let (work_w, work_h) = work_area_logical(window, prefer_cursor)?;
    let max_w = (work_w - 2.0 * MARGIN_X).max(MIN_WIDTH);
    let max_h = (work_h - 2.0 * MARGIN_Y).max(MIN_HEIGHT);
    Ok((max_w, max_h))
}

fn picker_resize_bounds(
    window: &WebviewWindow,
    carousel: bool,
    prefer_cursor: bool,
) -> Result<((f64, f64), (f64, f64)), String> {
    let (max_w, max_h) = picker_max_dimensions(window, prefer_cursor)?;
    if carousel {
        Ok((
            (CAROUSEL_MIN_WIDTH, CAROUSEL_MIN_HEIGHT),
            (max_w, max_h),
        ))
    } else {
        let (_, default_h) = default_picker_dimensions(window, false, prefer_cursor)?;
        let min_h = (default_h * 0.5).max(200.0);
        Ok(((MIN_WIDTH, min_h), (max_w, max_h)))
    }
}

pub fn configure_picker_resize_limits(
    window: &WebviewWindow,
    app: &AppHandle,
) -> Result<(), String> {
    let carousel = picker_carousel_mode(app);
    let prefer_cursor = open_on_cursor_monitor(app);
    let ((min_w, min_h), (max_w, max_h)) = picker_resize_bounds(window, carousel, prefer_cursor)?;

    window
        .set_min_size(Some(LogicalSize::new(min_w, min_h)))
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Some(LogicalSize::new(max_w, max_h)))
        .map_err(|e| e.to_string())
}

pub fn restore_picker_size(window: &WebviewWindow, app: &AppHandle) -> Result<(), String> {
    let carousel = picker_carousel_mode(app);
    let prefer_cursor = open_on_cursor_monitor(app);
    configure_picker_resize_limits(window, app)?;
    let ((min_w, min_h), (max_w, max_h)) = picker_resize_bounds(window, carousel, prefer_cursor)?;

    let saved = {
        let state = app.state::<AppState>();
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        settings::get_picker_size(&conn, carousel)?
    };

    if carousel {
        let width = saved
            .map(|s| s.width)
            .unwrap_or(CAROUSEL_DEFAULT_WIDTH)
            .clamp(min_w, max_w);
        let height = saved
            .map(|s| s.height)
            .unwrap_or(CAROUSEL_DEFAULT_HEIGHT)
            .clamp(min_h, max_h);

        window
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    let (default_w, default_h) = default_picker_dimensions(window, false, prefer_cursor)?;
    let width = saved
        .map(|s| s.width)
        .unwrap_or(default_w)
        .clamp(min_w, max_w);
    let height = saved
        .map(|s| s.height)
        .unwrap_or(default_h)
        .clamp(min_h, max_h);

    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

pub fn persist_picker_size(app: &AppHandle, width: f64, height: f64) -> Result<(), String> {
    let carousel = picker_carousel_mode(app);
    let state = app.state::<AppState>();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    settings::set_picker_size(&conn, carousel, width, height)
}

pub fn anchor_picker_bottom_right(
    window: &WebviewWindow,
    prefer_cursor: bool,
) -> Result<(), String> {
    let monitor = pick_monitor(window, prefer_cursor).ok_or("no display found")?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();

    let outer = window.outer_size().map_err(|e| e.to_string())?;
    let margin_x = (MARGIN_X * scale).round() as i32;
    let margin_y = (MARGIN_Y * scale).round() as i32;

    let x = work.position.x + work.size.width as i32 - outer.width as i32 - margin_x;
    let y = work.position.y + work.size.height as i32 - outer.height as i32 - margin_y;

    set_position_programmatic(
        window,
        Position::Physical(PhysicalPosition::new(x, y)),
    )
}

pub fn anchor_picker_bottom_center(
    window: &WebviewWindow,
    prefer_cursor: bool,
) -> Result<(), String> {
    let monitor = pick_monitor(window, prefer_cursor).ok_or("no display found")?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();

    let outer = window.outer_size().map_err(|e| e.to_string())?;
    let margin_y = (MARGIN_Y * scale).round() as i32;

    let x = work.position.x + (work.size.width as i32 - outer.width as i32) / 2;
    let y = work.position.y + work.size.height as i32 - outer.height as i32 - margin_y;

    set_position_programmatic(
        window,
        Position::Physical(PhysicalPosition::new(x, y)),
    )
}

pub fn place_picker_window(window: &WebviewWindow, app: &AppHandle) -> Result<(), String> {
    let carousel = picker_carousel_mode(app);
    let prefer_cursor = open_on_cursor_monitor(app);
    restore_picker_size(window, app)?;

    let monitor = pick_monitor(window, prefer_cursor).ok_or("no display found")?;
    let key = monitor_key(&monitor);

    let saved = {
        let state = app.state::<AppState>();
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        settings::get_picker_position_for_monitor(&conn, &key)?
    };

    if let Some(pos) = saved {
        let size = window.outer_size().map_err(|e| e.to_string())?;
        if position_fits_monitor(
            &monitor,
            pos.x,
            pos.y,
            size.width as i32,
            size.height as i32,
        ) {
            set_position_programmatic(
                window,
                Position::Physical(PhysicalPosition::new(pos.x, pos.y)),
            )?;
            let _ = ensure_settings_accessible(app);
            return Ok(());
        }
    }

    if carousel {
        anchor_picker_bottom_center(window, prefer_cursor)?;
    } else {
        anchor_picker_bottom_right(window, prefer_cursor)?;
    }
    let _ = ensure_settings_accessible(app);
    Ok(())
}

pub fn persist_picker_position(
    app: &AppHandle,
    window: &WebviewWindow,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let monitor = monitor_for_window(window, x, y).ok_or("no display found")?;
    let key = monitor_key(&monitor);
    let state = app.state::<AppState>();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    settings::set_picker_position_for_monitor(&conn, &key, x, y)
}

pub fn configure_settings_resize_limits(window: &WebviewWindow) -> Result<(), String> {
    let monitor = pick_monitor(window, false).ok_or("no display found")?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let max_w = (work.size.width as f64 / scale - 2.0 * MARGIN_X)
        .clamp(SETTINGS_MIN_WIDTH, SETTINGS_MAX_WIDTH);
    let max_h = (work.size.height as f64 / scale - 2.0 * MARGIN_Y).max(SETTINGS_MIN_HEIGHT);

    window
        .set_min_size(Some(LogicalSize::new(
            SETTINGS_MIN_WIDTH,
            SETTINGS_MIN_HEIGHT,
        )))
        .map_err(|e| e.to_string())?;
    window
        .set_max_size(Some(LogicalSize::new(max_w, max_h)))
        .map_err(|e| e.to_string())
}

pub fn restore_settings_size(
    settings: &WebviewWindow,
    picker: &WebviewWindow,
) -> Result<(), String> {
    configure_settings_resize_limits(settings)?;

    let picker_scale = picker.scale_factor().map_err(|e| e.to_string())?;
    let picker_h = picker.outer_size().map_err(|e| e.to_string())?.height as f64 / picker_scale;

    let saved = {
        let state = picker.app_handle().state::<AppState>();
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        settings::get_settings_window_size(&conn)?
    };

    let monitor = pick_monitor(settings, false).ok_or("no display found")?;
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let max_w = (work.size.width as f64 / scale - 2.0 * MARGIN_X)
        .clamp(SETTINGS_MIN_WIDTH, SETTINGS_MAX_WIDTH);
    let max_h = (work.size.height as f64 / scale - 2.0 * MARGIN_Y).max(SETTINGS_MIN_HEIGHT);

    let width = saved
        .map(|s| s.width)
        .unwrap_or(SETTINGS_DEFAULT_WIDTH)
        .clamp(SETTINGS_MIN_WIDTH, max_w);
    let height = saved
        .map(|s| s.height)
        .unwrap_or(picker_h.max(SETTINGS_DEFAULT_HEIGHT))
        .clamp(SETTINGS_MIN_HEIGHT, max_h);

    settings
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

pub fn persist_settings_size(app: &AppHandle, width: f64, height: f64) -> Result<(), String> {
    let state = app.state::<AppState>();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    settings::set_settings_window_size(&conn, width, height)
}

pub fn persist_settings_position(app: &AppHandle, x: i32, y: i32) -> Result<(), String> {
    let state = app.state::<AppState>();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    settings::set_settings_window_position(&conn, x, y)
}

fn is_settings_position_visible(window: &WebviewWindow, x: i32, y: i32) -> bool {
    let Ok(size) = window.outer_size() else {
        return false;
    };
    let w = size.width as i32;
    let h = size.height as i32;
    let cx = x + w / 2;
    let cy = y + h / 2;

    let Ok(monitors) = window.available_monitors() else {
        return false;
    };

    for monitor in monitors {
        if point_in_work_area(&monitor, cx, cy) {
            return true;
        }
    }
    false
}

fn anchor_settings_beside_picker(
    picker: &WebviewWindow,
    settings: &WebviewWindow,
) -> Result<(), String> {
    let picker_pos = picker.outer_position().map_err(|e| e.to_string())?;
    let picker_size = picker.outer_size().map_err(|e| e.to_string())?;
    let settings_size = settings.outer_size().map_err(|e| e.to_string())?;
    let monitor = pick_monitor(picker, false).ok_or("no display found")?;
    let work = monitor.work_area();

    let mut x = picker_pos.x - settings_size.width as i32 - SETTINGS_GAP;
    let y = picker_pos.y;

    let work_left = work.position.x;
    let work_right = work_left + work.size.width as i32;
    if x < work_left {
        x = picker_pos.x + picker_size.width as i32 + SETTINGS_GAP;
        if x + settings_size.width as i32 > work_right {
            x = work_left.max(work_right - settings_size.width as i32);
        }
    }

    set_settings_position_programmatic(
        settings,
        Position::Physical(PhysicalPosition::new(x, y)),
    )
}

pub fn place_settings_window(app: &AppHandle, restore_size: bool) -> Result<(), String> {
    let picker = app
        .get_webview_window("picker")
        .ok_or("picker window not found")?;
    let settings = app
        .get_webview_window("settings")
        .ok_or("settings window not found")?;

    if restore_size {
        restore_settings_size(&settings, &picker)?;
    }

    let saved = {
        let state = app.state::<AppState>();
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        settings::get_settings_window_position(&conn)?
    };

    if let Some(pos) = saved {
        if is_settings_position_visible(&settings, pos.x, pos.y) {
            set_settings_position_programmatic(
                &settings,
                Position::Physical(PhysicalPosition::new(pos.x, pos.y)),
            )?;
            let _ = ensure_settings_accessible(app);
            return Ok(());
        }
    }

    anchor_settings_beside_picker(&picker, &settings)?;
    let _ = ensure_settings_accessible(app);
    Ok(())
}

fn rects_overlap(ax: i32, ay: i32, aw: i32, ah: i32, bx: i32, by: i32, bw: i32, bh: i32) -> bool {
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

fn settings_overlaps_picker(
    settings: &WebviewWindow,
    picker: &WebviewWindow,
) -> Result<bool, String> {
    let sp = settings.outer_position().map_err(|e| e.to_string())?;
    let ss = settings.outer_size().map_err(|e| e.to_string())?;
    let pp = picker.outer_position().map_err(|e| e.to_string())?;
    let ps = picker.outer_size().map_err(|e| e.to_string())?;
    Ok(rects_overlap(
        sp.x,
        sp.y,
        ss.width as i32,
        ss.height as i32,
        pp.x,
        pp.y,
        ps.width as i32,
        ps.height as i32,
    ))
}

fn clamp_settings_position(
    monitor: &Monitor,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> (i32, i32) {
    let work = monitor.work_area();
    let work_left = work.position.x;
    let work_top = work.position.y;
    let work_right = work_left + work.size.width as i32;
    let work_bottom = work_top + work.size.height as i32;

    let x = x.max(work_left).min((work_right - width).max(work_left));
    let y = y.max(work_top).min((work_bottom - height).max(work_top));
    (x, y)
}

fn nudge_settings_clear_of_picker(
    app: &AppHandle,
    settings: &WebviewWindow,
    picker: &WebviewWindow,
) -> Result<(), String> {
    let sp = settings.outer_position().map_err(|e| e.to_string())?;
    let ss = settings.outer_size().map_err(|e| e.to_string())?;
    let pp = picker.outer_position().map_err(|e| e.to_string())?;
    let ps = picker.outer_size().map_err(|e| e.to_string())?;

    let monitor = monitor_for_window(picker, pp.x, pp.y).ok_or("no display found")?;
    let sw = ss.width as i32;
    let sh = ss.height as i32;

    let candidates = [
        (sp.x, pp.y - sh - SETTINGS_GAP),
        (pp.x - sw - SETTINGS_GAP, pp.y),
        (pp.x + ps.width as i32 + SETTINGS_GAP, pp.y),
        (
            pp.x + (ps.width as i32 - sw) / 2,
            pp.y - sh - SETTINGS_GAP,
        ),
    ];

    for (raw_x, raw_y) in candidates {
        let (x, y) = clamp_settings_position(&monitor, raw_x, raw_y, sw, sh);
        if !rects_overlap(x, y, sw, sh, pp.x, pp.y, ps.width as i32, ps.height as i32) {
            set_settings_position_programmatic(
                settings,
                Position::Physical(PhysicalPosition::new(x, y)),
            )?;
            return persist_settings_position(app, x, y);
        }
    }

    let work = monitor.work_area();
    let x = work.position.x + (work.size.width as i32 - sw) / 2;
    let y = work.position.y + (work.size.height as i32 - sh) / 2;
    let (x, y) = clamp_settings_position(&monitor, x, y, sw, sh);
    set_settings_position_programmatic(
        settings,
        Position::Physical(PhysicalPosition::new(x, y)),
    )?;
    persist_settings_position(app, x, y)
}

/// Keeps the settings window above the picker and out from under it so the header stays draggable.
pub fn ensure_settings_accessible(app: &AppHandle) -> Result<(), String> {
    let Some(settings) = app.get_webview_window("settings") else {
        return Ok(());
    };
    if !settings.is_visible().unwrap_or(false) {
        return Ok(());
    }

    if let Some(picker) = app.get_webview_window("picker") {
        if picker.is_visible().unwrap_or(false) && settings_overlaps_picker(&settings, &picker)? {
            nudge_settings_clear_of_picker(app, &settings, &picker)?;
        }
    }

    let _ = settings.set_focus();
    Ok(())
}

pub fn restore_picker_cursor_events(app: &AppHandle) {
    if let Some(picker) = app.get_webview_window("picker") {
        let _ = picker.set_ignore_cursor_events(false);
    }
}

fn point_in_work_area(monitor: &Monitor, x: i32, y: i32) -> bool {
    let work = monitor.work_area();
    let left = work.position.x;
    let top = work.position.y;
    let right = left + work.size.width as i32;
    let bottom = top + work.size.height as i32;
    x >= left && x < right && y >= top && y < bottom
}

fn position_fits_monitor(monitor: &Monitor, x: i32, y: i32, w: i32, h: i32) -> bool {
    let cx = x + w / 2;
    let cy = y + h / 2;
    point_in_work_area(monitor, cx, cy)
}

fn monitor_key(monitor: &Monitor) -> String {
    if let Some(name) = monitor.name() {
        if !name.is_empty() {
            return name.clone();
        }
    }
    let work = monitor.work_area();
    format!(
        "pos{}x{}_size{}x{}_scale{}",
        work.position.x,
        work.position.y,
        work.size.width,
        work.size.height,
        monitor.scale_factor()
    )
}

fn monitor_for_window(window: &WebviewWindow, x: i32, y: i32) -> Option<Monitor> {
    let size = window.outer_size().ok()?;
    let cx = x + size.width as i32 / 2;
    let cy = y + size.height as i32 / 2;
    window
        .monitor_from_point(cx as f64, cy as f64)
        .ok()
        .flatten()
        .or_else(|| window.current_monitor().ok().flatten())
}

fn pick_monitor(window: &WebviewWindow, prefer_cursor: bool) -> Option<Monitor> {
    if prefer_cursor {
        if let Ok(pos) = window.cursor_position() {
            if let Ok(Some(m)) = window.monitor_from_point(pos.x, pos.y) {
                return Some(m);
            }
        }
        #[cfg(windows)]
        if let Ok((x, y)) = crate::screen::cursor_position() {
            if let Ok(Some(m)) = window.monitor_from_point(x as f64, y as f64) {
                return Some(m);
            }
        }
        return window.primary_monitor().ok().flatten();
    }

    if let Ok(Some(m)) = window.current_monitor() {
        return Some(m);
    }
    if let Ok(pos) = window.cursor_position() {
        if let Ok(Some(m)) = window.monitor_from_point(pos.x, pos.y) {
            return Some(m);
        }
    }
    window.primary_monitor().ok().flatten()
}
