import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SavedColor } from "../lib/types";
import { IconChevronLeft, IconChevronRight } from "./icons";

const META_HEIGHT = 52;

function rgbLabel(color: SavedColor) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

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

function ColorCarouselCard({
  color,
  active,
  width,
  mediaHeight,
  onSelect,
  onCopy,
  cardRef,
}: {
  color: SavedColor;
  active: boolean;
  width: number;
  mediaHeight: number;
  onSelect: () => void;
  onCopy: () => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={cardRef}
      data-no-drag
      onClick={() => {
        if (active) onCopy();
        else onSelect();
      }}
      className={`clipboard-carousel-card ${active ? "clipboard-carousel-card--active" : ""}`}
      style={{ width, minWidth: width }}
    >
      <div
        className="clipboard-carousel-card-media clipboard-carousel-card-media--color"
        style={{ height: mediaHeight, backgroundColor: color.hex }}
      />
      <div className="clipboard-carousel-card-meta">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide t-text">
          {color.hex}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[9px] t-muted">{rgbLabel(color)}</span>
          <span className="shrink-0 text-[9px] tabular-nums t-faint">
            {formatTime(color.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

export function ColorCarousel({
  colors,
  selectedId,
  onSelect,
  onCopy,
}: {
  colors: SavedColor[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCopy: (id: number) => void;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<number, HTMLButtonElement>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [trackOffset, setTrackOffset] = useState(0);

  const selectedIndex = useMemo(() => {
    const idx = colors.findIndex((color) => color.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [colors, selectedId]);

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
    if (!node || colors.length === 0) return;

    let locked = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (locked) return;

      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 12) return;

      const idx = colors.findIndex((color) => color.id === selectedId);
      const current = idx >= 0 ? idx : 0;

      if (delta > 0 && current < colors.length - 1) {
        onSelect(colors[current + 1]!.id);
      } else if (delta < 0 && current > 0) {
        onSelect(colors[current - 1]!.id);
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
  }, [colors, selectedId, onSelect]);

  const mediaHeight = Math.max(72, viewportHeight - META_HEIGHT - 8);
  const cardWidth = Math.round(Math.min(220, Math.max(120, mediaHeight * 0.78)));

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const card = cardRefs.current.get(colors[selectedIndex]?.id ?? -1);
    if (!viewport || !track || !card) return;

    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const viewportCenter = viewport.clientWidth / 2;
    setTrackOffset(viewportCenter - cardCenter);
  }, [colors, selectedIndex, cardWidth, viewportWidth, viewportHeight]);

  const canGoBack = selectedIndex > 0;
  const canGoForward = selectedIndex < colors.length - 1;

  return (
    <div ref={carouselRef} className="clipboard-carousel" data-no-drag>
      <div ref={viewportRef} className="clipboard-carousel-viewport">
        <button
          type="button"
          className="clipboard-carousel-nav clipboard-carousel-nav--prev"
          disabled={!canGoBack}
          onClick={() => onSelect(colors[selectedIndex - 1]!.id)}
          aria-label="Previous color"
        >
          <IconChevronLeft size={15} />
        </button>

        <div
          ref={trackRef}
          className="clipboard-carousel-track"
          style={{ transform: `translateX(${trackOffset}px)` }}
        >
          {colors.map((color) => (
            <ColorCarouselCard
              key={color.id}
              color={color}
              active={color.id === selectedId}
              width={cardWidth}
              mediaHeight={mediaHeight}
              cardRef={(el) => {
                if (el) cardRefs.current.set(color.id, el);
                else cardRefs.current.delete(color.id);
              }}
              onSelect={() => onSelect(color.id)}
              onCopy={() => onCopy(color.id)}
            />
          ))}
        </div>

        <button
          type="button"
          className="clipboard-carousel-nav clipboard-carousel-nav--next"
          disabled={!canGoForward}
          onClick={() => onSelect(colors[selectedIndex + 1]!.id)}
          aria-label="Next color"
        >
          <IconChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
