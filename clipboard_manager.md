# Clipboard manager — agent brief (optional Mezmer pairing)

## One-liner

Build a local-first clipboard manager that works alone; add an optional Settings toggle to send image/URL clips to Mezmer via its localhost API on port **47832** (`/api/health`, `/api/folders`, `/api/import`), matching Mezmer’s dark glass UI.

---

## Product

- **Standalone Windows desktop clipboard manager** (Tauri 2 + React + TypeScript recommended; native is fine).
- **Offline-first.** History stored locally (SQLite). No account, no cloud.
- **Optional pairing** with **Mezmer** (local asset library). When pairing is off, the app is fully useful on its own.

### Audience

Power users who copy screenshots, paths, links, text snippets, and images while organizing media in Mezmer. Same visual language as Mezmer if possible: neutral dark UI, glass popups, default accent `#7E5ED7`, design tokens — not hardcoded hex in components.

---

## Core clipboard features (v1)

| Feature | Spec |
|---------|------|
| History | Ring buffer of clips: text, image, files (paths); HTML optional |
| Organization | Pin/favorite, search, delete, clear |
| Launcher | Global hotkey to open picker overlay |
| Persistence | Survive restarts; configurable max history size |
| Privacy | No auto-upload; explicit user action to send anywhere |

---

## Mezmer pairing (optional)

### Port — same as the browser extension

**Use `127.0.0.1:47832`.** That port is **Mezmer’s HTTP server**, not the extension’s exclusive port.

- Mezmer **listens** on `47832` when Settings → Extension is enabled.
- The browser extension is an **HTTP client** to that server.
- The clipboard manager is also an **HTTP client** — multiple clients can connect to one server.

Only use a **different port** if the clipboard app runs its **own** server (e.g. Mezmer pushes events back). For v1, client-only → same port.

### Enablement on Mezmer side

Mezmer starts the bridge only when the user enables **Settings → Extension**. That creates a marker file `.extension-enabled` in app data and binds `http://127.0.0.1:47832`.

If Mezmer is closed or the toggle is off, the clipboard app shows a clear status (“Mezmer not running or pairing disabled”) and continues working standalone.

### Pairing UX (clipboard app)

- Settings → **Mezmer pairing** toggle (default off).
- Connection status: disconnected / connected (health check).
- On image or URL clips: context action **“Save to Mezmer…”**
- Optional folder picker via `GET /api/folders` before import.
- **Do not** auto-import every copy in v1 — user must confirm.

---

## Mezmer local API (implement as HTTP client)

Reference implementation: `src-tauri/src/extension_server.rs`

Base URL: `http://127.0.0.1:47832`

All JSON uses **camelCase**. CORS allows browser clients; desktop clients do not need special headers.

### `GET /api/health`

Discover Mezmer and verify the bridge is up.

**Response 200:**

```json
{
  "ok": true,
  "app": "Mezmer",
  "version": "0.x.x",
  "port": 47832
}
```

Reject or warn if `app !== "Mezmer"`.

### `GET /api/folders`

List folders for import target selection.

**Response 200:** array of folder records (same shape as Mezmer’s `list_folders`).

### `POST /api/import`

Import into the Mezmer library (content-addressed storage + SQLite catalog).

**Request body (camelCase):**

| Field | Type | Notes |
|-------|------|-------|
| `url` | string? | Remote URL — Mezmer runs `import_from_url` (yt-dlp / fetch) |
| `data` | string? | Base64-encoded bytes (e.g. PNG from clipboard) |
| `name` | string? | Filename hint when using `data` (default `saved-image.png`) |
| `folderId` | number? | Target folder id |
| `sourceUrl` | string? | Provenance URL stored on the file record |

Provide **`url` or `data`** (not both required empty). Returns imported `FileRecord` on success.

**Errors:** `{ "error": "message" }` with 4xx/5xx.

On success Mezmer emits `extension-import` to its UI; the clipboard app only needs the HTTP response.

### What works today (no Mezmer changes)

- Screenshot / image clip → `POST /api/import` with `data` (base64) + optional `name`, `folderId`
- URL clip → `POST /api/import` with `url` + optional `folderId`, `sourceUrl`
- Health check + folder list

### Awkward today (phase 2 — Mezmer changes)

| Need | Gap |
|------|-----|
| Plain text snippets | No text endpoint; could import as `.txt` blob or add `POST /api/import/text` |
| File path clips | `import_files` not exposed on HTTP API |
| Copy from Mezmer | No export/pull API on the bridge |
| Push notifications | Clipboard app would need its own listen port |

---

## Architecture

```
Clipboard app (always running)
  ├── Local SQLite history
  ├── System clipboard watcher
  └── [if Mezmer pairing enabled]
        └── HTTP client → http://127.0.0.1:47832
              └── on user action: health → folders? → import
```

**Standalone first, pairing second.** The clipboard app is a **client** of Mezmer’s bridge — not a fork of Mezmer and not a second Mezmer process.

---

## Design alignment

If matching Mezmer chrome:

| Pattern | Use |
|---------|-----|
| `.mezmer-popup-surface` | Picker overlay, menus |
| `--color-input` | Form fields (default `#1f1f1f`) |
| `--color-view-bg`, `--color-sidebar`, `--color-accent` | Shell surfaces |
| Frameless window | Optional; custom drag regions |

Fork guide: repo root `.cursorrules` — sections **Visual design system**, **Personalization**, **Build & verify**, **Fork checklist**.

---

## Non-goals

- Cloud sync or multi-device clipboard sync
- Accounts or auth
- Writing into Mezmer’s SQLite DB or library folders directly
- Full NLE / asset-editor features inside the clipboard app
- Auto-send every copy to Mezmer without user confirmation (v1)

---

## Deliverables

1. Working clipboard manager standalone (installable build).
2. Settings → Mezmer pairing toggle + live connection status.
3. **Save to Mezmer…** on image and URL clips (folder picker optional).
4. Short README: Mezmer requirements (app running, Extension enabled, port 47832).

---

## Files to attach when starting the agent

| File | Why |
|------|-----|
| This document (`clipboard_manager.md`) | Scope and API contract |
| `.cursorrules` | Stack, tokens, patterns (UI sections only if not cloning full app) |
| `src-tauri/src/extension_server.rs` | Authoritative API behavior |
| `src/components/SettingsModal.tsx` (Extension tab) | How Mezmer documents the bridge to users |

---

## Suggested Mezmer follow-ups (separate task)

- Rename Settings **Extension** → **Local API** or **Companion apps** (extension + clipboard share one server).
- Add `POST /api/import/text` or blob import for `.txt` from text clips.
- Optional `User-Agent` or `X-Mezmer-Client: clipboard` header for logging.
