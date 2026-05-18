"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { Eraser } from "lucide-react";

// Minimal vanilla canvas signature pad. Tracks mouse + touch events directly
// so we don't pull in a library. Exposes two imperative methods: toDataURL()
// to read the signature as a PNG dataURL, and clear() to reset the canvas.
export type SignaturePadHandle = {
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { width?: number; height?: number }>(
  function SignaturePad({ width = 480, height = 160 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);

    const getCtx = () => {
      const c = canvasRef.current;
      if (!c) return null;
      return c.getContext("2d");
    };

    const setup = () => {
      const c = canvasRef.current;
      const ctx = getCtx();
      if (!c || !ctx) return;
      // Use the canvas's intrinsic pixel size set by the JSX width/height
      // attributes, not the CSS size, to keep strokes crisp.
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827"; // gray-900
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
    };

    // Initial paint — clear to white. Inlined rather than calling setup() so
    // the exhaustive-deps rule doesn't trip on a non-reactive callback.
    useEffect(() => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
    }, []);

    const pointFromEvent = (e: React.MouseEvent | React.TouchEvent) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const rect = c.getBoundingClientRect();
      const scaleX = c.width / rect.width;
      const scaleY = c.height / rect.height;
      const clientX =
        "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const handleDown = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const ctx = getCtx();
      if (!ctx) return;
      const { x, y } = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = getCtx();
      if (!ctx) return;
      const { x, y } = pointFromEvent(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      dirty.current = true;
    };
    const handleUp = () => {
      drawing.current = false;
    };

    useImperativeHandle(ref, () => ({
      toDataURL: () => {
        if (!dirty.current) return null;
        return canvasRef.current?.toDataURL("image/png") ?? null;
      },
      clear: () => {
        setup();
        dirty.current = false;
      },
      isEmpty: () => !dirty.current
    }));

    return (
      <div className="space-y-1">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
          onTouchStart={handleDown}
          onTouchMove={handleMove}
          onTouchEnd={handleUp}
          className="w-full rounded border border-input bg-white"
          style={{ touchAction: "none" }}
        />
        <button
          type="button"
          onClick={() => {
            setup();
            dirty.current = false;
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Eraser className="size-3" />
          נקה
        </button>
      </div>
    );
  }
);
