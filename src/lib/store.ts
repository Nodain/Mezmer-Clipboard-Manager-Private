import { create } from "zustand";
import type { ClipFilterTab } from "./clipFilter";
import type { AppSettings, ClipRecord } from "./types";

interface Store {
  clips: ClipRecord[];
  search: string;
  clipFilter: ClipFilterTab;
  settings: AppSettings | null;
  saveModalClipId: number | null;
  toast: string | null;

  setClips: (clips: ClipRecord[]) => void;
  setSearch: (search: string) => void;
  setClipFilter: (tab: ClipFilterTab) => void;
  setSettings: (settings: AppSettings) => void;
  setSaveModalClipId: (id: number | null) => void;
  setToast: (msg: string | null) => void;
}

export const useStore = create<Store>((set) => ({
  clips: [],
  search: "",
  clipFilter: "text",
  settings: null,
  saveModalClipId: null,
  toast: null,

  setClips: (clips) => set({ clips }),
  setSearch: (search) => set({ search }),
  setClipFilter: (clipFilter) => set({ clipFilter }),
  setSettings: (settings) => set({ settings }),
  setSaveModalClipId: (saveModalClipId) => set({ saveModalClipId }),
  setToast: (toast) => set({ toast }),
}));
