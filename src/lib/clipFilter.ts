import type { ClipRecord } from "./types";

export type ClipFilterTab = "pinned" | "text" | "image" | "color";

export function filterClipsByTab(
  clips: ClipRecord[],
  tab: ClipFilterTab,
): ClipRecord[] {
  switch (tab) {
    case "pinned":
      return clips.filter((c) => c.pinned);
    case "text":
      return clips.filter(
        (c) =>
          !c.pinned &&
          (c.kind === "text" || c.kind === "url" || c.kind === "files"),
      );
    case "image":
      return clips.filter((c) => !c.pinned && c.kind === "image");
    case "color":
      return [];
  }
}

export function tabClipCount(clips: ClipRecord[], tab: ClipFilterTab): number {
  return filterClipsByTab(clips, tab).length;
}
