import { useEffect } from "react";
import { applyListImagePreviewHeight, applyTheme } from "../lib/theme";
import type { AppSettings } from "../lib/types";

export function useAppTheme(settings: AppSettings | null) {
  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme);
  }, [settings?.theme]);

  useEffect(() => {
    applyListImagePreviewHeight(settings?.listImagePreviewHeight);
  }, [settings?.listImagePreviewHeight]);
}
