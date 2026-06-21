import { AppLogo } from "./AppLogo";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  flattenFolders,
  importToMezmer,
  listMezmerFolders,
} from "../lib/mezmer";
import type { ClipRecord } from "../lib/types";
import { useStore } from "../lib/store";

function kindLabel(kind: ClipRecord["kind"]) {
  switch (kind) {
    case "image":
      return "Image";
    case "url":
      return "URL";
    case "files":
      return "Files";
    default:
      return "Text";
  }
}

export function SaveToMezmerModal({
  clip,
  onClose,
}: {
  clip: ClipRecord;
  onClose: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const setToast = useStore((s) => s.setToast);
  const [folders, setFolders] = useState<
    Array<{ id: number; name: string; depth: number }>
  >([]);
  const [folderId, setFolderId] = useState<number | "">(
    settings?.mezmerForwardFolderId ?? "",
  );
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFolderId(settings?.mezmerForwardFolderId ?? "");
  }, [settings?.mezmerForwardFolderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listMezmerFolders();
        if (cancelled) return;
        setFolders(
          flattenFolders(list).map((f) => ({
            id: f.id,
            name: f.name,
            depth: f.depth,
          })),
        );
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canImport = clip.kind === "image" || clip.kind === "url";

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    setError(null);
    try {
      const folder =
        folderId === "" ? undefined : { folderId: Number(folderId) };

      if (clip.kind === "url") {
        const url = clip.content?.trim();
        if (!url) throw new Error("Missing URL");
        await importToMezmer({ url, ...folder });
      } else {
        const img = await api.getClipImage(clip.id);
        await importToMezmer({
          data: img.base64,
          name: `clipboard-${clip.id}.png`,
          ...folder,
        });
      }
      setToast("Saved to Mezmer Desktop");
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-[2px] animate-fade"
      data-no-drag
      onClick={onClose}
    >
      <div
        className="mezmer-popup-surface w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--color-border-soft)] px-4 py-3">
          <div className="flex items-center gap-2">
            <AppLogo size={20} />
            <h2 className="text-[13px] font-semibold tracking-tight t-text">
              Save to Mezmer Desktop
            </h2>
          </div>
          <p className="mt-1 truncate text-[11px] t-muted">
            {kindLabel(clip.kind)} · {clip.preview}
          </p>
        </div>

        <div className="space-y-3 p-4" data-no-drag>
          {!canImport ? (
            <p className="text-[12px] t-muted">
              Only image and URL clips can be sent to Mezmer Desktop in v1.
            </p>
          ) : loading ? (
            <p className="text-[12px] t-muted">Loading folders…</p>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-[11px] t-muted">
                Target folder (optional)
              </span>
              <select
                value={folderId}
                onChange={(e) =>
                  setFolderId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="w-full px-2.5 py-1.5 text-sm"
              >
                <option value="">Library root</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {"—".repeat(f.depth)}
                    {f.depth > 0 ? " " : ""}
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error ? (
            <p className="text-[11px] text-red-400">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--mezmer-radius-sm)] px-3 py-1.5 text-[11px] t-muted transition hover:bg-[color-mix(in_srgb,var(--color-panel-2)_70%,transparent)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canImport || loading || importing}
              onClick={() => void handleImport()}
              className="rounded-[var(--mezmer-radius-sm)] bg-[var(--color-accent)] px-3.5 py-1.5 text-[11px] font-medium text-white shadow-[0_0_16px_var(--color-accent-glow)] transition hover:brightness-110 disabled:opacity-50"
            >
              {importing ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
