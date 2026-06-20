export function Toggle({
  on,
  onChange,
  title,
  desc,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  title: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-no-drag
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-start gap-3 rounded-[var(--mezmer-radius-sm)] border border-[var(--color-border-soft)] bg-[color-mix(in_srgb,var(--color-panel)_55%,transparent)] px-3 py-2.5 text-left transition hover:border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-panel-2)_65%,transparent)] disabled:opacity-50"
    >
      <span
        className={`mt-0.5 flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-[2px] transition ${
          on
            ? "bg-[var(--color-accent)] shadow-[0_0_10px_var(--color-accent-glow)]"
            : "bg-[color-mix(in_srgb,var(--color-elevated)_90%,transparent)]"
        }`}
      >
        <span
          className={`h-[14px] w-[14px] rounded-full bg-white shadow-sm transition ${
            on ? "translate-x-[12px]" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium tracking-tight t-text">
          {title}
        </span>
        {desc ? (
          <span className="mt-0.5 block text-[11px] leading-relaxed t-muted">
            {desc}
          </span>
        ) : null}
      </span>
    </button>
  );
}
