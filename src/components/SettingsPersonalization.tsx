import { useEffect, useRef, useState } from "react";
import { applyTheme, DEFAULT_THEME, isDefaultTheme } from "../lib/theme";
import type { AppSettings, ThemeSettings } from "../lib/types";
import { ColorField } from "./ColorField";

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
    <div className="space-y-4 p-4" data-no-drag>
      <section>
        <div className="mb-3 flex items-start justify-between gap-3 px-0.5">
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

        <div className="space-y-3">
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
        </div>
      </section>
    </div>
  );
}
