import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { SavedColor } from "../lib/types";
import { ClipboardEmpty } from "./ClipboardEmpty";
import { IconEyedropper, IconTrash } from "./icons";

function rgbLabel(color: SavedColor) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function ColorsPanel({
  colors,
  selectedId,
  onSelect,
  onRefresh,
  onCopy,
}: {
  colors: SavedColor[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onRefresh: () => void;
  onCopy?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2" data-no-drag>
      <div className="flex items-center gap-2 px-0.5">
        <button
          type="button"
          onClick={() => void api.startEyedropper()}
          className="colors-pick-btn"
        >
          <IconEyedropper size={12} />
          <span>Pick from screen</span>
        </button>
        <span className="text-[10px] t-faint">Loupe follows cursor · Esc cancels</span>
      </div>

      {colors.length === 0 ? (
        <ClipboardEmpty title="No colors yet" className="flex-1" />
      ) : (
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {colors.map((color) => (
            <SavedColorRow
              key={color.id}
              color={color}
              selected={color.id === selectedId}
              onSelect={onSelect}
              onRefresh={onRefresh}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedColorRow({
  color,
  selected,
  onSelect,
  onRefresh,
  onCopy,
}: {
  color: SavedColor;
  selected?: boolean;
  onSelect?: (id: number) => void;
  onRefresh: () => void;
  onCopy?: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={() => {
        onSelect?.(color.id);
        void api.copySavedColor(color.id).then(() => onCopy?.());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSelect?.(color.id);
          void api.copySavedColor(color.id).then(() => onCopy?.());
        }
      }}
      className={`clipboard-row group ${selected ? "clipboard-row--selected" : ""}`}
    >
      <div
        className="clipboard-thumb border border-[var(--color-border-soft)]"
        style={{ backgroundColor: color.hex }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium uppercase tracking-wide t-text">
          {color.hex}
        </p>
        <p className="mt-0.5 text-[11px] t-muted">{rgbLabel(color)}</p>
      </div>
      <div className="clipboard-actions">
        <button
          type="button"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            void api.deleteSavedColor(color.id).then(onRefresh);
          }}
          className="clipboard-action-btn"
        >
          <IconTrash size={13} />
        </button>
      </div>
    </div>
  );
}
