import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeExtents, resolveEntityColor } from "@/lib/cad/dxf";
import { nearestPin } from "@/lib/cad/pins";
import type { CadPin, DxfDoc } from "@/lib/cad/types";
import { cn } from "@/lib/utils";

type Cam = { x: number; y: number; scale: number };

function toScreen(cam: Cam, x: number, y: number, w: number, h: number) {
  return {
    sx: (x - cam.x) * cam.scale + w / 2,
    sy: -(y - cam.y) * cam.scale + h / 2,
  };
}

function toWorld(cam: Cam, sx: number, sy: number, w: number, h: number) {
  return {
    x: cam.x + (sx - w / 2) / cam.scale,
    y: cam.y - (sy - h / 2) / cam.scale,
  };
}

function fitCam(doc: DxfDoc, w: number, h: number): Cam {
  const box = computeExtents(doc.entities);
  const dx = Math.max(1, box.max.x - box.min.x);
  const dy = Math.max(1, box.max.y - box.min.y);
  const pad = 1.12;
  const scale = Math.min(w / (dx * pad), h / (dy * pad));
  return {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    scale: Math.max(0.05, scale),
  };
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  a1deg: number,
  a2deg: number,
) {
  let a1 = (a1deg * Math.PI) / 180;
  let a2 = (a2deg * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -a1, -a2, true);
  ctx.stroke();
}

export function CadViewer({
  doc,
  hiddenLayers,
  pins,
  selectedId,
  pinMode,
  onSelectPin,
  onPlacePin,
  className,
}: {
  doc: DxfDoc;
  hiddenLayers: Set<string>;
  pins: CadPin[];
  selectedId?: string;
  pinMode?: boolean;
  onSelectPin?: (id: string | null) => void;
  onPlacePin?: (x: number, y: number) => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Cam>({ x: 0, y: 0, scale: 1 });
  const [size, setSize] = useState({ w: 800, h: 480 });
  const drag = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const fitted = useRef(false);

  const layers = doc.layers;

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    camRef.current = fitCam(doc, w, h);
    fitted.current = true;
    paint();
  }, [doc]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0c1210";
    ctx.fillRect(0, 0, w, h);
    const cam = camRef.current;
    const lw = Math.max(0.7, Math.min(1.6, 1.1 * Math.sqrt(cam.scale / 4)));
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const showText = cam.scale > 1.15;

    for (const e of doc.entities) {
      if (hiddenLayers.has(e.layer)) continue;
      const color = resolveEntityColor(e, layers);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      if (e.type === "LINE") {
        const a = toScreen(cam, e.x1, e.y1, w, h);
        const b = toScreen(cam, e.x2, e.y2, w, h);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      } else if (e.type === "CIRCLE") {
        const c = toScreen(cam, e.cx, e.cy, w, h);
        ctx.beginPath();
        ctx.arc(c.sx, c.sy, e.r * cam.scale, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === "ARC") {
        const c = toScreen(cam, e.cx, e.cy, w, h);
        drawArc(ctx, c.sx, c.sy, e.r * cam.scale, e.a1, e.a2);
      } else if (e.type === "POLYLINE") {
        if (e.pts.length < 2) continue;
        ctx.beginPath();
        const p0 = toScreen(cam, e.pts[0]!.x, e.pts[0]!.y, w, h);
        ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < e.pts.length; i++) {
          const p = toScreen(cam, e.pts[i]!.x, e.pts[i]!.y, w, h);
          ctx.lineTo(p.sx, p.sy);
        }
        if (e.closed) ctx.closePath();
        ctx.stroke();
      } else if (e.type === "TEXT" && showText) {
        const p = toScreen(cam, e.x, e.y, w, h);
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate((-e.rot * Math.PI) / 180);
        ctx.font = `${Math.max(8, e.h * cam.scale)}px "IBM Plex Sans", sans-serif`;
        ctx.textBaseline = "bottom";
        ctx.fillText(e.value, 0, 0);
        ctx.restore();
      } else if (e.type === "POINT") {
        const p = toScreen(cam, e.x, e.y, w, h);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "INSERT") {
        const p = toScreen(cam, e.x, e.y, w, h);
        const s = 4 * cam.scale;
        ctx.strokeRect(p.sx - s / 2, p.sy - s / 2, s, s);
        if (showText) {
          ctx.font = "10px IBM Plex Sans, sans-serif";
          ctx.fillText(e.name, p.sx + s, p.sy);
        }
      }
    }

    for (const pin of pins) {
      const p = toScreen(cam, pin.x, pin.y, w, h);
      const active = pin.equipmentId === selectedId;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, active ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#22c55e" : "rgba(34, 197, 94, 0.25)";
      ctx.fill();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (cam.scale > 1.4 || active) {
        ctx.font = `600 ${active ? 11 : 10}px IBM Plex Sans, sans-serif`;
        ctx.fillStyle = "#d8f5e4";
        ctx.fillText(pin.equipmentId, p.sx + 10, p.sy + 4);
      }
    }
  }, [doc, hiddenLayers, layers, pins, selectedId]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      if (!fitted.current) fit();
      else paint();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, paint]);

  useEffect(() => {
    fitted.current = false;
    fit();
  }, [doc, fit]);

  useEffect(() => {
    paint();
  }, [paint, size]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const cam = camRef.current;
      const before = toWorld(cam, sx, sy, el.clientWidth, el.clientHeight);
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      cam.scale = Math.min(80, Math.max(0.04, cam.scale * factor));
      const after = toWorld(cam, sx, sy, el.clientWidth, el.clientHeight);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
      paint();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [paint]);

  function hit(clientX: number, clientY: number) {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const world = toWorld(camRef.current, clientX - rect.left, clientY - rect.top, el.clientWidth, el.clientHeight);
    const max = 14 / camRef.current.scale;
    return { world, pin: nearestPin(pins, world.x, world.y, max) };
  }

  return (
    <div
      ref={wrapRef}
      className={cn("relative min-h-[320px] overflow-hidden bg-[#0c1210]", className)}
      onPointerDown={(ev) => {
        if (ev.button === 1 || ev.button === 2 || ev.shiftKey) {
          drag.current = {
            x: ev.clientX,
            y: ev.clientY,
            camX: camRef.current.x,
            camY: camRef.current.y,
          };
          (ev.currentTarget as HTMLDivElement).setPointerCapture(ev.pointerId);
          return;
        }
        if (ev.button !== 0) return;
        const h = hit(ev.clientX, ev.clientY);
        if (pinMode && onPlacePin && h) {
          onPlacePin(h.world.x, h.world.y);
          return;
        }
        if (h?.pin) onSelectPin?.(h.pin.equipmentId);
        else {
          drag.current = {
            x: ev.clientX,
            y: ev.clientY,
            camX: camRef.current.x,
            camY: camRef.current.y,
          };
          (ev.currentTarget as HTMLDivElement).setPointerCapture(ev.pointerId);
        }
      }}
      onPointerMove={(ev) => {
        if (!drag.current) return;
        const el = wrapRef.current;
        if (!el) return;
        const dx = ev.clientX - drag.current.x;
        const dy = ev.clientY - drag.current.y;
        camRef.current.x = drag.current.camX - dx / camRef.current.scale;
        camRef.current.y = drag.current.camY + dy / camRef.current.scale;
        paint();
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onDoubleClick={() => fit()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block size-full touch-none" />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-[#c8d4cc]">
        Kéo để pan · lăn để zoom · đúp để vừa khít
        {pinMode ? " · chạm để gắn mã" : ""}
      </div>
      <button
        type="button"
        className="absolute bottom-2 right-2 h-8 rounded-md border border-white/15 bg-black/45 px-2 text-[11px] text-[#e8eee9] hover:bg-black/65"
        onClick={() => fit()}
      >
        Vừa khít
      </button>
    </div>
  );
}

export function useHiddenLayers(doc: DxfDoc | null) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const names = useMemo(() => doc?.layers.map((l) => l.name) ?? [], [doc]);
  function toggle(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  return { hidden, toggle, names, setHidden };
}
