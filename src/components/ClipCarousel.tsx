import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useClipThumb } from "../hooks/useClipThumb";
import type { ClipRecord, CopyMode } from "../lib/types";
import { IconChevronLeft, IconChevronRight, IconImage, IconPin, IconTrash } from "./icons";

const META_HEIGHT = 52;

type ContextMenuState = {
  x: number;
  y: number;
  clip: ClipRecord;
};

function CarouselCard({
  clip,
  active,
  width,
  mediaHeight,
  onSelect,
  onCopy,
  onPin,
  onDelete,
  onContextMenu,
  cardRef,
}: {
  clip: ClipRecord;
  active: boolean;
  width: number;
  mediaHeight: number;
  onSelect: () => void;
  onCopy: () => void;
  onPin: () => void;
  onDelete: () => void;
  onContextMenu: (event: MouseEvent) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const isImage = clip.kind === "image";
  const thumb = useClipThumb(clip.id, isImage);

  return (
    <article
      ref={cardRef}
      data-no-drag
      className={`clipboard-carousel-card ${active ? "clipboard-carousel-card--active" : ""}`}
      style={{ width, minWidth: width }}
    >
      <button
        type="button"
        className="clipboard-carousel-card-main"
        onClick={() => {
          if (active) onCopy();
          else onSelect();
        }}
        onContextMenu={onContextMenu}
      >
        {clip.kind === "image" ? (
          <div
            className="clipboard-carousel-card-media"
            style={{ height: mediaHeight }}
          >
            {thumb ? (
              <img
                src={thumb}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <IconImage size={22} className="opacity-70" />
            )}
          </div>
        ) : (
          <div
            className="clipboard-carousel-card-media clipboard-carousel-card-media--text"
            style={{ height: mediaHeight }}
          >
            <p className="line-clamp-[8] text-[11px] leading-relaxed t-text">
              {clip.preview}
            </p>
          </div>
        )}
        <p className="clipboard-carousel-card-preview truncate text-[11px] font-medium t-text">
          {clip.preview}
        </p>
      </button>
      <div className="clipboard-carousel-card-meta-actions">
        <button
          type="button"
          title="Pin"
          className={`clipboard-carousel-icon-btn${clip.pinned ? " clipboard-carousel-icon-btn--pinned" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
        >
          <IconPin size={15} filled={clip.pinned} />
        </button>
        <button
          type="button"
          title="Delete"
          className="clipboard-carousel-icon-btn clipboard-carousel-icon-btn--delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <IconTrash size={15} />
        </button>
      </div>
    </article>
  );
}

export function ClipCarousel({
  clips,
  selectedId,
  onSelect,
  onCopy,
  onPin,
  onDelete,
}: {
  clips: ClipRecord[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCopy: (id: number, mode?: CopyMode) => void;
  onPin: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<number, HTMLDivElement>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [trackOffset, setTrackOffset] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const selectedIndex = useMemo(() => {
    const idx = clips.findIndex((clip) => clip.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [clips, selectedId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const update = () => {
      setViewportWidth(node.clientWidth);
      setViewportHeight(node.clientHeight);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = carouselRef.current;

    if (!node || clips.length === 0) return;

    let locked = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (locked) return;

      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 12) return;

      const idx = clips.findIndex((clip) => clip.id === selectedId);
      const current = idx >= 0 ? idx : 0;

      if (delta > 0 && current < clips.length - 1) {
        onSelect(clips[current + 1]!.id);
      } else if (delta < 0 && current > 0) {
        onSelect(clips[current - 1]!.id);
      } else {
        return;
      }

      locked = true;
      window.setTimeout(() => {
        locked = false;
      }, 140);
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [clips, selectedId, onSelect]);

  const mediaHeight = Math.max(72, viewportHeight - META_HEIGHT - 8);
  const cardWidth = Math.round(Math.min(220, Math.max(120, mediaHeight * 0.78)));

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const card = cardRefs.current.get(clips[selectedIndex]?.id ?? -1);
    if (!viewport || !track || !card) return;

    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const viewportCenter = viewport.clientWidth / 2;
    setTrackOffset(viewportCenter - cardCenter);
  }, [clips, selectedIndex, cardWidth, viewportWidth, viewportHeight]);

  const canGoBack = selectedIndex > 0;
  const canGoForward = selectedIndex < clips.length - 1;

  const handleContextMenu = (clip: ClipRecord) => (event: MouseEvent) => {
    if (clip.kind !== "text" && clip.kind !== "url") return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, clip });
  };

  const hasFormatting = Boolean(
    contextMenu?.clip.hasHtmlContent ?? contextMenu?.clip.htmlContent?.trim(),
  );

  return (
    <div ref={carouselRef} className="clipboard-carousel" data-no-drag>
      <div ref={viewportRef} className="clipboard-carousel-viewport">
        <button
          type="button"
          className="clipboard-carousel-nav clipboard-carousel-nav--prev"
          disabled={!canGoBack}
          onClick={() => onSelect(clips[selectedIndex - 1]!.id)}
          aria-label="Previous clip"
        >
          <IconChevronLeft size={15} />
        </button>

        <div
          ref={trackRef}
          className="clipboard-carousel-track"
          style={{ transform: `translateX(${trackOffset}px)` }}
        >
          {clips.map((clip) => (
            <CarouselCard
              key={clip.id}
              clip={clip}
              active={clip.id === selectedId}
              width={cardWidth}
              mediaHeight={mediaHeight}
              cardRef={(el) => {
                if (el) cardRefs.current.set(clip.id, el);
                else cardRefs.current.delete(clip.id);
              }}
              onSelect={() => onSelect(clip.id)}
              onCopy={() => onCopy(clip.id)}
              onPin={() => onPin(clip.id)}
              onDelete={() => onDelete(clip.id)}
              onContextMenu={handleContextMenu(clip)}
            />
          ))}
        </div>

        <button
          type="button"
          className="clipboard-carousel-nav clipboard-carousel-nav--next"
          disabled={!canGoForward}
          onClick={() => onSelect(clips[selectedIndex + 1]!.id)}
          aria-label="Next clip"
        >
          <IconChevronRight size={15} />
        </button>
      </div>

      {contextMenu ? (
        <div
          className="clipboard-carousel-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="clipboard-carousel-menu-item"
            onClick={() => {
              onCopy(contextMenu.clip.id, "plainText");
              setContextMenu(null);
            }}
          >
            Copy as plain text
          </button>
          <button
            type="button"
            className="clipboard-carousel-menu-item"
            disabled={!hasFormatting}
            onClick={() => {
              onCopy(contextMenu.clip.id, "formatted");
              setContextMenu(null);
            }}
          >
            Copy with formatting
          </button>
        </div>
      ) : null}
    </div>
  );
}
