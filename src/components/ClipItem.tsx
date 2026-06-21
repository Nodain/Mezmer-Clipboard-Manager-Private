import { memo, useEffect, useRef } from "react";
import { useClipThumb } from "../hooks/useClipThumb";
import { usePinnedDeleteConfirm } from "../hooks/usePinnedDeleteConfirm";
import type { ClipRecord } from "../lib/types";
import { AppLogo } from "./AppLogo";
import {
  IconImage,
  IconPin,
  IconTrash,
} from "./icons";

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function ClipItemInner({
  clip,
  selected,
  onCopy,
  onPin,
  onDelete,
  onSaveToMezmer,
  mezmerEnabled,
}: {
  clip: ClipRecord;
  selected: boolean;
  onCopy: () => void;
  onPin: () => void;
  onDelete: () => void;
  onSaveToMezmer?: () => void;
  mezmerEnabled: boolean;
}) {
  const isImage = clip.kind === "image";
  const rowRef = useRef<HTMLDivElement | null>(null);
  const thumb = useClipThumb(clip.id, isImage);
  const { confirming, requestDelete, cancelDelete } = usePinnedDeleteConfirm(
    clip.id,
    clip.pinned,
    onDelete,
  );

  const metaBar = confirming ? (
    <span className="clipboard-delete-confirm-label">Are You Sure?</span>
  ) : (
    <>
      <span className="clipboard-kind">{clip.kind}</span>
      {clip.pinned ? (
        <span className="text-[9px] font-medium text-[var(--color-accent)]">
          Pinned
        </span>
      ) : null}
    </>
  );

  const rowClassName = [
    isImage ? "clipboard-row clipboard-row--image group" : "clipboard-row group",
    selected ? "clipboard-row--selected" : "",
    confirming ? "clipboard-row--delete-confirm" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleRowClick = () => {
    if (confirming) {
      cancelDelete();
      return;
    }
    onCopy();
  };

  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  const showMezmer =
    mezmerEnabled && (clip.kind === "image" || clip.kind === "url");

  const actions = (
    <div className="clipboard-actions">
      {showMezmer ? (
        <button
          type="button"
          title="Save to Mezmer Desktop"
          onClick={(e) => {
            e.stopPropagation();
            onSaveToMezmer?.();
          }}
          className="clipboard-action-btn clipboard-action-btn--accent"
        >
          <AppLogo size={14} />
        </button>
      ) : null}
      <button
        type="button"
        title="Pin"
        onClick={(e) => {
          e.stopPropagation();
          cancelDelete();
          onPin();
        }}
        className="clipboard-action-btn"
      >
        <IconPin size={13} filled={clip.pinned} />
      </button>
      <button
        type="button"
        title={confirming ? "Confirm delete" : "Delete"}
        onClick={(e) => {
          e.stopPropagation();
          requestDelete();
        }}
        className={`clipboard-action-btn${confirming ? " clipboard-action-btn--delete-confirm" : ""}`}
      >
        <IconTrash size={13} />
      </button>
    </div>
  );

  if (isImage) {
    return (
      <div
        ref={rowRef}
        data-no-drag
        onClick={handleRowClick}
        className={rowClassName}
      >
        <div className="clipboard-row-image-preview">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" decoding="async" />
          ) : (
            <IconImage size={28} className="opacity-70" />
          )}
        </div>
        <div className="clipboard-row-image-footer">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[11px] t-muted">
                {clip.preview}
              </p>
              <span className="shrink-0 text-[10px] tabular-nums t-faint">
                {formatTime(clip.createdAt)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">{metaBar}</div>
          </div>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      data-no-drag
      onClick={handleRowClick}
      className={rowClassName}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[12.5px] leading-snug t-text">
            {clip.preview}
          </p>
          <span className="shrink-0 text-[10px] tabular-nums t-faint">
            {formatTime(clip.createdAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">{metaBar}</div>
      </div>

      {actions}
    </div>
  );
}

export const ClipItem = memo(ClipItemInner);
