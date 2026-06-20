import type { ClipFilterTab } from "./clipFilter";

export interface ClipRecord {
  id: number;
  kind: "text" | "url" | "image" | "files";
  content: string | null;
  preview: string;
  imagePath: string | null;
  pinned: boolean;
  createdAt: string;
  htmlContent?: string | null;
  hasHtmlContent?: boolean;
}

export type CopyMode = "default" | "plainText" | "formatted";

export interface ThemeSettings {
  accent: string;
  border: string;
  viewBg: string;
  panel: string;
}

export interface SavedColor {
  id: number;
  hex: string;
  r: number;
  g: number;
  b: number;
  createdAt: string;
}

export interface AppSettings {
  maxHistory: number;
  mezmerPairingEnabled: boolean;
  mezmerForwardFolderId: number | null;
  theme: ThemeSettings;
  pickerHotkey: string;
  windowsClipboardHistoryBackup: number | null;
  windowsDisabledHotkeysBackup: string | null;
  keepPickerOpenOnCopy: boolean;
  autostartEnabled: boolean;
  carouselMode: boolean;
  lastClipFilter: ClipFilterTab;
  openOnCursorMonitor: boolean;
  hidePreviewsFromCapture: boolean;
  listImagePreviewHeight: number;
  pickerNavPrevKey: string;
  pickerNavNextKey: string;
  pickerCopyKey: string;
  pickerCloseKey: string;
}

export const LIST_IMAGE_PREVIEW_HEIGHT_MIN = 80;
export const LIST_IMAGE_PREVIEW_HEIGHT_MAX = 400;
export const DEFAULT_LIST_IMAGE_PREVIEW_HEIGHT = 220;

export interface MezmerHealth {
  ok: boolean;
  app: string;
  version: string;
  port: number;
}

export interface MezmerFolder {
  id: number;
  name: string;
  parentId: number | null;
  position: number;
  createdAt: string;
  fileCount: number;
  color: string | null;
  banner: string | null;
  bgColor: string | null;
  isLocked: boolean;
  passwordHint: string | null;
  isUnlocked: boolean;
}

export interface MezmerFileRecord {
  id: number;
  name: string;
  [key: string]: unknown;
}
