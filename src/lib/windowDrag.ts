import type { PointerEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function beginWindowDrag(e: PointerEvent<HTMLElement>) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
  void getCurrentWindow().startDragging();
}
