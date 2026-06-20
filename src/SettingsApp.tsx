import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { SettingsContent } from "./components/SettingsContent";
import { IconClose } from "./components/icons";
import { useAppTheme } from "./hooks/useAppTheme";
import { api } from "./lib/api";
import type { AppSettings } from "./lib/types";
import { beginWindowDrag } from "./lib/windowDrag";

export default function SettingsApp() {
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useAppTheme(settings);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await api.getSettings();
        if (!cancelled) setSettings(s);
      } catch {
        // SettingsContent handles its own load errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<AppSettings>("settings-changed", (event) => {
      setSettings(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void api.hideSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="clipboard-app clipboard-app--settings animate-fade flex flex-col">
      <header className="clipboard-header flex shrink-0 flex-col">
        <div className="clipboard-header-top">
          <div
            className="clipboard-header-drag-layer"
            aria-hidden="true"
            onPointerDown={beginWindowDrag}
          />
          <div className="clipboard-header-toolbar flex w-full items-center justify-between gap-2 px-3 py-2.5">
            <h2 className="text-[13px] font-semibold tracking-tight t-text">
              Settings
            </h2>
            <button
              type="button"
              data-no-drag
              onClick={() => void api.hideSettings()}
              className="clipboard-icon-btn"
              title="Close settings"
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SettingsContent onSaved={setToast} onError={setToast} />
      </div>

      {toast ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="mezmer-popup-surface flex items-center gap-2 px-3.5 py-2 text-[11px] t-text">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
