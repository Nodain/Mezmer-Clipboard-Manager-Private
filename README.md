# Mezmerize

Local-first Windows clipboard manager with optional pairing to Mezmer Desktop.

Copy text, images, URLs, and file paths into a searchable history. Press **Ctrl+Shift+V** to open the picker. Everything stays on disk in SQLite — no account, no cloud.

## Mezmer Desktop pairing (optional)

When enabled under **Settings → Mezmer Desktop pairing**, you can send **image** and **URL** clips to your Mezmer Desktop library via the localhost bridge.

### Requirements

1. **Mezmer Desktop** must be running.
2. In Mezmer Desktop, open **Settings → Extension** and turn on **Link to Mezmer browser extension** (this starts the HTTP server).
3. The bridge listens at `http://127.0.0.1:47832`.

If Mezmer Desktop is closed or the extension toggle is off, Mezmerize shows **Disconnected** and continues working standalone.

### API endpoints used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Connection check (`app` must be `"Mezmer"`) |
| `GET /api/folders` | Folder picker before import |
| `POST /api/import` | Import image (`data` base64) or URL (`url`) |

See Mezmer's `src-tauri/src/extension_server.rs` for the authoritative contract.

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Installer output: `src-tauri/target/release/bundle/msi/`.

## Shortcuts

| Action | Key |
|--------|-----|
| Open / close picker | Ctrl+Shift+V |
| Copy selected clip | Enter |
| Close picker / modal | Escape |

## Tray

The app runs in the system tray. Left-click the tray icon or use the hotkey to open the picker.
