export function SettingsAbout() {
  return (
    <div className="space-y-4 p-4" data-no-drag>
      <section className="flex flex-col items-center px-2 py-6 text-center">
        <img
          src="/mezmer-mark.png"
          alt=""
          className="clipboard-empty-mark"
          draggable={false}
        />
        <h3 className="mt-3 text-[15px] font-semibold tracking-tight t-text">
          Clipboard
        </h3>
        <p className="mt-1 text-[12px] t-muted">Mezmer</p>
        <p className="mt-3 max-w-[260px] text-[11px] leading-relaxed t-faint">
          Local-first clipboard manager with optional Mezmer pairing.
        </p>
        <p className="mt-4 text-[10px] tabular-nums t-faint">Version 0.1.0</p>
      </section>
    </div>
  );
}
