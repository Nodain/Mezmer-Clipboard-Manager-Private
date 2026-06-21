import { useEffect, useRef, useState, type ReactNode } from "react";
import { applyTheme, DEFAULT_THEME, isDefaultTheme } from "../lib/theme";
import type { AppSettings, ThemeSettings } from "../lib/types";
import { ColorField } from "./ColorField";

function ThemeSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h4 className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] t-faint">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function SettingsPersonalization({
  settings,
  saving,
  onSave,
}: {
  settings: AppSettings;
  saving: boolean;
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
}) {
  const [theme, setTheme] = useState<ThemeSettings>(settings.theme);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme]);

  const queueSave = (next: ThemeSettings) => {
    applyTheme(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void onSave({ theme: next });
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const updateTheme = (patch: Partial<ThemeSettings>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    queueSave(next);
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    void onSave({ theme: DEFAULT_THEME });
  };

  return (
    <div className="space-y-6 p-4" data-no-drag>
      <section>
        <div className="mb-4 flex items-start justify-between gap-3 px-0.5">
          <div>
            <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] t-faint">
              Colors
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed t-muted">
              Customize the clipboard appearance. Changes apply live.
            </p>
          </div>
          <button
            type="button"
            disabled={saving || isDefaultTheme(theme)}
            onClick={() => resetTheme()}
            className="shrink-0 rounded-[var(--mezmer-radius-sm)] border border-[var(--color-border-soft)] px-2.5 py-1 text-[10px] font-medium t-muted transition hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset theme
          </button>
        </div>

        <div className="space-y-5">
          <ThemeSection title="Accent & borders">
            <ColorField
              label="Accent"
              hint="Highlights, buttons, and selection glow"
              value={theme.accent}
              disabled={saving}
              onChange={(accent) => updateTheme({ accent })}
            />
            <ColorField
              label="Borders"
              hint="Panel edges, inputs, and dividers"
              value={theme.border}
              disabled={saving}
              onChange={(border) => updateTheme({ border })}
            />
          </ThemeSection>

          <ThemeSection title="Surfaces">
            <ColorField
              label="Background"
              hint="Main clipboard window background"
              value={theme.viewBg}
              disabled={saving}
              onChange={(viewBg) => updateTheme({ viewBg })}
            />
            <ColorField
              label="Surface"
              hint="Header, footer, and card surfaces"
              value={theme.panel}
              disabled={saving}
              onChange={(panel) => updateTheme({ panel })}
            />
            <ColorField
              label="Input fields"
              hint="Search bar and text inputs"
              value={theme.input}
              disabled={saving}
              onChange={(input) => updateTheme({ input })}
            />
            <ColorField
              label="Elevated"
              hint="Hover states, tabs, and raised elements"
              value={theme.elevated}
              disabled={saving}
              onChange={(elevated) => updateTheme({ elevated })}
            />
          </ThemeSection>

          <ThemeSection title="Text">
            <ColorField
              label="Primary text"
              hint="Main labels and clip content"
              value={theme.text}
              disabled={saving}
              onChange={(text) => updateTheme({ text })}
            />
            <ColorField
              label="Muted text"
              hint="Secondary labels and descriptions"
              value={theme.muted}
              disabled={saving}
              onChange={(muted) => updateTheme({ muted })}
            />
            <ColorField
              label="Faint text"
              hint="Hints, counts, and placeholders"
              value={theme.faint}
              disabled={saving}
              onChange={(faint) => updateTheme({ faint })}
            />
          </ThemeSection>
        </div>
      </section>
    </div>
  );
}
