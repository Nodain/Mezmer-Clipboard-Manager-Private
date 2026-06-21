import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect } from "react";
import { AppLogo } from "./AppLogo";
import { CLIPBOARD_REPO_URL, DESKTOP_REPO_URL } from "../lib/constants";
import { defaultHotkeyLabel } from "../lib/platform";

export function SettingsAbout() {
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    void getVersion().then(setVersion).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4 p-4" data-no-drag>
      <section className="flex flex-col items-center px-2 py-6 text-center">
        <AppLogo size={56} className="clipboard-empty-mark" />
        <h3 className="mt-3 text-[15px] font-semibold tracking-tight t-text">
          Mezmerize
        </h3>
        <p className="mt-3 max-w-[280px] text-[11px] leading-relaxed t-faint">
          Local-first clipboard manager. Press{" "}
          <span className="t-muted">{defaultHotkeyLabel()}</span> to open the
          picker. On Windows you can optionally switch to Win+V in Settings.
        </p>
        <p className="mt-4 text-[10px] tabular-nums t-faint">Version {version}</p>
      </section>

      <section className="space-y-2 px-1">
        <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] t-faint">
          Links
        </h3>
        <button
          type="button"
          className="block w-full text-left text-[12px] text-[var(--color-accent)] underline-offset-2 hover:underline"
          onClick={() => void openUrl(CLIPBOARD_REPO_URL)}
        >
          Go to the clipboard
        </button>
        <button
          type="button"
          className="block w-full text-left text-[12px] text-[var(--color-accent)] underline-offset-2 hover:underline"
          onClick={() => void openUrl(DESKTOP_REPO_URL)}
        >
          Check out the desktop app
        </button>
        <p className="pt-1 text-[10px] leading-relaxed t-faint">
          Install Mezmer Desktop to pair with Mezmerize and send copied images
          and URLs to your library.
        </p>
      </section>
    </div>
  );
}
