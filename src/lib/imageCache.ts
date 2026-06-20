import { api } from "./api";

const cache = new Map<number, string>();
const inflight = new Map<number, Promise<string | null>>();

export function getCachedClipThumb(id: number): string | null {
  return cache.get(id) ?? null;
}

export function clearImageCache(): void {
  cache.clear();
  inflight.clear();
}

export function pruneImageCache(validIds: Iterable<number>): void {
  const keep = new Set(validIds);
  for (const id of cache.keys()) {
    if (!keep.has(id)) cache.delete(id);
  }
  for (const id of inflight.keys()) {
    if (!keep.has(id)) inflight.delete(id);
  }
}

export async function getClipThumbUrl(id: number): Promise<string | null> {
  const cached = cache.get(id);
  if (cached) return cached;

  const pending = inflight.get(id);
  if (pending) return pending;

  const request = api
    .getClipImage(id, true)
    .catch(() => api.getClipImage(id, false))
    .then((img) => {
      const url = `data:${img.mime};base64,${img.base64}`;
      cache.set(id, url);
      inflight.delete(id);
      return url;
    })
    .catch(() => {
      inflight.delete(id);
      return null;
    });

  inflight.set(id, request);
  return request;
}
