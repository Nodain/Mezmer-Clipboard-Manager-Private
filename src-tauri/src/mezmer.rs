use base64::Engine;
use serde_json::{json, Value};

use crate::db::ClipRecord;

const MEZMER_BASE: &str = "http://127.0.0.1:47832";

pub fn forward_clip(record: &ClipRecord, folder_id: Option<i64>) -> Result<(), String> {
    match record.kind.as_str() {
        "url" => forward_url(record, folder_id),
        "image" => forward_image(record, folder_id),
        _ => Ok(()),
    }
}

fn forward_url(record: &ClipRecord, folder_id: Option<i64>) -> Result<(), String> {
    let url = record
        .content
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Missing URL content".to_string())?;
    post_import(with_folder_id(json!({ "url": url }), folder_id))
}

fn forward_image(record: &ClipRecord, folder_id: Option<i64>) -> Result<(), String> {
    let path = record
        .image_path
        .as_deref()
        .ok_or_else(|| "Missing image path".to_string())?;
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("Empty image data".into());
    }

    let name = std::path::Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("clipboard-image.png")
        .to_string();

    let data = base64::engine::general_purpose::STANDARD.encode(bytes);
    post_import(with_folder_id(json!({ "data": data, "name": name }), folder_id))
}

fn with_folder_id(mut body: Value, folder_id: Option<i64>) -> Value {
    if let Some(id) = folder_id {
        body["folderId"] = json!(id);
    }
    body
}

fn post_import(body: Value) -> Result<(), String> {
    let payload = body.to_string();
    let response = ureq::post(&format!("{MEZMER_BASE}/api/import"))
        .set("Content-Type", "application/json")
        .send_string(&payload)
        .map_err(|err| format!("Mezmer Desktop is not reachable ({err})"))?;

    if response.status() >= 400 {
        let message = response
            .into_string()
            .ok()
            .and_then(parse_error_message)
            .unwrap_or_else(|| "Mezmer Desktop import failed".to_string());
        return Err(message);
    }

    Ok(())
}

fn parse_error_message(body: String) -> Option<String> {
    let parsed = serde_json::from_str::<Value>(&body).ok()?;
    parsed
        .get("error")
        .and_then(|value| value.as_str())
        .map(str::to_string)
}
