import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export interface EyedropperPreview {
  x: number;
  y: number;
  hex: string;
  r: number;
  g: number;
  b: number;
  gridSize: number;
  pixels: number[];
}

const CELL = 12;

export default function EyedropperApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hexRef = useRef<HTMLSpanElement>(null);
  const swatchRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<EyedropperPreview>("eyedropper-preview", (event) => {
      const preview = event.payload;
      if (hexRef.current) hexRef.current.textContent = preview.hex;
      if (swatchRef.current) {
        swatchRef.current.style.backgroundColor = preview.hex;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const size = preview.gridSize;
      const pixelSize = size * CELL;
      if (canvas.width !== pixelSize) {
        canvas.width = pixelSize;
        canvas.height = pixelSize;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let src = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const r = preview.pixels[src++] ?? 0;
          const g = preview.pixels[src++] ?? 0;
          const b = preview.pixels[src++] ?? 0;
          const px = x * CELL;
          const py = y * CELL;
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(px, py, CELL, CELL);
          ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        }
      }

      const center = Math.floor(size / 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        center * CELL + 1,
        center * CELL + 1,
        CELL - 2,
        CELL - 2,
      );
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);

  return (
    <div className="eyedropper-hud">
      <div className="eyedropper-loupe-wrap">
        <span className="eyedropper-cursor-mark" aria-hidden="true" />
        <canvas ref={canvasRef} className="eyedropper-loupe" />
      </div>
      <div className="eyedropper-readout">
        <span ref={swatchRef} className="eyedropper-swatch" />
        <span ref={hexRef} className="eyedropper-hex">
          #000000
        </span>
      </div>
      <p className="eyedropper-hint-text">
        Center pixel is under cursor · Click to sample
      </p>
    </div>
  );
}
