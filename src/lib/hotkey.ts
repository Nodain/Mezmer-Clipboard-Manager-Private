import { isMac, isWindows } from "./platform";

export function defaultPickerHotkey(): string {
  return isMac() ? "super+shift+KeyV" : "control+shift+KeyV";
}

/** @deprecated use defaultPickerHotkey() */
export const DEFAULT_PICKER_HOTKEY = "control+shift+KeyV";

export const WIN_V_PICKER_HOTKEY = "super+KeyV";

export function formatHotkey(hotkey: string): string {
  return hotkey
    .split("+")
    .filter(Boolean)
    .map(formatHotkeyPart)
    .join(" + ");
}

function formatHotkeyPart(part: string): string {
  switch (part.toLowerCase()) {
    case "control":
      return "Ctrl";
    case "shift":
      return "Shift";
    case "alt":
      return "Alt";
    case "super":
      return isMac() ? "Cmd" : "Win";
    default:
      if (part.startsWith("Key")) return part.slice(3);
      if (part.startsWith("Digit")) return part.slice(5);
      if (part.startsWith("Numpad")) return part.slice(6);
      return part;
  }
}

export function isWindowsClipboardHotkey(hotkey: string): boolean {
  if (!isWindows()) return false;
  const parts = hotkey.split("+").filter(Boolean);
  const mods = parts.slice(0, -1).map((p) => p.toLowerCase());
  const key = parts[parts.length - 1];
  return (
    mods.length === 1 &&
    mods[0] === "super" &&
    key.toLowerCase() === "keyv"
  );
}

export function eventToHotkey(e: KeyboardEvent): string | null {
  if (e.key === "Escape") return null;
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;

  const mods: string[] = [];
  if (e.ctrlKey) mods.push("control");
  if (e.shiftKey) mods.push("shift");
  if (e.altKey) mods.push("alt");
  if (e.metaKey) mods.push("super");

  if (!e.code) return null;
  return [...mods, e.code].join("+");
}
