use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GifItem {
    pub id: String,
    pub title: String,
    pub preview_url: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
struct KlipyResponse {
    result: bool,
    data: KlipyDataOuter,
}

#[derive(Debug, Deserialize)]
struct KlipyDataOuter {
    data: Vec<KlipyGif>,
}

#[derive(Debug, Deserialize)]
struct KlipyGif {
    id: serde_json::Value,
    title: Option<String>,
    file: KlipyFileBundle,
}

#[derive(Debug, Deserialize)]
struct KlipyFileBundle {
    hd: Option<KlipySizeBundle>,
    md: Option<KlipySizeBundle>,
    sm: Option<KlipySizeBundle>,
    xs: Option<KlipySizeBundle>,
}

#[derive(Debug, Deserialize)]
struct KlipySizeBundle {
    gif: Option<KlipyMedia>,
    webp: Option<KlipyMedia>,
    jpg: Option<KlipyMedia>,
}

#[derive(Debug, Deserialize)]
struct KlipyMedia {
    url: String,
}

pub fn search_klipy(api_key: &str, query: Option<&str>, limit: u32) -> Result<Vec<GifItem>, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Klipy API key is required".into());
    }

    let per_page = limit.clamp(8, 50);
    let encoded_key = urlencoding::encode(key);
    let url = match query.map(str::trim).filter(|q| !q.is_empty()) {
        Some(q) => format!(
            "https://api.klipy.com/api/v1/{encoded_key}/gifs/search?page=1&per_page={per_page}&q={}&customer_id=mezmerize&locale=us",
            urlencoding::encode(q)
        ),
        None => format!(
            "https://api.klipy.com/api/v1/{encoded_key}/gifs/trending?page=1&per_page={per_page}&customer_id=mezmerize&locale=us"
        ),
    };

    let response = ureq::get(&url)
        .call()
        .map_err(|e| e.to_string())?;
    if !(200..300).contains(&response.status()) {
        return Err(format!("Klipy request failed ({})", response.status()));
    }

    let body: KlipyResponse = response.into_json().map_err(|e| e.to_string())?;
    if !body.result {
        return Err("Klipy returned an error".into());
    }

    let mut items = Vec::new();
    for result in body.data.data {
        let Some((preview_url, url)) = pick_klipy_urls(&result.file) else {
            continue;
        };
        items.push(GifItem {
            id: klipy_id_string(&result.id),
            title: result.title.unwrap_or_default(),
            preview_url,
            url,
        });
    }
    Ok(items)
}

fn klipy_id_string(id: &serde_json::Value) -> String {
    match id {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

fn klipy_media_url(bundle: &KlipySizeBundle, prefer: &[&str]) -> Option<String> {
    for kind in prefer {
        let media = match *kind {
            "gif" => bundle.gif.as_ref(),
            "webp" => bundle.webp.as_ref(),
            "jpg" => bundle.jpg.as_ref(),
            _ => None,
        };
        if let Some(m) = media {
            return Some(m.url.clone());
        }
    }
    None
}

fn pick_klipy_urls(file: &KlipyFileBundle) -> Option<(String, String)> {
    let preview = file
        .xs
        .as_ref()
        .and_then(|b| klipy_media_url(b, &["webp", "gif", "jpg"]))
        .or_else(|| {
            file.sm
                .as_ref()
                .and_then(|b| klipy_media_url(b, &["webp", "gif", "jpg"]))
        })
        .or_else(|| {
            file.md
                .as_ref()
                .and_then(|b| klipy_media_url(b, &["webp", "gif", "jpg"]))
        })?;
    let full = file
        .md
        .as_ref()
        .and_then(|b| klipy_media_url(b, &["gif"]))
        .or_else(|| {
            file.hd
                .as_ref()
                .and_then(|b| klipy_media_url(b, &["gif"]))
        })
        .or_else(|| {
            file.sm
                .as_ref()
                .and_then(|b| klipy_media_url(b, &["gif"]))
        })
        .unwrap_or_else(|| preview.clone());
    Some((preview, full))
}
