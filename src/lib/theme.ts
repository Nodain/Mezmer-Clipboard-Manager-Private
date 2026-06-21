import type { ThemeSettings } from "./types";
import {
  DEFAULT_LIST_IMAGE_PREVIEW_HEIGHT,
  LIST_IMAGE_PREVIEW_HEIGHT_MAX,
  LIST_IMAGE_PREVIEW_HEIGHT_MIN,
} from "./types";

/** Default Mezmer purple sleek theme */
export const DEFAULT_THEME: ThemeSettings = {
  accent: "#7e5ed7",
  border: "#262626",
  viewBg: "#141414",
  panel: "#1a1a1a",
  text: "#ececec",
  muted: "#8a8a8c",
  faint: "#656568",
  input: "#171717",
  elevated: "#242424",
};

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function normalizeHex(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(a: string, b: string, t: number): string {
  const c1 = parseHex(a);
  const c2 = parseHex(b);
  if (!c1 || !c2) return a;
  return toHex(
    c1[0] * (1 - t) + c2[0] * t,
    c1[1] * (1 - t) + c2[1] * t,
    c1[2] * (1 - t) + c2[2] * t,
  );
}

function lighten(hex: string, amount: number): string {
  return mixHex(hex, "#ffffff", amount);
}

function darken(hex: string, amount: number): string {
  return mixHex(hex, "#000000", amount);
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function themeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return normalizeHex(value) ?? fallback;
}

export function sanitizeTheme(theme: Partial<ThemeSettings>): ThemeSettings {
  return {
    accent: themeHex(theme.accent, DEFAULT_THEME.accent),
    border: themeHex(theme.border, DEFAULT_THEME.border),
    viewBg: themeHex(theme.viewBg, DEFAULT_THEME.viewBg),
    panel: themeHex(theme.panel, DEFAULT_THEME.panel),
    text: themeHex(theme.text, DEFAULT_THEME.text),
    muted: themeHex(theme.muted, DEFAULT_THEME.muted),
    faint: themeHex(theme.faint, DEFAULT_THEME.faint),
    input: themeHex(theme.input, DEFAULT_THEME.input),
    elevated: themeHex(theme.elevated, DEFAULT_THEME.elevated),
  };
}

export function isDefaultTheme(theme: Partial<ThemeSettings>): boolean {
  const s = sanitizeTheme(theme);
  return (Object.keys(DEFAULT_THEME) as Array<keyof ThemeSettings>).every(
    (key) => s[key] === DEFAULT_THEME[key],
  );
}

export function applyTheme(theme: Partial<ThemeSettings>): void {
  const t = sanitizeTheme(theme);
  const root = document.documentElement;

  root.style.setProperty("--color-accent", t.accent);
  root.style.setProperty("--color-border", t.border);
  root.style.setProperty("--color-view-bg", t.viewBg);
  root.style.setProperty("--color-panel", t.panel);
  root.style.setProperty("--color-text", t.text);
  root.style.setProperty("--color-muted", t.muted);
  root.style.setProperty("--color-faint", t.faint);
  root.style.setProperty("--color-input", t.input);
  root.style.setProperty("--color-elevated", t.elevated);

  root.style.setProperty("--color-border-soft", mixHex(t.border, t.viewBg, 0.35));
  root.style.setProperty("--color-border-faint", mixHex(t.border, t.viewBg, 0.55));
  root.style.setProperty("--color-panel-2", mixHex(t.panel, t.elevated, 0.45));
  root.style.setProperty("--color-bg", darken(t.viewBg, 0.03));
  root.style.setProperty("--color-sidebar", darken(t.panel, 0.02));
  root.style.setProperty("--color-accent-soft", mixHex(t.accent, t.viewBg, 0.82));
  root.style.setProperty("--color-accent-glow", withAlpha(t.accent, 0.25));
}

export function applyListImagePreviewHeight(height?: number): void {
  const clamped = Math.min(
    LIST_IMAGE_PREVIEW_HEIGHT_MAX,
    Math.max(
      LIST_IMAGE_PREVIEW_HEIGHT_MIN,
      height ?? DEFAULT_LIST_IMAGE_PREVIEW_HEIGHT,
    ),
  );
  document.documentElement.style.setProperty(
    "--clipboard-image-preview-height",
    `${clamped}px`,
  );
}
