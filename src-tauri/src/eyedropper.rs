use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow};

use crate::db;
use crate::screen::{self, VK_ESCAPE, VK_LBUTTON};
use crate::{hide_picker_window, hide_settings_window, show_picker_window, AppState};

const LOUPE_RADIUS: i32 = 7;
const HUD_LOGICAL_WIDTH: f64 = 196.0;
const HUD_LOGICAL_HEIGHT: f64 = 236.0;
// Place the HUD down-right of the cursor so it does not cover the sampled pixel.
const HUD_OFFSET_X: f64 = 18.0;
const HUD_OFFSET_Y: f64 = 20.0;

static EYEDROPPER_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn show_eyedropper_window(app: &AppHandle) -> Result<(), String> {
    hide_picker_window(app);
    hide_settings_window(app);

    let window = app
        .get_webview_window("eyedropper")
        .ok_or("eyedropper window not found")?;

    let _ = window.set_fullscreen(false);
    let _ = window.set_ignore_cursor_events(true);
    window
        .set_size(Size::Logical(LogicalSize::new(
            HUD_LOGICAL_WIDTH,
            HUD_LOGICAL_HEIGHT,
        )))
        .map_err(|e| e.to_string())?;

    if let Ok((x, y)) = screen::cursor_position() {
        position_hud(&window, x, y)?;
    }

    window.show().map_err(|e| e.to_string())?;

    if EYEDROPPER_ACTIVE.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let handle = app.clone();
    thread::spawn(move || eyedropper_loop(handle));

    Ok(())
}

pub fn hide_eyedropper_window(app: &AppHandle) -> Result<(), String> {
    EYEDROPPER_ACTIVE.store(false, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("eyedropper") {
        let _ = window.set_fullscreen(false);
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.hide();
    }
    Ok(())
}

pub fn finish_eyedropper(app: &AppHandle, reopen_picker: bool) -> Result<(), String> {
    hide_eyedropper_window(app)?;
    if reopen_picker {
        show_picker_window(app);
    }
    Ok(())
}

fn hud_offset(window: &WebviewWindow) -> Result<(i32, i32), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    Ok((
        (HUD_OFFSET_X * scale).round() as i32,
        (HUD_OFFSET_Y * scale).round() as i32,
    ))
}

fn position_hud(window: &WebviewWindow, cursor_x: i32, cursor_y: i32) -> Result<(), String> {
    let (offset_x, offset_y) = hud_offset(window)?;
    let hud_x = cursor_x + offset_x;
    let hud_y = cursor_y + offset_y;

    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        screen::position_window_hwnd(hwnd.0 as isize, hud_x, hud_y);
        return Ok(());
    }

    window
        .set_position(Position::Physical(PhysicalPosition::new(hud_x, hud_y)))
        .map_err(|e| e.to_string())
}

fn position_hud_hwnd(hwnd: isize, offset: (i32, i32), cursor_x: i32, cursor_y: i32) {
    #[cfg(windows)]
    screen::position_window_hwnd(hwnd, cursor_x + offset.0, cursor_y + offset.1);
    #[cfg(not(windows))]
    let _ = (hwnd, offset, cursor_x, cursor_y);
}

fn eyedropper_loop(app: AppHandle) {
    let window = app.get_webview_window("eyedropper");
    #[cfg(windows)]
    let hwnd = window.as_ref().and_then(|w| w.hwnd().ok()).map(|h| h.0 as isize);
    #[cfg(not(windows))]
    let hwnd: Option<isize> = None;
    let offset = window
        .as_ref()
        .and_then(|w| hud_offset(w).ok())
        .unwrap_or((18, 20));

    if let Some(hwnd) = hwnd {
        let pos_active = &EYEDROPPER_ACTIVE;
        let pos_offset = offset;
        thread::spawn(move || {
            while pos_active.load(Ordering::Relaxed) {
                if let Ok((x, y)) = screen::cursor_position() {
                    position_hud_hwnd(hwnd, pos_offset, x, y);
                }
                thread::yield_now();
            }
        });
    }

    let mut esc_was_down = false;
    let mut lmb_was_down = false;
    let mut last_preview = Instant::now();

    while EYEDROPPER_ACTIVE.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(2));

        let Ok((x, y)) = screen::cursor_position() else {
            continue;
        };

        if hwnd.is_none() {
            if let Some(window) = app.get_webview_window("eyedropper") {
                let _ = position_hud(&window, x, y);
            }
        }

        if last_preview.elapsed() >= Duration::from_millis(16) {
            last_preview = Instant::now();
            if let Ok(preview) = screen::build_eyedropper_preview(x, y, LOUPE_RADIUS) {
                let _ = app.emit("eyedropper-preview", &preview);
            }
        }

        let esc = screen::is_key_down(VK_ESCAPE);
        if esc && !esc_was_down {
            let _ = finish_eyedropper(&app, true);
            break;
        }
        esc_was_down = esc;

        let lmb = screen::is_key_down(VK_LBUTTON);
        if lmb_was_down && !lmb {
            let _ = pick_at_cursor(&app);
            break;
        }
        lmb_was_down = lmb;
    }

    EYEDROPPER_ACTIVE.store(false, Ordering::SeqCst);
}

fn pick_at_cursor(app: &AppHandle) -> Result<(), String> {
    let (x, y) = screen::cursor_position()?;
    let (r, g, b) = screen::sample_pixel(x, y)?;
    let hex = screen::rgb_to_hex(r, g, b);

    let state = app.state::<AppState>();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let saved = db::insert_saved_color(&conn, &hex, r, g, b)?;
    drop(conn);

    finish_eyedropper(app, true)?;
    let _ = app.emit("colors-updated", &saved);
    Ok(())
}
