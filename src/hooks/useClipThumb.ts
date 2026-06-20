import { useEffect, useState } from "react";
import { getCachedClipThumb, getClipThumbUrl } from "../lib/imageCache";

export function useClipThumb(clipId: number, isImage: boolean) {
  const [thumb, setThumb] = useState<string | null>(() =>
    isImage ? getCachedClipThumb(clipId) : null,
  );

  useEffect(() => {
    if (!isImage) {
      setThumb(null);
      return;
    }

    const cached = getCachedClipThumb(clipId);
    if (cached) {
      setThumb(cached);
      return;
    }

    let cancelled = false;
    void getClipThumbUrl(clipId).then((url) => {
      if (!cancelled) setThumb(url);
    });
    return () => {
      cancelled = true;
    };
  }, [clipId, isImage]);

  return thumb;
}

export function prefetchClipThumbs(clips: Array<{ id: number; kind: string }>) {
  for (const clip of clips) {
    if (clip.kind === "image") {
      void getClipThumbUrl(clip.id);
    }
  }
}
