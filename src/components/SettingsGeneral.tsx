import { useEffect, useState } from "react";
import { checkMezmerHealth, flattenFolders, listMezmerFolders, MEZMER_BASE } from "../lib/mezmer";
import { formatHotkey } from "../lib/hotkey";
import {
  DEFAULT_CLOSE_KEY,
  DEFAULT_COPY_KEY,
  DEFAULT_NAV_NEXT_KEY,
  DEFAULT_NAV_PREV_KEY,
  formatNavKey,
} from "../lib/navKey";
import { autostartPlatformLabel } from "../lib/platform";
import type { AppSettings } from "../lib/types";
import {
  LIST_IMAGE_PREVIEW_HEIGHT_MAX,
  LIST_IMAGE_PREVIEW_HEIGHT_MIN,
} from "../lib/types";
import { HotkeyField } from "./HotkeyField";
import { NavKeyFields } from "./NavKeyFields";
import { Toggle } from "./Toggle";

export function SettingsGeneral({
  settings,
  saving,
  onSave,
}: {
  settings: AppSettings;
  saving: boolean;
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
}) {
  const [mezmerHealth, setMezmerHealth] = useState<Awaited<
    ReturnType<typeof checkMezmerHealth>
  > | null>(null);
  const [mezmerChecking, setMezmerChecking] = useState(false);
  const [mezmerFolders, setMezmerFolders] = useState<
    Array<{ id: number; name: string; depth: number }>
  >([]);
  const [mezmerFoldersLoading, setMezmerFoldersLoading] = useState(false);
  const [mezmerFoldersError, setMezmerFoldersError] = useState<string | null>(
    null,
  );
  const [maxHistory, setMaxHistory] = useState(settings.maxHistory);
  const [listImagePreviewHeight, setListImagePreviewHeight] = useState(
    settings.listImagePreviewHeight,
  );

  useEffect(() => {
    setMaxHistory(settings.maxHistory);
  }, [settings.maxHistory]);

  useEffect(() => {
    setListImagePreviewHeight(settings.listImagePreviewHeight);
  }, [settings.listImagePreviewHeight]);

  useEffect(() => {
    if (!settings.mezmerPairingEnabled) {
      setMezmerHealth(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      setMezmerChecking(true);
      const health = await checkMezmerHealth();
      if (!cancelled) {
        setMezmerHealth(health);
        setMezmerChecking(false);
      }
    };
    void poll();
    const id = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [settings.mezmerPairingEnabled]);

  const connected = !!mezmerHealth;

  useEffect(() => {
    if (!settings.mezmerPairingEnabled || !connected) {
      setMezmerFolders([]);
      setMezmerFoldersError(null);
      setMezmerFoldersLoading(false);
      return;
    }

    let cancelled = false;
    const loadFolders = async () => {
      setMezmerFoldersLoading(true);
      setMezmerFoldersError(null);
      try {
        const list = await listMezmerFolders();
        if (cancelled) return;
        setMezmerFolders(
          flattenFolders(list).map((folder) => ({
            id: folder.id,
            name: folder.name,
            depth: folder.depth,
          })),
        );
      } catch (error) {
        if (!cancelled) {
          setMezmerFolders([]);
          setMezmerFoldersError(String(error));
        }
      } finally {
        if (!cancelled) setMezmerFoldersLoading(false);
      }
    };

    void loadFolders();
    return () => {
      cancelled = true;
    };
  }, [connected, settings.mezmerPairingEnabled]);

  return (
    <div className="space-y-4 p-4" data-no-drag>
      <section>
        <h3 className="mb-2 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] t-faint">
          Shortcut
        </h3>
        <HotkeyField
          value={settings.pickerHotkey}
          disabled={saving}
          onChange={(pickerHotkey) => void onSave({ pickerHotkey })}
        />

        <div className="mt-4 space-y-3">
          <p className="mb-2 px-0.5 text-[11px] t-muted">Keyboard navigation</p>
          <NavKeyFields
            leftLabel="Previous item"
            rightLabel="Next item"
            leftKey={settings.pickerNavPrevKey}
            rightKey={settings.pickerNavNextKey}
            defaultLeftKey={DEFAULT_NAV_PREV_KEY}
            defaultRightKey={DEFAULT_NAV_NEXT_KEY}
            disabled={saving}
            onChange={({ leftKey, rightKey }) =>
              void onSave({
                pickerNavPrevKey: leftKey,
                pickerNavNextKey: rightKey,
              })
            }
          />
          <NavKeyFields
            leftLabel="Copy selected"
            rightLabel="Close picker"
            leftKey={settings.pickerCopyKey}
            rightKey={settings.pickerCloseKey}
            defaultLeftKey={DEFAULT_COPY_KEY}
            defaultRightKey={DEFAULT_CLOSE_KEY}
            disabled={saving}
            showHint={false}
            onChange={({ leftKey, rightKey }) =>
              void onSave({
                pickerCopyKey: leftKey,
                pickerCloseKey: rightKey,
              })
            }
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] t-faint">
          History
        </h3>
        <label className="block px-0.5">
          <span className="mb-1.5 block text-[11px] t-muted">
            Max items (unpinned)
          </span>
          <input
            type="number"
            min={20}
            max={2000}
            value={maxHistory}
            onChange={(e) => setMaxHistory(Number(e.target.value))}
            onBlur={() => void onSave({ maxHistory })}
            className="w-full px-2.5 py-1.5 text-sm"
          />
        </label>
      </section>

      <section>
        <h3 className="mb-2 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] t-faint">
          Behavior
        </h3>
        <div className="space-y-2">
          <Toggle
            on={settings.keepPickerOpenOnCopy}
            disabled={saving}
            onChange={(on) => void onSave({ keepPickerOpenOnCopy: on })}
            title="Keep picker open when copying"
            desc="Disable auto-closing the clipboard when copying an item"
          />
          <Toggle
            on={settings.autostartEnabled}
            disabled={saving}
            onChange={(on) => void onSave({ autostartEnabled: on })}
            title={autostartPlatformLabel()}
            desc="Also listed in Windows Settings → Apps → Startup, where you can turn it on or off"
          />
          <Toggle
            on={settings.carouselMode}
            disabled={saving}
            onChange={(on) => void onSave({ carouselMode: on })}
            title="Display clipboard in a carousel"
            desc="Dock at the bottom center and browse clips left and right"
          />
          <label className="block px-0.5">
            <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px] t-muted">
              <span>List image preview size</span>
              <span className="tabular-nums text-[10px] t-faint">
                {listImagePreviewHeight}px
              </span>
            </span>
            <input
              type="range"
              min={LIST_IMAGE_PREVIEW_HEIGHT_MIN}
              max={LIST_IMAGE_PREVIEW_HEIGHT_MAX}
              step={10}
              disabled={saving}
              value={listImagePreviewHeight}
              onChange={(e) => {
                const next = Number(e.target.value);
                setListImagePreviewHeight(next);
                void onSave({ listImagePreviewHeight: next });
              }}
            />
            <p className="mt-1 text-[10px] leading-snug t-faint">
              Height of image thumbnails when not using carousel mode
            </p>
          </label>
          <Toggle
            on={settings.openOnCursorMonitor}
            disabled={saving}
            onChange={(on) => void onSave({ openOnCursorMonitor: on })}
            title="Open on cursor monitor"
            desc="Show on whichever monitor your cursor is on"
          />
          <Toggle
            on={settings.hidePreviewsFromCapture}
            disabled={saving}
            onChange={(on) => void onSave({ hidePreviewsFromCapture: on })}
            title="Hide from screen share"
            desc="The picker stays visible to you but appears black in Discord, OBS, and similar capture (Windows)"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 px-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] t-faint">
          Mezmer pairing
        </h3>
        <Toggle
          on={settings.mezmerPairingEnabled}
          disabled={saving}
          onChange={(on) => void onSave({ mezmerPairingEnabled: on })}
          title="Connect to Mezmer"
          desc="Automatically send copied images and URLs to your Mezmer library"
        />

        {settings.mezmerPairingEnabled ? (
          <div className="mt-3 rounded-[var(--mezmer-radius-sm)] border border-[var(--color-border-soft)] bg-[color-mix(in_srgb,var(--color-panel)_50%,transparent)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  mezmerChecking
                    ? "animate-pulse bg-[var(--color-muted)]"
                    : connected
                      ? "bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153/50%)]"
                      : "bg-red-400/90"
                }`}
              />
              <span className="t-text">
                {mezmerChecking
                  ? "Checking…"
                  : connected
                    ? `Connected · Mezmer ${mezmerHealth?.version}`
                    : "Disconnected"}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed t-muted">
              Requires Mezmer running with{" "}
              <span className="t-text">Settings → Extension</span> enabled.
              Bridge at <span className="t-text">{MEZMER_BASE}</span>.
            </p>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[11px] t-muted">
                Forward copied items to
              </span>
              <select
                value={settings.mezmerForwardFolderId ?? ""}
                disabled={
                  saving || !connected || mezmerFoldersLoading || !!mezmerFoldersError
                }
                onChange={(event) =>
                  void onSave({
                    mezmerForwardFolderId:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                className="w-full px-2.5 py-1.5 text-sm"
              >
                <option value="">Library root</option>
                {mezmerFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {"—".repeat(folder.depth)}
                    {folder.depth > 0 ? " " : ""}
                    {folder.name}
                  </option>
                ))}
              </select>
              {mezmerFoldersLoading ? (
                <p className="mt-1 text-[10px] t-faint">Loading folders…</p>
              ) : mezmerFoldersError ? (
                <p className="mt-1 text-[10px] text-red-400">{mezmerFoldersError}</p>
              ) : !connected ? (
                <p className="mt-1 text-[10px] t-faint">
                  Connect to Mezmer to choose a folder.
                </p>
              ) : null}
            </label>
          </div>
        ) : null}
      </section>

      <p className="px-0.5 text-[10px] t-faint">
        {formatHotkey(settings.pickerHotkey)} toggles the picker ·{" "}
        {formatNavKey(settings.pickerCopyKey)} copies ·{" "}
        {formatNavKey(settings.pickerCloseKey)} closes
      </p>
    </div>
  );
}
