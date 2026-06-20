import { normalizeHex } from "../lib/theme";

export function ColorField({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const safe = normalizeHex(value) ?? "#000000";

  return (
    <label className="block px-0.5">
      <span className="mb-1.5 block text-[11px] t-muted">{label}</span>
      {hint ? (
        <span className="mb-1.5 block text-[10px] leading-relaxed t-faint">
          {hint}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="clipboard-color-swatch"
        />
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const next = normalizeHex(value);
            if (next && next !== value) onChange(next);
          }}
          spellCheck={false}
          className="min-w-0 flex-1 px-2.5 py-1.5 font-mono text-[12px] uppercase"
        />
      </div>
    </label>
  );
}
