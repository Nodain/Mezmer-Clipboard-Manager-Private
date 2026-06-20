import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { applyListImagePreviewHeight, applyTheme, sanitizeTheme } from "../lib/theme";
import type { AppSettings } from "../lib/types";
import { SettingsAbout } from "./SettingsAbout";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsPersonalization } from "./SettingsPersonalization";
import { SettingsTabs, type SettingsTab } from "./SettingsTabs";

export function SettingsContent({
  onSaved,
  onError,
}: {
  onSaved?: (msg: string) => void;
  onError?: (msg: string) => void;
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SettingsTab>("general");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await api.getSettings();
        if (!cancelled) setSettings(s);
      } catch (e) {
        onError?.(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme);
  }, [settings?.theme]);

  useEffect(() => {
    applyListImagePreviewHeight(settings?.listImagePreviewHeight);
  }, [settings?.listImagePreviewHeight]);

  const save = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const nextTheme = patch.theme
        ? sanitizeTheme(patch.theme)
        : settings.theme;
      const next = await api.setSettings({
        ...settings,
        ...patch,
        theme: nextTheme,
      });
      setSettings(next);
      onSaved?.("Settings saved");
    } catch (e) {
      onError?.(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="inline-block h-5 w-5 animate-spin-slow rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <>
      <SettingsTabs active={tab} onChange={setTab} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "general" ? (
          <SettingsGeneral
            settings={settings}
            saving={saving}
            onSave={save}
          />
        ) : tab === "personalization" ? (
          <SettingsPersonalization
            settings={settings}
            saving={saving}
            onSave={save}
          />
        ) : (
          <SettingsAbout />
        )}
      </main>
    </>
  );
}
