import type { ClipFilterTab } from "../lib/clipFilter";
import type { ClipRecord, CopyMode, SavedColor } from "../lib/types";
import { api } from "../lib/api";
import { supportsColorPicker } from "../lib/platform";
import { ColorCarousel } from "./ColorCarousel";
import { ClipCarousel } from "./ClipCarousel";
import { ClipboardEmpty } from "./ClipboardEmpty";
import { ColorsPanel } from "./ColorsPanel";
import { ClipItem } from "./ClipItem";
import { IconEyedropper } from "./icons";

export function PickerMainContent({
  clipFilter,
  carouselMode,
  filteredClips,
  savedColors,
  selectedId,
  selectedColorId,
  clipsEmptyTitle,
  clipsEmptyHint,
  mezmerEnabled,
  onSelectClip,
  onSelectColor,
  onCopyClip,
  onCopyColor,
  onPin,
  onDelete,
  onSaveToMezmer,
  onRefreshColors,
  onShowCopied,
}: {
  clipFilter: ClipFilterTab;
  carouselMode: boolean;
  filteredClips: ClipRecord[];
  savedColors: SavedColor[];
  selectedId: number | null;
  selectedColorId: number | null;
  clipsEmptyTitle: string;
  clipsEmptyHint?: string;
  mezmerEnabled: boolean;
  onSelectClip: (id: number) => void;
  onSelectColor: (id: number) => void;
  onCopyClip: (id: number, mode?: CopyMode) => void;
  onCopyColor: (id: number) => void;
  onPin: (id: number) => void | Promise<void>;
  onDelete: (id: number) => void | Promise<void>;
  onSaveToMezmer?: (id: number) => void;
  onRefreshColors: () => void;
  onShowCopied?: () => void;
}) {
  if (clipFilter === "color") {
    if (carouselMode) {
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
          {supportsColorPicker() ? (
            <div className="flex shrink-0 items-center gap-2 px-0.5">
              <button
                type="button"
                onClick={() => void api.startEyedropper()}
                className="colors-pick-btn"
              >
                <IconEyedropper size={12} />
                <span>Pick from screen</span>
              </button>
              <span className="text-[10px] t-faint">
                Loupe follows cursor · Esc cancels
              </span>
            </div>
          ) : null}
          {savedColors.length === 0 ? (
            <ClipboardEmpty title="No colors yet" className="flex-1" />
          ) : (
            <ColorCarousel
              colors={savedColors}
              selectedId={selectedColorId}
              onSelect={onSelectColor}
              onCopy={onCopyColor}
            />
          )}
        </div>
      );
    }

    return (
      <ColorsPanel
        colors={savedColors}
        selectedId={selectedColorId}
        onSelect={onSelectColor}
        onRefresh={onRefreshColors}
        onCopy={onShowCopied}
      />
    );
  }

  if (filteredClips.length === 0) {
    return <ClipboardEmpty title={clipsEmptyTitle} hint={clipsEmptyHint} />;
  }

  if (carouselMode) {
    return (
      <ClipCarousel
        clips={filteredClips}
        selectedId={selectedId}
        onSelect={onSelectClip}
        onCopy={onCopyClip}
        onPin={onPin}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div className="space-y-0.5">
      {filteredClips.map((clip) => (
        <ClipItem
          key={clip.id}
          clip={clip}
          selected={clip.id === selectedId}
          mezmerEnabled={mezmerEnabled}
          onCopy={() => onCopyClip(clip.id)}
          onPin={() => void onPin(clip.id)}
          onDelete={() => void onDelete(clip.id)}
          onSaveToMezmer={
            onSaveToMezmer ? () => onSaveToMezmer(clip.id) : undefined
          }
        />
      ))}
    </div>
  );
}
