import { useEffect, useRef } from "react";
import { useStore } from "../lib/store";

export function Toast() {
  const toast = useStore((s) => s.toast);
  const setToast = useStore((s) => s.setToast);
  const timer = useRef<number>();

  useEffect(() => {
    if (!toast) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer.current);
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none absolute bottom-12 left-1/2 z-50 -translate-x-1/2 animate-fade">
      <div className="mezmer-popup-surface flex items-center gap-2 px-3.5 py-2 text-[11px] t-text">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_6px_var(--color-accent-glow)]" />
        {toast}
      </div>
    </div>
  );
}
