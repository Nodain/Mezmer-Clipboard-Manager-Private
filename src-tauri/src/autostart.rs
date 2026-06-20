use tauri::AppHandle;

pub const AUTOSTART_APP_NAME: &str = "Mezmer Clipboard";

#[cfg(desktop)]
pub fn apply_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Only remove the Run entry when one exists — delete_value errors if missing.
    match manager.is_enabled() {
        Ok(true) => manager.disable().map_err(|e| e.to_string())?,
        Ok(false) => {}
        Err(_) => {
            let _ = manager.disable();
        }
    }
    Ok(())
}

/// Keeps the saved setting aligned with Windows Startup apps / Task Manager.
#[cfg(desktop)]
pub fn reconcile_autostart(app: &AppHandle, enabled_in_settings: bool) -> Result<bool, String> {
    apply_autostart(app, enabled_in_settings)?;

    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    manager.is_enabled().map_err(|e| e.to_string())
}

#[cfg(not(desktop))]
pub fn apply_autostart(_app: &AppHandle, _enabled: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(not(desktop))]
pub fn reconcile_autostart(_app: &AppHandle, enabled_in_settings: bool) -> Result<bool, String> {
    Ok(enabled_in_settings)
}
