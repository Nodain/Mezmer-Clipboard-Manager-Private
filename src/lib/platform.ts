export function isWindows(): boolean {
  return navigator.platform.toLowerCase().includes("win");
}

export function isMac(): boolean {
  return navigator.platform.toLowerCase().includes("mac");
}

export function supportsColorPicker(): boolean {
  return isWindows();
}

export function autostartPlatformLabel(): string {
  if (isWindows()) return "Autostart with Windows";
  if (isMac()) return "Autostart with macOS";
  return "Autostart with Linux";
}

export function defaultHotkeyLabel(): string {
  return isMac() ? "Cmd+Shift+V" : "Ctrl+Shift+V";
}
