export const DEFAULT_NAV_PREV_KEY = "ArrowLeft";
export const DEFAULT_NAV_NEXT_KEY = "ArrowRight";
export const DEFAULT_COPY_KEY = "Enter";
export const DEFAULT_CLOSE_KEY = "Escape";

const NAV_KEY_LABELS: Record<string, string> = {
  ArrowLeft: "← Left",
  ArrowRight: "→ Right",
  ArrowUp: "↑ Up",
  ArrowDown: "↓ Down",
  PageUp: "Page Up",
  PageDown: "Page Down",
  Home: "Home",
  End: "End",
  Enter: "Enter",
  Escape: "Esc",
  Space: "Space",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
};

export function formatNavKey(code: string): string {
  if (NAV_KEY_LABELS[code]) return NAV_KEY_LABELS[code]!;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

export function eventToNavKey(e: KeyboardEvent): string | null {
  if (e.key === "Escape") return null;
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return null;
  if (!e.code) return null;
  return e.code;
}

export function matchesNavKey(e: KeyboardEvent, code: string): boolean {
  return (
    e.code === code &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    !e.metaKey
  );
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
