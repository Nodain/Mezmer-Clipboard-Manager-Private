# Mezmerize

A local-first clipboard manager. Copy text, images, URLs, and file paths into a searchable history. Everything stays on your machine in SQLite. No account, no cloud.

Press **Ctrl+Shift+V** (Windows/Linux) or **Cmd+Shift+V** (macOS) to open the picker. On Windows you can optionally switch to **Win+V** in Settings.

## Download

Install the latest version from **[Releases](https://github.com/Nodain/Mezmerize/releases)**.

| File | Platform |
|------|----------|
| `Mezmerize-*-x64.msi` | Windows (recommended) |
| `Mezmerize_*_amd64.deb` / `.AppImage` | Linux |
| `Mezmerize_*_aarch64.dmg` | macOS |

After installing, Mezmerize runs in the system tray (or menu bar on macOS).

## Features

- Clipboard history with search and filters (text, images, pinned, colors)
- Optional carousel mode to browse clips
- Pin items to keep them across clears
- Optional pairing with [Mezmer Desktop](https://github.com/Nodain/Mezmer-Desktop-Library) — auto-send copied images and URLs to your library (Windows)
- Screen color picker and saved swatches (Windows)
- Win + V shortcut support on Windows (replaces system clipboard history when enabled)
- Hide picker from screen capture (Discord, OBS)

## Mezmer Desktop pairing (optional, Windows)

1. Install and run **[Mezmer Desktop](https://github.com/Nodain/Mezmer-Desktop-Library)**.
2. In Mezmer Desktop: **Settings → Extension** → enable the localhost bridge.
3. In Mezmerize: open **Settings → General** → turn on **Connect to Mezmer Desktop**.
4. Optionally choose a target folder for forwarded items.

Mezmer Desktop is not required — Mezmerize works fully on its own.

## Platform notes

- **Windows** — full feature set (Win+V, eyedropper, Mezmer Desktop pairing, file-path clips)
- **macOS / Linux** — clipboard history, search, pins, and global hotkey; some Windows-only features are hidden in the UI

## Requirements

- **Windows:** 10 or 11 (64-bit), WebView2 (usually preinstalled on Windows 11)
- **macOS:** 10.15+
- **Linux:** WebKitGTK (most desktop distros)

## Privacy

All clipboard data is stored locally on your PC. Nothing is sent to the internet unless you enable Mezmer Desktop pairing and Mezmer Desktop is running on localhost.

## Links

- [Mezmerize on GitHub](https://github.com/Nodain/Mezmerize) — releases and support
- [Mezmer Desktop](https://github.com/Nodain/Mezmer-Desktop-Library) — optional library app for pairing

## Support

Open an issue on this repository for install or usage questions. Source code is not published here.
