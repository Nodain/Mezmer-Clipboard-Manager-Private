use std::path::Path;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipRecord {
    pub id: i64,
    pub kind: String,
    pub content: Option<String>,
    pub preview: String,
    pub image_path: Option<String>,
    pub pinned: bool,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html_content: Option<String>,
    #[serde(default)]
    pub has_html_content: bool,
}

pub fn open(data_dir: &Path) -> Result<Connection, String> {
    let db_path = data_dir.join("clipboard.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS clips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            content TEXT,
            preview TEXT NOT NULL,
            image_path TEXT,
            content_hash TEXT NOT NULL,
            pinned INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_clips_hash ON clips(content_hash);
        CREATE INDEX IF NOT EXISTS idx_clips_kind ON clips(kind);
        CREATE INDEX IF NOT EXISTS idx_clips_pinned_created ON clips(pinned DESC, created_at DESC);

        CREATE TABLE IF NOT EXISTS saved_colors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hex TEXT NOT NULL,
            r INTEGER NOT NULL,
            g INTEGER NOT NULL,
            b INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_saved_colors_created ON saved_colors(created_at DESC);
        ",
    )
    .map_err(|e| e.to_string())?;

    ensure_column(
        &conn,
        "clips",
        "html_content",
        "ALTER TABLE clips ADD COLUMN html_content TEXT",
    )?;

    Ok(conn)
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    ddl: &str,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|e| e.to_string())?;
    let exists = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .any(|name| name == column);
    if !exists {
        conn.execute(ddl, []).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn insert_clip(
    conn: &Connection,
    kind: &str,
    content: Option<&str>,
    preview: &str,
    image_path: Option<&str>,
    content_hash: &str,
    html_content: Option<&str>,
) -> Result<ClipRecord, String> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO clips (kind, content, preview, image_path, content_hash, created_at, html_content)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            kind,
            content,
            preview,
            image_path,
            content_hash,
            now,
            html_content
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(ClipRecord {
        id,
        kind: kind.to_string(),
        content: content.map(str::to_string),
        preview: preview.to_string(),
        image_path: image_path.map(str::to_string),
        pinned: false,
        created_at: now,
        html_content: html_content.map(str::to_string),
        has_html_content: html_content.is_some_and(|h| !h.is_empty()),
    })
}

pub fn list_clips(conn: &Connection, search: Option<&str>, limit: i64) -> Result<Vec<ClipRecord>, String> {
    let mut out = Vec::new();
    if let Some(q) = search.filter(|s| !s.trim().is_empty()) {
        let pattern = format!("%{}%", q.trim());
        let mut stmt = conn
            .prepare(
                "SELECT id, kind, content, preview, image_path, pinned, created_at,
                        CASE WHEN html_content IS NOT NULL AND length(html_content) > 0 THEN 1 ELSE 0 END
                 FROM clips
                 WHERE preview LIKE ?1 OR content LIKE ?1
                 ORDER BY pinned DESC, created_at DESC
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern, limit], row_to_clip_list)
            .map_err(|e| e.to_string())?;
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, kind, content, preview, image_path, pinned, created_at,
                        CASE WHEN html_content IS NOT NULL AND length(html_content) > 0 THEN 1 ELSE 0 END
                 FROM clips
                 ORDER BY pinned DESC, created_at DESC
                 LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], row_to_clip_list)
            .map_err(|e| e.to_string())?;
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
    }
    Ok(out)
}

fn row_to_clip(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClipRecord> {
    let html_content: Option<String> = row.get(7)?;
    Ok(ClipRecord {
        id: row.get(0)?,
        kind: row.get(1)?,
        content: row.get(2)?,
        preview: row.get(3)?,
        image_path: row.get(4)?,
        pinned: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        has_html_content: html_content.as_ref().is_some_and(|h| !h.is_empty()),
        html_content,
    })
}

fn row_to_clip_list(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClipRecord> {
    Ok(ClipRecord {
        id: row.get(0)?,
        kind: row.get(1)?,
        content: row.get(2)?,
        preview: row.get(3)?,
        image_path: row.get(4)?,
        pinned: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        html_content: None,
        has_html_content: row.get::<_, i64>(7)? != 0,
    })
}

pub fn delete_clip(conn: &Connection, id: i64) -> Result<(), String> {
    let image_path: Option<String> = conn
        .query_row(
            "SELECT image_path FROM clips WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if let Some(path) = image_path {
        crate::clipboard::remove_clip_image_files(&path);
    }
    conn.execute("DELETE FROM clips WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn clear_clips(conn: &Connection, keep_pinned: bool) -> Result<(), String> {
    if keep_pinned {
        let mut stmt = conn
            .prepare("SELECT image_path FROM clips WHERE pinned = 0 AND image_path IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let paths: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        for path in paths {
            crate::clipboard::remove_clip_image_files(&path);
        }
        conn.execute("DELETE FROM clips WHERE pinned = 0", [])
            .map_err(|e| e.to_string())?;
    } else {
        let mut stmt = conn
            .prepare("SELECT image_path FROM clips WHERE image_path IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let paths: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        for path in paths {
            crate::clipboard::remove_clip_image_files(&path);
        }
        conn.execute("DELETE FROM clips", [])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn toggle_pin(conn: &Connection, id: i64) -> Result<bool, String> {
    let pinned: i64 = conn
        .query_row("SELECT pinned FROM clips WHERE id = ?1", params![id], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;
    let next = if pinned == 0 { 1 } else { 0 };
    conn.execute("UPDATE clips SET pinned = ?1 WHERE id = ?2", params![next, id])
        .map_err(|e| e.to_string())?;
    Ok(next != 0)
}

pub fn fetch_clip(conn: &Connection, id: i64) -> Result<ClipRecord, String> {
    conn.query_row(
        "SELECT id, kind, content, preview, image_path, pinned, created_at, html_content FROM clips WHERE id = ?1",
        params![id],
        row_to_clip,
    )
    .map_err(|e| e.to_string())
}

pub fn recent_hash_exists(conn: &Connection, hash: &str) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM clips WHERE content_hash = ?1",
            params![hash],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

pub fn trim_history(conn: &Connection, max_items: i64) -> Result<(), String> {
    if max_items <= 0 {
        return Ok(());
    }
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM clips WHERE pinned = 0", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let excess = count - max_items;
    if excess <= 0 {
        return Ok(());
    }
    let mut stmt = conn
        .prepare(
            "SELECT id, image_path FROM clips WHERE pinned = 0 ORDER BY created_at ASC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, Option<String>)> = stmt
        .query_map(params![excess], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    for (id, image_path) in rows {
        if let Some(path) = image_path {
            crate::clipboard::remove_clip_image_files(&path);
        }
        conn.execute("DELETE FROM clips WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedColor {
    pub id: i64,
    pub hex: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub created_at: String,
}

pub fn list_saved_colors(conn: &Connection, limit: i64) -> Result<Vec<SavedColor>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, hex, r, g, b, created_at
             FROM saved_colors
             ORDER BY created_at DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(SavedColor {
                id: row.get(0)?,
                hex: row.get(1)?,
                r: row.get::<_, i64>(2)? as u8,
                g: row.get::<_, i64>(3)? as u8,
                b: row.get::<_, i64>(4)? as u8,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn insert_saved_color(
    conn: &Connection,
    hex: &str,
    r: u8,
    g: u8,
    b: u8,
) -> Result<SavedColor, String> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO saved_colors (hex, r, g, b, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![hex, r as i64, g as i64, b as i64, now],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(SavedColor {
        id,
        hex: hex.to_string(),
        r,
        g,
        b,
        created_at: now,
    })
}

pub fn delete_saved_color(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM saved_colors WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
