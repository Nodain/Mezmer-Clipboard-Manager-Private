import { useCallback, useEffect, useState } from "react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api } from "../lib/api";
import type { GifItem } from "../lib/types";

export function GifPanel({
  apiKey,
  query,
  onCopy,
}: {
  apiKey: string;
  query: string;
  onCopy: (gif: GifItem) => void | Promise<void>;
}) {
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 350);
  const signedIn = apiKey.trim().length > 0;

  const loadGifs = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    try {
      const results = await api.searchGifs(
        apiKey,
        debouncedQuery.trim() || undefined,
      );
      setGifs(results);
    } catch (e) {
      setError(String(e));
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, debouncedQuery, signedIn]);

  useEffect(() => {
    void loadGifs();
  }, [loadGifs]);

  if (!signedIn) {
    return (
      <div className="library-panel flex h-full min-h-0 flex-col items-center justify-center p-4 text-center">
        <p className="max-w-xs text-[11px] leading-relaxed t-muted">
          Add your Klipy API key in Settings to search GIFs.
        </p>
        <button
          type="button"
          onClick={() => void api.showSettings()}
          className="mt-3 rounded-[var(--mezmer-radius-sm)] bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white"
        >
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="library-panel library-panel--gifs flex h-full min-h-0 flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="inline-block h-5 w-5 animate-spin-slow rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : error ? (
        <p className="px-1 text-[11px] text-red-400">{error}</p>
      ) : gifs.length === 0 ? (
        <p className="px-1 text-[11px] t-faint">No GIFs found.</p>
      ) : (
        <div className="library-grid library-grid--gifs min-h-0 flex-1 overflow-y-auto">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              className="library-grid-item library-grid-item--gif"
              onClick={() => void onCopy(gif)}
              title={gif.title || "GIF"}
            >
              <img src={gif.previewUrl} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
