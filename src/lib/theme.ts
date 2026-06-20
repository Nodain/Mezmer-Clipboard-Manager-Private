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

export function sanitizeTheme(theme: ThemeSettings): ThemeSettings {
  return {
    accent: normalizeHex(theme.accent) ?? DEFAULT_THEME.accent,
    border: normalizeHex(theme.border) ?? DEFAULT_THEME.border,
    viewBg: normalizeHex(theme.viewBg) ?? DEFAULT_THEME.viewBg,
    panel: normalizeHex(theme.panel) ?? DEFAULT_THEME.panel,
  };
}

export function isDefaultTheme(theme: ThemeSettings): boolean {
  const s = sanitizeTheme(theme);
  return (
    s.accent === DEFAULT_THEME.accent &&
    s.border === DEFAULT_THEME.border &&
    s.viewBg === DEFAULT_THEME.viewBg &&
    s.panel === DEFAULT_THEME.panel
  );
}

export function applyTheme(theme: ThemeSettings): void {
  const t = sanitizeTheme(theme);
  const root = document.documentElement;

  root.style.setProperty("--color-accent", t.accent);
  root.style.setProperty("--color-border", t.border);
  root.style.setProperty("--color-view-bg", t.viewBg);
  root.style.setProperty("--color-panel", t.panel);

  root.style.setProperty("--color-border-soft", mixHex(t.border, t.viewBg, 0.35));
  root.style.setProperty("--color-border-faint", mixHex(t.border, t.viewBg, 0.55));
  root.style.setProperty("--color-panel-2", lighten(t.panel, 0.04));
  root.style.setProperty("--color-elevated", lighten(t.panel, 0.14));
  root.style.setProperty("--color-input", darken(t.panel, 0.03));
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
