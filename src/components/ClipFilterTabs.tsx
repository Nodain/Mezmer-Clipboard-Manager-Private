import type { ClipFilterTab } from "../lib/clipFilter";
import { supportsColorPicker } from "../lib/platform";

const ALL_TABS: Array<{ id: ClipFilterTab; label: string }> = [
  { id: "pinned", label: "Pinned" },
  { id: "text", label: "Text" },
  { id: "image", label: "Images" },
  { id: "color", label: "Colors" },
];

export function ClipFilterTabs({
  active,
  counts,
  onChange,
  variant = "footer",
}: {
  active: ClipFilterTab;
  counts: Record<ClipFilterTab, number>;
  onChange: (tab: ClipFilterTab) => void;
  variant?: "footer" | "header";
}) {
  const tabs = ALL_TABS.filter(
    (tab) => tab.id !== "color" || supportsColorPicker(),
  );

  return (
    <div
      className={`clipboard-tabs clipboard-tabs--${variant}`}
      data-no-drag
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`clipboard-tab ${active === tab.id ? "clipboard-tab--active" : ""}`}
        >
          <span>{tab.label}</span>
          <span className="clipboard-tab-count">{counts[tab.id]}</span>
        </button>
      ))}
    </div>
  );
}
