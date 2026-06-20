use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use arboard::{Clipboard, ImageData};
use blake3::Hasher;
use image::GenericImageView;
use image::ImageEncoder;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::db;
use crate::settings;
use crate::AppState;

static WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static IGNORE_NEXT: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone)]
enum CapturedClip {
    Text {
        text: String,
        html: Option<String>,
    },
    Url(String),
    Image(Vec<u8>, String),
    Files(Vec<String>),
}

pub fn start_watcher(app: AppHandle) {
    if WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    thread::spawn(move || {
        let mut clipboard = match Clipboard::new() {
            Ok(c) => c,
            Err(err) => {
                eprintln!("clipboard watcher: {err}");
                WATCHER_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        loop {
            thread::sleep(Duration::from_millis(400));
            if IGNORE_NEXT.swap(false, Ordering::SeqCst) {
                continue;
            }

            let captured = match read_clipboard(&mut clipboard) {
                Some(c) => c,
                None => continue,
            };

            let hash = hash_capture(&captured);
            let state = app.state::<AppState>();
            let conn = match state.conn.lock() {
                Ok(c) => c,
                Err(_) => continue,
            };

            if db::recent_hash_exists(&conn, &hash).unwrap_or(true) {
                continue;
            }

            let record = match persist_capture(&state, &conn, captured, &hash) {
                Ok(r) => r,
                Err(err) => {
                    eprintln!("clipboard persist: {err}");
                    continue;
                }
            };

            let settings = settings::get_settings(&conn).unwrap_or_default();
            let max_history = settings.max_history;
            let mezmer_pairing_enabled = settings.mezmer_pairing_enabled;
            let mezmer_forward_folder_id = settings.mezmer_forward_folder_id;
            let _ = db::trim_history(&conn, max_history);

            let _ = app.emit("clip-added", &record);

            if mezmer_pairing_enabled && matches!(record.kind.as_str(), "image" | "url") {
                let forward_app = app.clone();
                let forward_record = record.clone();
                thread::spawn(move || {
                    match crate::mezmer::forward_clip(&forward_record, mezmer_forward_folder_id)
                    {
                        Ok(()) => {
                            let _ = forward_app.emit("mezmer-imported", &forward_record);
                        }
                        Err(err) => {
                            let _ = forward_app.emit("mezmer-import-failed", err);
                        }
                    }
                });
            }
        }
    });
}

pub fn suppress_next_capture() {
    IGNORE_NEXT.store(true, Ordering::SeqCst);
}

fn read_clipboard(clipboard: &mut Clipboard) -> Option<CapturedClip> {
    if let Some(files) = read_file_list() {
        if !files.is_empty() {
            return Some(CapturedClip::Files(files));
        }
    }

    if let Ok(image) = clipboard.get_image() {
        if let Some(png) = image_to_png(&image) {
            let name = format!("clipboard-{}.png", chrono::Local::now().format("%Y%m%d-%H%M%S"));
            return Some(CapturedClip::Image(png, name));
        }
    }

    if let Ok(text) = clipboard.get_text() {
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            return None;
        }
        let html = clipboard.get().html().ok().filter(|h| !h.trim().is_empty());
        if is_url(&trimmed) {
            return Some(CapturedClip::Url(trimmed));
        }
        return Some(CapturedClip::Text { text, html });
    }

    None
}

#[cfg(windows)]
fn read_file_list() -> Option<Vec<String>> {
    use clipboard_win::{formats, Clipboard, Getter};
    use clipboard_win::formats::Format;

    if !formats::FileList.is_format_avail() {
        return None;
    }
    let _clip = Clipboard::new_attempts(10).ok()?;
    let mut paths = Vec::new();
    formats::FileList.read_clipboard(&mut paths).ok()?;
    if paths.is_empty() {
        None
    } else {
        Some(paths)
    }
}

#[cfg(not(windows))]
fn read_file_list() -> Option<Vec<String>> {
    None
}

fn is_url(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    (lower.starts_with("http://") || lower.starts_with("https://")) && !text.contains('\n')
}

fn image_to_png(image: &ImageData) -> Option<Vec<u8>> {
    let rgba = image::RgbaImage::from_raw(
        image.width as u32,
        image.height as u32,
        image.bytes.to_vec(),
    )?;
    let mut buf = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut buf);
    encoder
        .write_image(
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            image::ExtendedColorType::Rgba8,
        )
        .ok()?;
    Some(buf)
}

fn hash_capture(capture: &CapturedClip) -> String {
    let mut hasher = Hasher::new();
    match capture {
        CapturedClip::Text { text, html } => {
            hasher.update(b"text:");
            hasher.update(text.as_bytes());
            if let Some(h) = html {
                hasher.update(b":html:");
                hasher.update(h.as_bytes());
            }
        }
        CapturedClip::Url(u) => {
            hasher.update(b"url:");
            hasher.update(u.as_bytes());
        }
        CapturedClip::Image(bytes, _) => {
            hasher.update(b"image:");
            hasher.update(bytes);
        }
        CapturedClip::Files(paths) => {
            hasher.update(b"files:");
            for path in paths {
                hasher.update(path.as_bytes());
                hasher.update(b"\n");
            }
        }
    }
    hasher.finalize().to_hex().to_string()
}

fn persist_capture(
    state: &AppState,
    conn: &rusqlite::Connection,
    capture: CapturedClip,
    hash: &str,
) -> Result<db::ClipRecord, String> {
    match capture {
        CapturedClip::Text { text, html } => {
            let preview = preview_text(&text);
            db::insert_clip(
                conn,
                "text",
                Some(&text),
                &preview,
                None,
                hash,
                html.as_deref(),
            )
        }
        CapturedClip::Url(url) => {
            let preview = url.clone();
            db::insert_clip(conn, "url", Some(&url), &preview, None, hash, None)
        }
        CapturedClip::Image(bytes, name) => {
            let file_name = format!("{}-{}", hash.get(..12).unwrap_or("img"), name);
            let path = state.images_dir.join(&file_name);
            std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
            let _ = write_thumbnail(&path);
            let path_str = path.to_string_lossy().to_string();
            let preview = format!("Image · {}", name);
            db::insert_clip(conn, "image", None, &preview, Some(&path_str), hash, None)
        }
        CapturedClip::Files(paths) => {
            let json = serde_json::to_string(&paths).map_err(|e| e.to_string())?;
            let preview = if paths.len() == 1 {
                paths[0].clone()
            } else {
                format!("{} files", paths.len())
            };
            db::insert_clip(conn, "files", Some(&json), &preview, None, hash, None)
        }
    }
}

fn preview_text(text: &str) -> String {
    let one_line: String = text.lines().next().unwrap_or("").chars().collect();
    if one_line.chars().count() > 120 {
        format!("{}…", one_line.chars().take(120).collect::<String>())
    } else {
        one_line
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePayload {
    pub base64: String,
    pub mime: String,
}

pub fn read_image_base64(path: &str) -> Result<ImagePayload, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    encode_image_payload(bytes, "image/png")
}

const THUMB_MAX_DIM: u32 = 480;
const THUMB_JPEG_QUALITY: u8 = 82;

pub fn thumb_path_for(full_path: &Path) -> PathBuf {
    let file_name = full_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let stem = file_name
        .rsplit_once('.')
        .map(|(name, _)| name)
        .unwrap_or(file_name);
    full_path.with_file_name(format!("{stem}-thumb.jpg"))
}

pub fn write_thumbnail(full_path: &Path) -> Result<PathBuf, String> {
    let thumb_path = thumb_path_for(full_path);
    if thumb_path.exists() {
        return Ok(thumb_path);
    }
    let img = image::open(full_path).map_err(|e| e.to_string())?;
    let thumb = resize_to_max(img, THUMB_MAX_DIM);
    let rgb = thumb.to_rgb8();
    let mut buf = Vec::new();
    let mut encoder =
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, THUMB_JPEG_QUALITY);
    encoder
        .encode(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| e.to_string())?;
    std::fs::write(&thumb_path, &buf).map_err(|e| e.to_string())?;
    Ok(thumb_path)
}

fn resize_to_max(img: image::DynamicImage, max_dim: u32) -> image::DynamicImage {
    use image::imageops::FilterType;
    let (w, h) = img.dimensions();
    if w <= max_dim && h <= max_dim {
        return img;
    }
    if w >= h {
        let next_h = ((h as f64 * max_dim as f64 / w as f64).round() as u32).max(1);
        img.resize(max_dim, next_h, FilterType::Triangle)
    } else {
        let next_w = ((w as f64 * max_dim as f64 / h as f64).round() as u32).max(1);
        img.resize(next_w, max_dim, FilterType::Triangle)
    }
}

pub fn read_image_thumbnail_base64(path: &str) -> Result<ImagePayload, String> {
    match write_thumbnail(Path::new(path)) {
        Ok(thumb) => {
            let bytes = std::fs::read(&thumb).map_err(|e| e.to_string())?;
            encode_image_payload(bytes, "image/jpeg")
        }
        Err(_) => read_image_base64(path),
    }
}

pub fn remove_clip_image_files(path: &str) {
    let full = Path::new(path);
    let _ = std::fs::remove_file(full);
    let _ = std::fs::remove_file(thumb_path_for(full));
}

fn encode_image_payload(bytes: Vec<u8>, mime: &str) -> Result<ImagePayload, String> {
    use base64::Engine;
    Ok(ImagePayload {
        base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        mime: mime.to_string(),
    })
}
