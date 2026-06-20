export function autostartPlatformLabel(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) return "Autostart with Windows";
  if (platform.includes("mac")) return "Autostart with macOS";
  return "Autostart with Linux";
}
