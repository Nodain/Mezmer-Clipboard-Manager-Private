use std::fs;
use std::path::{Path, PathBuf};

const DATA_DIR_NAME: &str = "Mezmer";

pub fn app_data_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let appdata = std::env::var("APPDATA").map_err(|e| e.to_string())?;
        return Ok(PathBuf::from(appdata).join(DATA_DIR_NAME));
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join(DATA_DIR_NAME));
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let base = std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|_| {
                std::env::var("HOME")
                    .map(|home| PathBuf::from(home).join(".local").join("share"))
            })
            .map_err(|e| e.to_string())?;
        Ok(base.join(DATA_DIR_NAME))
    }
}

fn legacy_data_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    #[cfg(windows)]
    if let Ok(appdata) = std::env::var("APPDATA") {
        let base = PathBuf::from(appdata);
        dirs.push(base.join("com.mesmer.clipboard"));
        dirs.push(base.join("com.mesmer.app"));
    }

    #[cfg(target_os = "macos")]
    if let Ok(home) = std::env::var("HOME") {
        let base = PathBuf::from(home).join("Library").join("Application Support");
        dirs.push(base.join("com.mesmer.clipboard"));
        dirs.push(base.join("com.mesmer.app"));
    }

    dirs
}

fn copy_dir(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let dest = to.join(entry.file_name());
        if dest.exists() {
            continue;
        }
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if file_type.is_dir() {
            copy_dir(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn migrate_legacy_data(target: &Path) -> Result<(), String> {
    if target.join("clipboard.db").exists() {
        return Ok(());
    }

    for legacy in legacy_data_dirs() {
        if !legacy.join("clipboard.db").exists() {
            continue;
        }
        copy_dir(&legacy, target)?;
        break;
    }

    Ok(())
}

pub fn ensure_app_data_dir() -> Result<PathBuf, String> {
    let data_dir = app_data_dir()?;
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    migrate_legacy_data(&data_dir)?;
    Ok(data_dir)
}
