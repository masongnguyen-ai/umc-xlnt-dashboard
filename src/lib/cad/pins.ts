import type { CadPin, DxfDoc } from "./types";

const ID_RE = /\b(TB-(?:600|220)-\d{2})\b/i;

export function pinsFromDxf(doc: DxfDoc, knownIds?: Set<string>): CadPin[] {
  const found = new Map<string, CadPin>();
  for (const e of doc.entities) {
    if (e.type !== "TEXT" && e.type !== "INSERT") continue;
    const raw = e.type === "TEXT" ? e.value : e.name;
    const m = raw.toUpperCase().match(ID_RE);
    if (!m) continue;
    const id = m[1]!.toUpperCase().replace("TB-600-", "TB-600-").replace("TB-220-", "TB-220-");
    const canon = id.startsWith("TB-600") || id.startsWith("TB-220") ? id : m[1]!.toUpperCase();
    if (knownIds && !knownIds.has(canon)) continue;
    found.set(canon, { equipmentId: canon, x: e.x, y: e.y, label: raw });
  }
  return [...found.values()];
}

export function mergePins(base: CadPin[], extra: CadPin[]): CadPin[] {
  const map = new Map<string, CadPin>();
  for (const p of base) map.set(p.equipmentId, p);
  for (const p of extra) map.set(p.equipmentId, p);
  return [...map.values()];
}

export function nearestPin(pins: CadPin[], x: number, y: number, maxDist: number): CadPin | null {
  let best: CadPin | null = null;
  let bestD = maxDist;
  for (const p of pins) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
