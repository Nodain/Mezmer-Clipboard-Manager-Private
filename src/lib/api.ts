import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ClipRecord, CopyMode, GifItem, SavedColor } from "./types";

export const api = {
  listClips: (search?: string, limit?: number) =>
    invoke<ClipRecord[]>("list_clips", { search, limit }),

  deleteClip: (id: number) => invoke<void>("delete_clip", { id }),

  clearClips: (keepPinned = true) =>
    invoke<void>("clear_clips", { keepPinned }),

  togglePin: (id: number) => invoke<boolean>("toggle_pin", { id }),

  copyClip: (id: number, mode?: CopyMode) =>
    invoke<{ ok: boolean }>("copy_clip", { id, mode }),

  getClipImage: (id: number, thumbnail = false) =>
    invoke<{ base64: string; mime: string }>("get_clip_image", { id, thumbnail }),

  getSettings: () => invoke<AppSettings>("get_settings"),

  setSettings: (settings: AppSettings) =>
    invoke<AppSettings>("set_settings", { settings }),

  hidePicker: () => invoke<void>("hide_picker"),

  showSettings: () => invoke<void>("show_settings"),

  hideSettings: () => invoke<void>("hide_settings"),

  listSavedColors: (limit?: number) =>
    invoke<SavedColor[]>("list_saved_colors", { limit }),

  deleteSavedColor: (id: number) => invoke<void>("delete_saved_color", { id }),

  copySavedColor: (id: number) =>
    invoke<{ ok: boolean }>("copy_saved_color", { id }),

  startEyedropper: () => invoke<void>("start_eyedropper"),

  cancelEyedropper: () => invoke<void>("cancel_eyedropper"),

  pickScreenColor: () => invoke<SavedColor>("pick_screen_color"),

  copyText: (text: string) => invoke<{ ok: boolean }>("copy_text", { text }),

  copyImageUrl: (url: string) =>
    invoke<{ ok: boolean }>("copy_image_url", { url }),

  searchGifs: (apiKey: string, query?: string, limit?: number) =>
    invoke<GifItem[]>("search_gifs", { apiKey, query, limit }),
};
