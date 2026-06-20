import { useEffect, useRef, useState } from "react";
import { eventToNavKey, formatNavKey } from "../lib/navKey";

function NavKeyField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (code: string) => void;
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

      const next = eventToNavKey(e);
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

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] t-faint">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setRecording(true)}
        className={`w-full rounded-[var(--mezmer-radius-sm)] border px-2.5 py-2 text-left text-[12px] transition ${
          recording
            ? "border-[color-mix(in_srgb,var(--color-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] t-text"
            : "border-[var(--color-border-soft)] bg-[color-mix(in_srgb,var(--color-input)_88%,transparent)] t-text"
        }`}
      >
        {recording ? "Press key…" : formatNavKey(value)}
      </button>
    </label>
  );
}

export function NavKeyFields({
  leftLabel,
  rightLabel,
  leftKey,
  rightKey,
  defaultLeftKey,
  defaultRightKey,
  disabled,
  showHint = true,
  onChange,
}: {
  leftLabel: string;
  rightLabel: string;
  leftKey: string;
  rightKey: string;
  defaultLeftKey: string;
  defaultRightKey: string;
  disabled?: boolean;
  showHint?: boolean;
  onChange: (patch: { leftKey: string; rightKey: string }) => void;
}) {
  const atDefaults = leftKey === defaultLeftKey && rightKey === defaultRightKey;

  return (
    <div className="space-y-2 px-0.5">
      <div className="grid grid-cols-2 gap-2">
        <NavKeyField
          label={leftLabel}
          value={leftKey}
          disabled={disabled}
          onChange={(code) => {
            if (code === rightKey) return;
            onChange({ leftKey: code, rightKey });
          }}
        />
        <NavKeyField
          label={rightLabel}
          value={rightKey}
          disabled={disabled}
          onChange={(code) => {
            if (code === leftKey) return;
            onChange({ leftKey, rightKey: code });
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {showHint ? (
          <p className="text-[10px] leading-relaxed t-faint">
            Click a field, then press a key. Esc cancels.
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={disabled || atDefaults}
          onClick={() =>
            onChange({
              leftKey: defaultLeftKey,
              rightKey: defaultRightKey,
            })
          }
          className="shrink-0 rounded-[var(--mezmer-radius-sm)] border border-[var(--color-border-soft)] px-2 py-1 text-[10px] font-medium t-muted transition hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
