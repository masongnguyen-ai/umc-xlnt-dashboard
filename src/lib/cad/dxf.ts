import { BYLAYER, type DxfDoc, type DxfEntity, type DxfLayer, type DxfPt } from "./types";

const BYLAYER_COLOR = 256;

export class DxfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DxfError";
  }
}

export function detectCadFile(raw: string | ArrayBuffer): "DXF" | "DWG" | "UNKNOWN" {
  if (typeof raw !== "string") {
    const u8 = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(0);
    const head = String.fromCharCode(...u8.slice(0, 6));
    if (head.startsWith("AC10")) return "DWG";
    return "UNKNOWN";
  }
  const s = raw.replace(/^\uFEFF/, "");
  if (s.startsWith("AC10")) return "DWG";
  if (s.includes("\0") && /AC10\d{2}/.test(s.slice(0, 32))) return "DWG";
  if (/^\s*0\s*\r?\nSECTION/m.test(s) || s.includes("ENTITIES") || s.includes("EOF")) return "DXF";
  return "UNKNOWN";
}

function pairs(text: string): { code: number; value: string }[] {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: { code: number; value: string }[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = Number.parseInt(lines[i]!.trim(), 10);
    if (!Number.isFinite(code)) continue;
    out.push({ code, value: lines[i + 1] ?? "" });
  }
  return out;
}

function num(v: string) {
  const n = Number.parseFloat(v.trim());
  return Number.isFinite(n) ? n : 0;
}

function stripMtext(s: string) {
  return s
    .replace(/\\P/g, "\n")
    .replace(/\{\\[^;]*;/g, "")
    .replace(/\}/g, "")
    .replace(/\\[A-Za-z][^;]*;/g, "")
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
    .trim();
}

function layerOf(map: Map<number, string[]>) {
  return (map.get(8)?.[0] ?? "0").trim() || "0";
}

function colorOf(map: Map<number, string[]>) {
  const c = map.get(62)?.[0];
  if (c == null) return BYLAYER_COLOR;
  const n = Number.parseInt(c.trim(), 10);
  return Number.isFinite(n) ? n : BYLAYER_COLOR;
}

function collect(pairsList: { code: number; value: string }[], from: number): { map: Map<number, string[]>; next: number } {
  const map = new Map<number, string[]>();
  let i = from;
  while (i < pairsList.length) {
    const p = pairsList[i]!;
    if (p.code === 0 && i !== from) break;
    const arr = map.get(p.code) ?? [];
    arr.push(p.value);
    map.set(p.code, arr);
    i++;
  }
  return { map, next: i };
}

function entityFromMap(type: string, map: Map<number, string[]>): DxfEntity | null {
  const layer = layerOf(map);
  const color = colorOf(map);
  const t = type.trim().toUpperCase();
  if (t === "LINE") {
    return {
      type: "LINE",
      layer,
      color,
      x1: num(map.get(10)?.[0] ?? "0"),
      y1: num(map.get(20)?.[0] ?? "0"),
      x2: num(map.get(11)?.[0] ?? "0"),
      y2: num(map.get(21)?.[0] ?? "0"),
    };
  }
  if (t === "CIRCLE") {
    return {
      type: "CIRCLE",
      layer,
      color,
      cx: num(map.get(10)?.[0] ?? "0"),
      cy: num(map.get(20)?.[0] ?? "0"),
      r: Math.abs(num(map.get(40)?.[0] ?? "0")),
    };
  }
  if (t === "ARC") {
    return {
      type: "ARC",
      layer,
      color,
      cx: num(map.get(10)?.[0] ?? "0"),
      cy: num(map.get(20)?.[0] ?? "0"),
      r: Math.abs(num(map.get(40)?.[0] ?? "0")),
      a1: num(map.get(50)?.[0] ?? "0"),
      a2: num(map.get(51)?.[0] ?? "0"),
    };
  }
  if (t === "LWPOLYLINE") {
    const xs = map.get(10) ?? [];
    const ys = map.get(20) ?? [];
    const flags = Number.parseInt(map.get(70)?.[0] ?? "0", 10);
    const pts: DxfPt[] = [];
    const n = Math.min(xs.length, ys.length);
    for (let i = 0; i < n; i++) pts.push({ x: num(xs[i]!), y: num(ys[i]!) });
    if (!pts.length) return null;
    return { type: "POLYLINE", layer, color, closed: (flags & 1) === 1, pts };
  }
  if (t === "TEXT" || t === "ATTDEF" || t === "ATTRIB") {
    return {
      type: "TEXT",
      layer,
      color,
      x: num(map.get(10)?.[0] ?? "0"),
      y: num(map.get(20)?.[0] ?? "0"),
      h: Math.abs(num(map.get(40)?.[0] ?? "2.5")) || 2.5,
      rot: num(map.get(50)?.[0] ?? "0"),
      value: stripMtext(map.get(1)?.[0] ?? ""),
    };
  }
  if (t === "MTEXT") {
    const extra = (map.get(3) ?? []).join("");
    return {
      type: "TEXT",
      layer,
      color,
      x: num(map.get(10)?.[0] ?? "0"),
      y: num(map.get(20)?.[0] ?? "0"),
      h: Math.abs(num(map.get(40)?.[0] ?? "2.5")) || 2.5,
      rot: num(map.get(50)?.[0] ?? "0"),
      value: stripMtext((map.get(1)?.[0] ?? "") + extra),
    };
  }
  if (t === "POINT") {
    return {
      type: "POINT",
      layer,
      color,
      x: num(map.get(10)?.[0] ?? "0"),
      y: num(map.get(20)?.[0] ?? "0"),
    };
  }
  if (t === "INSERT") {
    return {
      type: "INSERT",
      layer,
      color,
      x: num(map.get(10)?.[0] ?? "0"),
      y: num(map.get(20)?.[0] ?? "0"),
      name: (map.get(2)?.[0] ?? "BLOCK").trim(),
      rot: num(map.get(50)?.[0] ?? "0"),
      sx: num(map.get(41)?.[0] ?? "1") || 1,
      sy: num(map.get(42)?.[0] ?? "1") || 1,
    };
  }
  if (t === "SOLID" || t === "TRACE") {
    const xs = map.get(10) ?? [];
    const ys = map.get(20) ?? [];
    const x2 = map.get(11) ?? [];
    const y2 = map.get(21) ?? [];
    const x3 = map.get(12) ?? [];
    const y3 = map.get(22) ?? [];
    const x4 = map.get(13) ?? [];
    const y4 = map.get(23) ?? [];
    const pts: DxfPt[] = [
      { x: num(xs[0] ?? "0"), y: num(ys[0] ?? "0") },
      { x: num(x2[0] ?? xs[0] ?? "0"), y: num(y2[0] ?? ys[0] ?? "0") },
      { x: num(x3[0] ?? "0"), y: num(y3[0] ?? "0") },
    ];
    if (x4.length) pts.push({ x: num(x4[0]!), y: num(y4[0] ?? "0") });
    return { type: "POLYLINE", layer, color, closed: true, pts };
  }
  return null;
}

export function parseDxf(text: string): DxfDoc {
  const kind = detectCadFile(text);
  if (kind === "DWG") {
    throw new DxfError(
      "File DWG là định dạng đóng của Autodesk — trình duyệt không đọc được. Trong AutoCAD: Save As → AutoCAD DXF (*.dxf), ASCII.",
    );
  }
  if (kind === "UNKNOWN") {
    throw new DxfError("Không nhận ra file DXF. Hãy lưu từ AutoCAD dạng DXF ASCII (không phải DWG, không phải DXF nhị phân).");
  }
  const all = pairs(text);
  if (!all.length) throw new DxfError("File DXF trống.");

  const layers: DxfLayer[] = [];
  const entities: DxfEntity[] = [];
  let version = "AC1009";
  let extMin = { x: Infinity, y: Infinity };
  let extMax = { x: -Infinity, y: -Infinity };
  let section = "";
  let table = "";

  for (let i = 0; i < all.length; i++) {
    const p = all[i]!;
    if (p.code === 0 && p.value.trim() === "SECTION") {
      const name = all[i + 1];
      section = name?.code === 2 ? name.value.trim() : "";
      continue;
    }
    if (p.code === 0 && p.value.trim() === "ENDSEC") {
      section = "";
      table = "";
      continue;
    }
    if (section === "HEADER" && p.code === 9) {
      const key = p.value.trim();
      if (key === "$ACADVER" && all[i + 1]?.code === 1) version = all[i + 1]!.value.trim();
      if (key === "$EXTMIN") {
        let x = 0;
        let y = 0;
        for (let j = i + 1; j < i + 6 && j < all.length; j++) {
          if (all[j]!.code === 10) x = num(all[j]!.value);
          if (all[j]!.code === 20) y = num(all[j]!.value);
        }
        extMin = { x, y };
      }
      if (key === "$EXTMAX") {
        let x = 0;
        let y = 0;
        for (let j = i + 1; j < i + 6 && j < all.length; j++) {
          if (all[j]!.code === 10) x = num(all[j]!.value);
          if (all[j]!.code === 20) y = num(all[j]!.value);
        }
        extMax = { x, y };
      }
    }
    if (section === "TABLES" && p.code === 0 && p.value.trim() === "TABLE") {
      table = all[i + 1]?.code === 2 ? all[i + 1]!.value.trim() : "";
    }
    if (section === "TABLES" && table === "LAYER" && p.code === 0 && p.value.trim() === "LAYER") {
      const { map, next } = collect(all, i);
      const name = (map.get(2)?.[0] ?? "0").trim() || "0";
      const color = Math.abs(Number.parseInt(map.get(62)?.[0] ?? "7", 10)) || 7;
      const flags = Number.parseInt(map.get(70)?.[0] ?? "0", 10);
      layers.push({ name, color, frozen: (flags & 1) === 1 });
      i = next - 1;
      continue;
    }
    if (section === "ENTITIES" && p.code === 0) {
      const type = p.value.trim().toUpperCase();
      if (type === "ENDSEC" || type === "ENDBLK") continue;
      if (type === "POLYLINE") {
        const { map, next } = collect(all, i);
        const flags = Number.parseInt(map.get(70)?.[0] ?? "0", 10);
        const pts: DxfPt[] = [];
        let j = next;
        while (j < all.length) {
          if (all[j]!.code === 0 && all[j]!.value.trim().toUpperCase() === "SEQEND") {
            j = collect(all, j).next;
            break;
          }
          if (all[j]!.code === 0 && all[j]!.value.trim().toUpperCase() === "VERTEX") {
            const v = collect(all, j);
            pts.push({
              x: num(v.map.get(10)?.[0] ?? "0"),
              y: num(v.map.get(20)?.[0] ?? "0"),
              bulge: v.map.get(42)?.[0] != null ? num(v.map.get(42)![0]!) : undefined,
            });
            j = v.next;
            continue;
          }
          if (all[j]!.code === 0) break;
          j++;
        }
        if (pts.length) {
          entities.push({
            type: "POLYLINE",
            layer: layerOf(map),
            color: colorOf(map),
            closed: (flags & 1) === 1,
            pts,
          });
        }
        i = j - 1;
        continue;
      }
      const { map, next } = collect(all, i);
      const ent = entityFromMap(type, map);
      if (ent) entities.push(ent);
      i = next - 1;
    }
  }

  if (!entities.length) {
    throw new DxfError("DXF không có đối tượng 2D (LINE / CIRCLE / POLYLINE / TEXT) để hiển thị.");
  }

  if (!Number.isFinite(extMin.x) || !Number.isFinite(extMax.x) || extMin.x >= extMax.x) {
    const box = computeExtents(entities);
    extMin = box.min;
    extMax = box.max;
  }

  if (!layers.length) {
    const names = [...new Set(entities.map((e) => e.layer))];
    for (const name of names) layers.push({ name, color: 7, frozen: false });
  }

  return { version, layers, entities, extMin, extMax };
}

export function computeExtents(entities: DxfEntity[]): { min: { x: number; y: number }; max: { x: number; y: number } } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    if (e.type === "LINE") {
      add(e.x1, e.y1);
      add(e.x2, e.y2);
    } else if (e.type === "CIRCLE" || e.type === "ARC") {
      add(e.cx - e.r, e.cy - e.r);
      add(e.cx + e.r, e.cy + e.r);
    } else if (e.type === "POLYLINE") {
      for (const p of e.pts) add(p.x, p.y);
    } else if (e.type === "TEXT" || e.type === "POINT" || e.type === "INSERT") {
      add(e.x, e.y);
    }
  }
  if (!Number.isFinite(minX)) {
    return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  }
  if (minX === maxX) {
    minX -= 10;
    maxX += 10;
  }
  if (minY === maxY) {
    minY -= 10;
    maxY += 10;
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

function pair(code: number, value: string | number) {
  return `${code}\n${value}\n`;
}

export function writeDxf(doc: DxfDoc): string {
  const layers = doc.layers.length ? doc.layers : [{ name: "0", color: 7, frozen: false }];
  const box = computeExtents(doc.entities);
  const min = doc.extMin.x < doc.extMax.x ? doc.extMin : box.min;
  const max = doc.extMin.x < doc.extMax.x ? doc.extMax : box.max;
  let s = "";
  s += pair(0, "SECTION");
  s += pair(2, "HEADER");
  s += pair(9, "$ACADVER");
  s += pair(1, "AC1015");
  s += pair(9, "$INSUNITS");
  s += pair(70, 4);
  s += pair(9, "$EXTMIN");
  s += pair(10, min.x);
  s += pair(20, min.y);
  s += pair(30, 0);
  s += pair(9, "$EXTMAX");
  s += pair(10, max.x);
  s += pair(20, max.y);
  s += pair(30, 0);
  s += pair(0, "ENDSEC");
  s += pair(0, "SECTION");
  s += pair(2, "TABLES");
  s += pair(0, "TABLE");
  s += pair(2, "LAYER");
  s += pair(70, layers.length);
  for (const ly of layers) {
    s += pair(0, "LAYER");
    s += pair(2, ly.name.slice(0, 255));
    s += pair(70, ly.frozen ? 1 : 0);
    s += pair(62, ly.color || 7);
    s += pair(6, "CONTINUOUS");
  }
  s += pair(0, "ENDTAB");
  s += pair(0, "ENDSEC");
  s += pair(0, "SECTION");
  s += pair(2, "ENTITIES");
  for (const e of doc.entities) {
    if (e.type === "LINE") {
      s += pair(0, "LINE");
      s += pair(8, e.layer);
      if (e.color !== BYLAYER) s += pair(62, e.color);
      s += pair(10, e.x1);
      s += pair(20, e.y1);
      s += pair(30, 0);
      s += pair(11, e.x2);
      s += pair(21, e.y2);
      s += pair(31, 0);
    } else if (e.type === "CIRCLE") {
      s += pair(0, "CIRCLE");
      s += pair(8, e.layer);
      if (e.color !== BYLAYER) s += pair(62, e.color);
      s += pair(10, e.cx);
      s += pair(20, e.cy);
      s += pair(30, 0);
      s += pair(40, e.r);
    } else if (e.type === "ARC") {
      s += pair(0, "ARC");
      s += pair(8, e.layer);
      if (e.color !== BYLAYER) s += pair(62, e.color);
      s += pair(10, e.cx);
      s += pair(20, e.cy);
      s += pair(30, 0);
      s += pair(40, e.r);
      s += pair(50, e.a1);
      s += pair(51, e.a2);
    } else if (e.type === "POLYLINE") {
      s += pair(0, "LWPOLYLINE");
      s += pair(8, e.layer);
      if (e.color !== BYLAYER) s += pair(62, e.color);
      s += pair(90, e.pts.length);
      s += pair(70, e.closed ? 1 : 0);
      for (const p of e.pts) {
        s += pair(10, p.x);
        s += pair(20, p.y);
        if (p.bulge) s += pair(42, p.bulge);
      }
    } else if (e.type === "TEXT") {
      s += pair(0, "TEXT");
      s += pair(8, e.layer);
      if (e.color !== BYLAYER) s += pair(62, e.color);
      s += pair(10, e.x);
      s += pair(20, e.y);
      s += pair(30, 0);
      s += pair(40, e.h);
      s += pair(1, e.value.replace(/\n/g, " "));
      if (e.rot) s += pair(50, e.rot);
    } else if (e.type === "POINT") {
      s += pair(0, "POINT");
      s += pair(8, e.layer);
      if (e.color !== BYLAYER) s += pair(62, e.color);
      s += pair(10, e.x);
      s += pair(20, e.y);
      s += pair(30, 0);
    } else if (e.type === "INSERT") {
      s += pair(0, "INSERT");
      s += pair(8, e.layer);
      if (e.color !== BYLAYER) s += pair(62, e.color);
      s += pair(2, e.name);
      s += pair(10, e.x);
      s += pair(20, e.y);
      s += pair(30, 0);
      s += pair(41, e.sx);
      s += pair(42, e.sy);
      if (e.rot) s += pair(50, e.rot);
    }
  }
  s += pair(0, "ENDSEC");
  s += pair(0, "EOF");
  return s;
}

/** AutoCAD Color Index → CSS. 256 = BYLAYER (caller resolves). */
export function aciToCss(aci: number, fallback = "#d8dde0"): string {
  const n = Math.abs(aci) % 256;
  const table: Record<number, string> = {
    1: "#ff5a5a",
    2: "#f0d24a",
    3: "#3ee08a",
    4: "#4ad4e8",
    5: "#6ea8ff",
    6: "#e07ad4",
    7: "#e8eee9",
    8: "#8a9a90",
    9: "#c8d4cc",
  };
  if (table[n]) return table[n]!;
  if (n === 0) return fallback;
  const hue = (n * 17) % 360;
  return `hsl(${hue} 42% 62%)`;
}

export function resolveEntityColor(e: { color: number; layer: string }, layers: DxfLayer[]): string {
  if (e.color !== BYLAYER && e.color !== 0) return aciToCss(e.color);
  const ly = layers.find((l) => l.name === e.layer);
  return aciToCss(ly?.color ?? 7);
}

export function emptyDoc(): DxfDoc {
  return {
    version: "AC1015",
    layers: [{ name: "0", color: 7, frozen: false }],
    entities: [],
    extMin: { x: 0, y: 0 },
    extMax: { x: 100, y: 100 },
  };
}

export class DxfBuilder {
  layers: DxfLayer[] = [
    { name: "0", color: 7, frozen: false },
    { name: "KHUNG", color: 8, frozen: false },
    { name: "HE-600", color: 4, frozen: false },
    { name: "HE-220", color: 3, frozen: false },
    { name: "ONG", color: 6, frozen: false },
    { name: "THIET-BI", color: 1, frozen: false },
    { name: "TEXT", color: 7, frozen: false },
    { name: "GHICHU", color: 8, frozen: false },
  ];
  entities: DxfEntity[] = [];

  line(layer: string, x1: number, y1: number, x2: number, y2: number, color = BYLAYER) {
    this.entities.push({ type: "LINE", layer, color, x1, y1, x2, y2 });
  }

  rect(layer: string, x: number, y: number, w: number, h: number, color = BYLAYER) {
    this.entities.push({
      type: "POLYLINE",
      layer,
      color,
      closed: true,
      pts: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
    });
  }

  circle(layer: string, cx: number, cy: number, r: number, color = BYLAYER) {
    this.entities.push({ type: "CIRCLE", layer, color, cx, cy, r });
  }

  arc(layer: string, cx: number, cy: number, r: number, a1: number, a2: number, color = BYLAYER) {
    this.entities.push({ type: "ARC", layer, color, cx, cy, r, a1, a2 });
  }

  poly(layer: string, pts: DxfPt[], closed = false, color = BYLAYER) {
    this.entities.push({ type: "POLYLINE", layer, color, closed, pts });
  }

  text(layer: string, x: number, y: number, h: number, value: string, rot = 0, color = BYLAYER) {
    this.entities.push({ type: "TEXT", layer, color, x, y, h, rot, value });
  }

  arrow(layer: string, x1: number, y1: number, x2: number, y2: number, size = 2.2) {
    this.line(layer, x1, y1, x2, y2);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const a1 = ang + Math.PI * 0.82;
    const a2 = ang - Math.PI * 0.82;
    this.line(layer, x2, y2, x2 + Math.cos(a1) * size, y2 + Math.sin(a1) * size);
    this.line(layer, x2, y2, x2 + Math.cos(a2) * size, y2 + Math.sin(a2) * size);
  }

  doc(): DxfDoc {
    const box = computeExtents(this.entities);
    const pad = 8;
    return {
      version: "AC1015",
      layers: this.layers,
      entities: this.entities,
      extMin: { x: box.min.x - pad, y: box.min.y - pad },
      extMax: { x: box.max.x + pad, y: box.max.y + pad },
    };
  }
}
