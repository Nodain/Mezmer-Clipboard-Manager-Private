# Mezmer Clipboard

A local first clipboard manager for Windows. Copy text, images, URLs, and file paths into a searchable history. Everything stays on your machine in SQLite. No account, no cloud.

Press **Ctrl+Shift+V** to open the picker (configurable in Settings).

## Download

Install the latest version from **[Releases](https://github.com/Nodain/Mezmer-Clipboard-Manager/releases)**.


| File                         | Description                     |
| ---------------------------- | ------------------------------- |
| `Mezmer-Clipboard-*-x64.msi` | Windows installer (recommended) |


After installing, Mezmer Clipboard runs in the system tray.

## Features

- Clipboard history with search and filters (text, images, pinned, colors)
- Optional carousel mode to browse clips
- Pin items to keep them across clears
- Optional pairing with [Mezmer Desktop](https://github.com/Nodain/Mezmer-Desktop) — auto-send copied images and URLs to your Mezmer library
- Win + V shortcut support (replaces Windows clipboard history when enabled)
- Hide picker from screen capture (Discord, OBS)

## Mezmer pairing (optional)

1. Install and run **Mezmer Desktop**.
2. In Mezmer: **Settings → Extension** → enable the localhost bridge.
3. In Mezmer Clipboard: open **Settings → Mezmer pairing** → turn on **Connect to Mezmer**.
4. Optionally choose a target folder for forwarded items.

Mezmer is not required — the clipboard app works fully on its own.

## Requirements

- Windows 10 or 11 (64-bit)
- WebView2 (usually already installed on Windows 11)

## Privacy

All clipboard data is stored locally on your PC. Nothing is sent to the internet unless you enable Mezmer pairing and Mezmer is running on localhost.

## Support

Open an issue on this repository for install or usage questions. Source code is not published here.