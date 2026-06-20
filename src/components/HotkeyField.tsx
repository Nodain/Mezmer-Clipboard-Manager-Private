import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PICKER_HOTKEY,
  eventToHotkey,
  formatHotkey,
  isWindowsClipboardHotkey,
  WIN_V_PICKER_HOTKEY,
} from "../lib/hotkey";

export function HotkeyField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (hotkey: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }

      const next = eventToHotkey(e);
      if (!next) return;

      setRecording(false);
      onChange(next);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  useEffect(() => {
    if (recording) buttonRef.current?.focus();
  }, [recording]);

  const winV = isWindowsClipboardHotkey(value);

  return (
    <div className="space-y-2 px-0.5">
      <div className="flex items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setRecording(true)}
          className={`min-w-0 flex-1 rounded-[var(--mezmer-radius-sm)] border px-2.5 py-2 text-left text-[12px] transition ${
            recording
              ? "border-[color-mix(in_srgb,var(--color-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] t-text"
              : "border-[var(--color-border-soft)] bg-[color-mix(in_srgb,var(--color-input)_88%,transparent)] t-text"
          }`}
        >
          {recording ? "Press shortcut…" : formatHotkey(value)}
        </button>
        <button
          type="button"
          disabled={disabled || value === WIN_V_PICKER_HOTKEY}
          onClick={() => onChange(WIN_V_PICKER_HOTKEY)}
          className="shrink-0 rounded-[var(--mezmer-radius-sm)] border border-[var(--color-border-soft)] px-2.5 py-2 text-[10px] font-medium t-muted transition hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
          title="Disable Windows clipboard history and use Win + V for Mezmer"
        >
          Win + V
        </button>
        <button
          type="button"
          disabled={disabled || value === DEFAULT_PICKER_HOTKEY}
          onClick={() => onChange(DEFAULT_PICKER_HOTKEY)}
          className="shrink-0 rounded-[var(--mezmer-radius-sm)] border border-[var(--color-border-soft)] px-2.5 py-2 text-[10px] font-medium t-muted transition hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      {winV ? (
        <p className="text-[10px] leading-relaxed t-muted">
          Mezmer turns off Windows clipboard history, blocks Win + V in File
          Explorer, and restarts Explorer once so the shortcut is free. Your
          previous Windows setting is restored if you switch back.
        </p>
      ) : (
        <p className="text-[10px] t-faint">
          Click the field, then press your shortcut. Esc cancels. On Windows,
          use the Win + V button — the Win key cannot be recorded here.
        </p>
      )}
    </div>
  );
}
