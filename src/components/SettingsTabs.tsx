export type SettingsTab = "general" | "personalization" | "about";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "personalization", label: "Personalization" },
  { id: "about", label: "About" },
];

export function SettingsTabs({
  active,
  onChange,
}: {
  active: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  return (
    <div
      className="clipboard-tabs flex gap-1 border-b border-[var(--color-border-soft)] px-3 pb-2 pt-1"
      data-no-drag
    >
      {TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`clipboard-tab ${selected ? "clipboard-tab--active" : ""}`}
          >
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
