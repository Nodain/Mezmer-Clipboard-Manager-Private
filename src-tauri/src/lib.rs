use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager};

mod autostart;
mod capture_protection;
mod clipboard;
mod commands;
mod db;
mod eyedropper;
mod hotkey;
mod mezmer;
mod paths;
mod screen;
mod settings;
mod window_anchor;

pub struct AppState {
    pub conn: Mutex<Connection>,
    pub data_dir: PathBuf,
    pub images_dir: PathBuf,
}

impl AppState {
    pub fn new(conn: Connection, data_dir: PathBuf) -> Self {
        let images_dir = data_dir.join("images");
        let _ = std::fs::create_dir_all(&images_dir);
        Self {
            conn: Mutex::new(conn),
            data_dir,
            images_dir,
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(all(desktop, not(debug_assertions)))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_picker_window(app);
        }));
    }

    builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());

    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name(autostart::AUTOSTART_APP_NAME)
                .build(),
        );
    }

    builder
        .setup(|app| {
            let data_dir = paths::ensure_app_data_dir()?;
            let conn = db::open(&data_dir)?;
            settings::ensure_defaults(&conn)?;
            app.manage(AppState::new(conn, data_dir));

            clipboard::start_watcher(app.handle().clone());
            let _ = setup_tray(app).map_err(|e| {
                eprintln!("warning: system tray setup failed: {e}");
            });
            setup_picker_window(app);
            setup_settings_window(app);
            setup_eyedropper_window(app);

            let app_handle = app.handle().clone();
            let mut settings = {
                let state = app.state::<AppState>();
                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                settings::get_settings(&conn)?
            };

            #[cfg(desktop)]
            if let Ok(actual) = autostart::reconcile_autostart(&app_handle, settings.autostart_enabled)
            {
                if actual != settings.autostart_enabled {
                    let state = app.state::<AppState>();
                    let conn = state.conn.lock().map_err(|e| e.to_string())?;
                    settings.autostart_enabled = actual;
                    settings::set_settings(&conn, &settings)?;
                    let _ = app_handle.emit("settings-changed", &settings);
                }
            }

            if let Err(err) = hotkey::apply_hotkey_settings(&app_handle, &settings.picker_hotkey)
            {
                eprintln!("warning: could not register picker hotkey: {err}");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_clips,
            commands::delete_clip,
            commands::clear_clips,
            commands::toggle_pin,
            commands::copy_clip,
            commands::get_clip_image,
            commands::get_settings,
            commands::set_settings,
            commands::hide_picker,
            commands::show_settings,
            commands::hide_settings,
            commands::list_saved_colors,
            commands::delete_saved_color,
            commands::copy_saved_color,
            commands::start_eyedropper,
            commands::cancel_eyedropper,
            commands::pick_screen_color,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };

    let show = MenuItem::with_id(app, "show", "Open clipboard", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &settings, &quit])?;

    let icon = app.default_window_icon().cloned().unwrap();
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Mezmer Clipboard")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_picker_window(app),
            "settings" => show_settings_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_picker_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_picker_window(app: &tauri::App) {
    use tauri::window::Color;
    use tauri::WindowEvent;

    let Some(window) = app.get_webview_window("picker") else {
        return;
    };

    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));

    let app_handle = app.handle().clone();
    let _ = window_anchor::place_picker_window(&window, &app_handle);

    let place_window = window.clone();
    let place_app = app_handle.clone();
    let save_app = app_handle.clone();
    window.on_window_event(move |event| {
        match event {
            WindowEvent::ScaleFactorChanged { .. } => {
                let _ = window_anchor::configure_picker_resize_limits(&place_window, &place_app);
                let _ = window_anchor::place_picker_window(&place_window, &place_app);
            }
            WindowEvent::Moved(position) => {
                if window_anchor::consume_skip_move_save() {
                    return;
                }
                let _ = window_anchor::persist_picker_position(
                    &save_app,
                    &place_window,
                    position.x,
                    position.y,
                );
                let _ = save_app.emit("picker-moved", ());
            }
            WindowEvent::Resized(_) => {
                let _ = save_app.emit("picker-resized", ());
                if let (Ok(size), Ok(scale)) = (place_window.outer_size(), place_window.scale_factor())
                {
                    let w = size.width as f64 / scale;
                    let h = size.height as f64 / scale;
                    let _ = window_anchor::persist_picker_size(&save_app, w, h);
                }
            }
            _ => {}
        }
    });

}

fn setup_settings_window(app: &tauri::App) {
    use tauri::window::Color;
    use tauri::WindowEvent;

    let Some(window) = app.get_webview_window("settings") else {
        return;
    };

    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
    let _ = window_anchor::configure_settings_resize_limits(&window);

    let save_app = app.handle().clone();
    let settings_window = window.clone();
    window.on_window_event(move |event| {
        match event {
            WindowEvent::ScaleFactorChanged { .. } => {
                let _ = window_anchor::configure_settings_resize_limits(&settings_window);
            }
            WindowEvent::Moved(position) => {
                if window_anchor::consume_skip_settings_move_save() {
                    return;
                }
                let _ = window_anchor::persist_settings_position(
                    &save_app,
                    position.x,
                    position.y,
                );
            }
            WindowEvent::Resized(_) => {
                if let (Ok(size), Ok(scale)) =
                    (settings_window.outer_size(), settings_window.scale_factor())
                {
                    let w = size.width as f64 / scale;
                    let h = size.height as f64 / scale;
                    let _ = window_anchor::persist_settings_size(&save_app, w, h);
                }
            }
            _ => {}
        }
    });
}

fn setup_eyedropper_window(app: &tauri::App) {
    use tauri::window::Color;

    let Some(window) = app.get_webview_window("eyedropper") else {
        return;
    };

    let _ = window.set_shadow(false);
    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
}

pub fn show_picker_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("picker") {
        let _ = window_anchor::place_picker_window(&window, app);
        let settings = current_settings(app);
        let _ = app.emit("picker-shown", &settings);
        let _ = window.show();
        capture_protection::apply_picker_capture_protection(app);
        let _ = window.set_focus();
    }
}

fn current_settings(app: &AppHandle) -> settings::AppSettings {
    let state = app.state::<AppState>();
    let Ok(conn) = state.conn.lock() else {
        return settings::AppSettings::default();
    };
    settings::get_settings(&conn).unwrap_or_default()
}

pub fn hide_picker_window(app: &AppHandle) {
    hide_settings_window(app);
    if let Some(window) = app.get_webview_window("picker") {
        let _ = window.hide();
    }
}

pub fn show_settings_window(app: &AppHandle) {
    if let Some(picker) = app.get_webview_window("picker") {
        if !picker.is_visible().unwrap_or(false) {
            let _ = window_anchor::place_picker_window(&picker, app);
            let _ = picker.show();
        }
    }

    if let Some(settings) = app.get_webview_window("settings") {
        let _ = window_anchor::place_settings_window(app, true);
        let _ = settings.show();
        window_anchor::restore_picker_cursor_events(app);
        let _ = settings.set_focus();
    }
}

pub fn hide_settings_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.hide();
    }
    window_anchor::restore_picker_cursor_events(app);
}
