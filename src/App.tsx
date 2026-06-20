import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ClipFilterTabs } from "./components/ClipFilterTabs";
import { PickerMainContent } from "./components/PickerMainContent";
import { IconCheck, IconClose, IconSearch, IconSettings } from "./components/icons";
import { SaveToMezmerModal } from "./components/SaveToMezmerModal";
import { Toast } from "./components/Toast";
import { useAppTheme } from "./hooks/useAppTheme";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { api } from "./lib/api";
import {
  filterClipsByTab,
  tabClipCount,
  type ClipFilterTab,
} from "./lib/clipFilter";
import { formatHotkey } from "./lib/hotkey";
import {
  DEFAULT_CLOSE_KEY,
  DEFAULT_COPY_KEY,
  DEFAULT_NAV_NEXT_KEY,
  DEFAULT_NAV_PREV_KEY,
  isTypingTarget,
  matchesNavKey,
} from "./lib/navKey";
import { useStore } from "./lib/store";
import { prefetchClipThumbs } from "./hooks/useClipThumb";
import { pruneImageCache } from "./lib/imageCache";
import type { AppSettings, CopyMode, SavedColor } from "./lib/types";

export default function App() {
  const clips = useStore((s) => s.clips);
  const search = useStore((s) => s.search);
  const clipFilter = useStore((s) => s.clipFilter);
  const settings = useStore((s) => s.settings);
  const saveModalClipId = useStore((s) => s.saveModalClipId);
  const setClips = useStore((s) => s.setClips);
  const setSearch = useStore((s) => s.setSearch);
  const setClipFilter = useStore((s) => s.setClipFilter);
  const setSettings = useStore((s) => s.setSettings);
  const setSaveModalClipId = useStore((s) => s.setSaveModalClipId);
  const setToast = useStore((s) => s.setToast);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [footerNotice, setFooterNotice] = useState<string | null>(null);
  const footerNoticeTimer = useRef<number>();
  const [loading, setLoading] = useState(true);
  const [clipsReady, setClipsReady] = useState(false);
  const [savedColors, setSavedColors] = useState<SavedColor[]>([]);
  const debouncedSearch = useDebouncedValue(search, 250);
  const refreshTimer = useRef<number>();

  useAppTheme(settings);

  const refreshColors = useCallback(async () => {
    const list = await api.listSavedColors(100);
    setSavedColors(list);
  }, []);

  const refresh = useCallback(
    async (filterOverride?: ClipFilterTab) => {
      const list = await api.listClips(debouncedSearch || undefined, 150);
      pruneImageCache(list.filter((c) => c.kind === "image").map((c) => c.id));
      setClips(list);
      const filter = filterOverride ?? useStore.getState().clipFilter;
      const visible = filterClipsByTab(list, filter);
      setSelectedId((prev) =>
        prev && visible.some((c) => c.id === prev) ? prev : (visible[0]?.id ?? null),
      );
      setClipsReady(true);
    },
    [debouncedSearch, setClips],
  );

  const scheduleRefresh = useCallback(
    (filterOverride?: ClipFilterTab) => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        void refresh(filterOverride);
      }, 120);
    },
    [refresh],
  );

  const bootstrap = useCallback(async () => {
    const s = await api.getSettings();
    const filter = s.lastClipFilter ?? "text";
    setSettings(s);
    setClipFilter(filter);
    void refreshColors();
    setLoading(false);
  }, [refreshColors, setClipFilter, setSettings]);

  useEffect(() => {
    const visible = filterClipsByTab(clips, clipFilter);
    setSelectedId((prev) =>
      prev && visible.some((c) => c.id === prev) ? prev : (visible[0]?.id ?? null),
    );
  }, [clipFilter, clips]);

  useEffect(() => {
    if (clipFilter !== "color") return;
    setSelectedColorId((prev) =>
      prev && savedColors.some((color) => color.id === prev)
        ? prev
        : (savedColors[0]?.id ?? null),
    );
  }, [clipFilter, savedColors]);

  const tabCounts = useMemo(
    () => ({
      pinned: tabClipCount(clips, "pinned"),
      text: tabClipCount(clips, "text"),
      image: tabClipCount(clips, "image"),
      color: savedColors.length,
    }),
    [clips, savedColors.length],
  );

  const filteredClips = useMemo(
    () => filterClipsByTab(clips, clipFilter),
    [clips, clipFilter],
  );

  useEffect(() => {
    prefetchClipThumbs(clips.filter((clip) => clip.kind === "image"));
  }, [clips]);

  const bootstrapped = useRef(false);

  useEffect(() => {
    return () => window.clearTimeout(refreshTimer.current);
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cancelled = false;
    void (async () => {
      try {
        await bootstrap();
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  useEffect(() => {
    if (loading) return;
    void refresh();
  }, [refresh, loading]);

  useEffect(() => {
    if (clipFilter !== "color") return;
    setSelectedColorId((prev) =>
      prev && savedColors.some((color) => color.id === prev)
        ? prev
        : (savedColors[0]?.id ?? null),
    );
  }, [clipFilter, savedColors]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    void (async () => {
      unsubs.push(
        await listen<AppSettings>("picker-shown", (event) => {
          const filter = event.payload.lastClipFilter ?? "text";
          setSettings(event.payload);
          setClipFilter(filter);
          setLoading(false);
          void refresh(filter);
          void refreshColors();
        }),
      );
      unsubs.push(
        await listen("clip-added", () => {
          scheduleRefresh();
        }),
      );
      unsubs.push(
        await listen<string>("mezmer-import-failed", (event) => {
          setToast(`Mezmer: ${event.payload}`);
        }),
      );
      unsubs.push(
        await listen("settings-changed", (event) => {
          setSettings(event.payload as NonNullable<typeof settings>);
        }),
      );
      unsubs.push(
        await listen("colors-updated", () => {
          const current = useStore.getState().settings;
          setClipFilter("color");
          if (current && current.lastClipFilter !== "color") {
            const next = { ...current, lastClipFilter: "color" as const };
            setSettings(next);
            void api.setSettings(next);
          }
          void refreshColors();
        }),
      );
      unsubs.push(
        await listen("open-settings", () => {
          void api.showSettings();
        }),
      );
    })();
    return () => {
      for (const u of unsubs) u();
    };
  }, [refresh, scheduleRefresh, setSettings, refreshColors, setClipFilter, setLoading, setToast]);

  const carouselMode = settings?.carouselMode === true;

  const showFooterNotice = useCallback((message: string) => {
    setFooterNotice(message);
    window.clearTimeout(footerNoticeTimer.current);
    footerNoticeTimer.current = window.setTimeout(() => setFooterNotice(null), 1600);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(footerNoticeTimer.current);
  }, []);

  const showCopied = useCallback(() => {
    showFooterNotice("Copied");
  }, [showFooterNotice]);

  const copySelected = useCallback(
    async (id: number, mode?: CopyMode) => {
      try {
        await api.copyClip(id, mode);
        showCopied();
        if (!settings?.keepPickerOpenOnCopy) {
          await api.hidePicker();
        }
      } catch {
        // silent
      }
    },
    [settings?.keepPickerOpenOnCopy, showCopied],
  );

  const handleClipFilterChange = useCallback(
    (tab: ClipFilterTab) => {
      setClipFilter(tab);
      const current = useStore.getState().settings;
      if (!current || current.lastClipFilter === tab) return;
      const next = { ...current, lastClipFilter: tab };
      setSettings(next);
      void api.setSettings(next);
    },
    [setClipFilter, setSettings],
  );

  const copyColor = useCallback(
    async (id: number) => {
      try {
        await api.copySavedColor(id);
        showCopied();
        if (!settings?.keepPickerOpenOnCopy) {
          await api.hidePicker();
        }
      } catch {
        // silent
      }
    },
    [settings?.keepPickerOpenOnCopy, showCopied],
  );

  useEffect(() => {
    const navPrev = settings?.pickerNavPrevKey ?? DEFAULT_NAV_PREV_KEY;
    const navNext = settings?.pickerNavNextKey ?? DEFAULT_NAV_NEXT_KEY;
    const copyKey = settings?.pickerCopyKey ?? DEFAULT_COPY_KEY;
    const closeKey = settings?.pickerCloseKey ?? DEFAULT_CLOSE_KEY;

    const onKey = (e: KeyboardEvent) => {
      if (matchesNavKey(e, closeKey)) {
        if (saveModalClipId != null) {
          setSaveModalClipId(null);
          return;
        }
        void api.hidePicker();
        return;
      }

      if (saveModalClipId != null || isTypingTarget(e.target)) return;

      if (clipFilter === "color" && savedColors.length > 0) {
        const idx = savedColors.findIndex((color) => color.id === selectedColorId);
        if (matchesNavKey(e, navPrev) && idx > 0) {
          e.preventDefault();
          setSelectedColorId(savedColors[idx - 1]!.id);
          return;
        }
        if (matchesNavKey(e, navNext) && idx < savedColors.length - 1) {
          e.preventDefault();
          setSelectedColorId(savedColors[idx + 1]!.id);
          return;
        }
      } else if (clipFilter !== "color" && filteredClips.length > 0) {
        const idx = filteredClips.findIndex((clip) => clip.id === selectedId);
        if (matchesNavKey(e, navPrev) && idx > 0) {
          e.preventDefault();
          setSelectedId(filteredClips[idx - 1]!.id);
          return;
        }
        if (matchesNavKey(e, navNext) && idx < filteredClips.length - 1) {
          e.preventDefault();
          setSelectedId(filteredClips[idx + 1]!.id);
          return;
        }
      }

      if (matchesNavKey(e, copyKey)) {
        e.preventDefault();
        if (clipFilter === "color" && selectedColorId != null) {
          void copyColor(selectedColorId);
        } else if (selectedId != null) {
          void copySelected(selectedId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedId,
    selectedColorId,
    saveModalClipId,
    setSaveModalClipId,
    clipFilter,
    filteredClips,
    savedColors,
    copySelected,
    copyColor,
    settings?.pickerNavPrevKey,
    settings?.pickerNavNextKey,
    settings?.pickerCopyKey,
    settings?.pickerCloseKey,
  ]);

  const saveClip = clips.find((c) => c.id === saveModalClipId) ?? null;

  if (loading || !settings || !clipsReady) {
    return (
      <div className="clipboard-app items-center justify-center">
        <span className="inline-block h-5 w-5 animate-spin-slow rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  const selectedIndex = filteredClips.findIndex((clip) => clip.id === selectedId);
  const selectedColorIndex = savedColors.findIndex((color) => color.id === selectedColorId);

  const clipsEmptyTitle =
    search && clipFilter === "text"
      ? "No matches"
      : clipFilter === "text"
        ? "No text"
        : clips.length === 0
          ? "Mezmerize"
          : clipFilter === "pinned"
            ? "No pins"
            : `No ${clipFilter}`;

  const clipsEmptyHint =
    search && clipFilter === "text"
      ? undefined
      : clips.length === 0
        ? settings?.pickerHotkey
          ? `${formatHotkey(settings.pickerHotkey)} to open`
          : undefined
        : clipFilter === "pinned"
          ? "Pin from another tab"
          : undefined;

  return (
    <div
      className={`clipboard-app animate-fade${carouselMode ? " clipboard-app--carousel" : ""}`}
    >
      <header className="clipboard-header flex shrink-0 flex-col">
        <div className="clipboard-header-top">
          <div className="clipboard-header-drag-layer" aria-hidden="true" />
          <div className="clipboard-header-toolbar flex w-full items-center gap-2 px-3 py-1.5">
            <div className="clipboard-search-wrap" data-no-drag>
              <IconSearch size={13} />
              <input
                type="search"
                placeholder="Search history…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="clipboard-search"
                autoFocus
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-0.5" data-no-drag>
            <button
              type="button"
              onClick={() => void api.showSettings()}
              className="clipboard-icon-btn clipboard-icon-btn--accent"
              title="Settings"
            >
              <IconSettings size={14} />
            </button>
            <button
              type="button"
              onClick={() => void api.hidePicker()}
              className="clipboard-icon-btn"
              title="Close"
            >
              <IconClose size={14} />
            </button>
          </div>
          </div>
        </div>
        {!carouselMode ? (
          <div className="clipboard-header-tabs">
            <ClipFilterTabs
              active={clipFilter}
              counts={tabCounts}
              variant="header"
              onChange={handleClipFilterChange}
            />
          </div>
        ) : null}
      </header>

      <main
        className={`min-h-0 flex-1 px-2 py-2 data-no-drag ${
          carouselMode ? "clipboard-main--carousel" : "overflow-y-auto"
        }`}
      >
        <PickerMainContent
          clipFilter={clipFilter}
          carouselMode={carouselMode}
          filteredClips={filteredClips}
          savedColors={savedColors}
          selectedId={selectedId}
          selectedColorId={selectedColorId}
          clipsEmptyTitle={clipsEmptyTitle}
          clipsEmptyHint={clipsEmptyHint}
          mezmerEnabled={!!settings.mezmerPairingEnabled}
          onSelectClip={setSelectedId}
          onSelectColor={setSelectedColorId}
          onCopyClip={(id, mode) => void copySelected(id, mode)}
          onCopyColor={(id) => void copyColor(id)}
          onPin={async (id) => {
            await api.togglePin(id);
            void refresh();
          }}
          onDelete={async (id) => {
            await api.deleteClip(id);
            void refresh();
          }}
          onSaveToMezmer={setSaveModalClipId}
          onRefreshColors={() => void refreshColors()}
          onShowCopied={showCopied}
        />
      </main>

      <footer className="clipboard-footer" data-no-drag>
        {carouselMode ? (
          <div className="clipboard-footer-row">
            <div className="clipboard-footer-side clipboard-footer-side--left">
              <span className="min-w-0 text-[10px] tracking-wide">
                {footerNotice ? (
                  <span className="clipboard-footer-notice animate-fade">
                    <span className="clipboard-footer-notice-check" aria-hidden="true">
                      <IconCheck size={11} />
                    </span>
                    {footerNotice}
                  </span>
                ) : (
                  <span className="t-faint">
                    {clipFilter === "color"
                      ? savedColors.length > 0
                        ? `${Math.max(0, selectedColorIndex) + 1} / ${savedColors.length}`
                        : `${savedColors.length} ${savedColors.length === 1 ? "color" : "colors"}`
                      : filteredClips.length > 0
                        ? `${Math.max(0, selectedIndex) + 1} / ${filteredClips.length}`
                        : `${filteredClips.length} ${filteredClips.length === 1 ? "clip" : "clips"}`}
                    {clipFilter === "text" && search ? ` · ${clips.length} total` : ""}
                  </span>
                )}
              </span>
            </div>

            <ClipFilterTabs
              active={clipFilter}
              counts={tabCounts}
              onChange={handleClipFilterChange}
            />

            <div className="clipboard-footer-side clipboard-footer-side--right">
              {clipFilter !== "color" ? (
                <button
                  type="button"
                  onClick={async () => {
                    await api.clearClips(true);
                    void refresh();
                    showFooterNotice("Cleared unpinned clips");
                  }}
                  className="text-[10px] font-medium t-muted transition hover:text-[var(--color-text)]"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="clipboard-footer-row clipboard-footer-row--list">
            <span className="min-w-0 text-[10px] tracking-wide">
              {footerNotice ? (
                <span className="clipboard-footer-notice animate-fade">
                  <span className="clipboard-footer-notice-check" aria-hidden="true">
                    <IconCheck size={11} />
                  </span>
                  {footerNotice}
                </span>
              ) : (
                <span className="t-faint">
                  {clipFilter === "color"
                    ? `${savedColors.length} ${savedColors.length === 1 ? "color" : "colors"}`
                    : `${filteredClips.length} ${filteredClips.length === 1 ? "clip" : "clips"}`}
                  {clipFilter === "text" && search ? ` · ${clips.length} total` : ""}
                </span>
              )}
            </span>
            {clipFilter !== "color" ? (
              <button
                type="button"
                onClick={async () => {
                  await api.clearClips(true);
                  void refresh();
                  showFooterNotice("Cleared unpinned clips");
                }}
                className="text-[10px] font-medium t-muted transition hover:text-[var(--color-text)]"
              >
                Clear
              </button>
            ) : null}
          </div>
        )}
      </footer>

      {saveClip ? (
        <SaveToMezmerModal
          clip={saveClip}
          onClose={() => setSaveModalClipId(null)}
        />
      ) : null}
      <Toast />
    </div>
  );
}
