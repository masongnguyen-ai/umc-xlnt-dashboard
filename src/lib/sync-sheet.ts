import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type { FlowDay } from "@/lib/types";

export const SHEET_POLL_MS = 10 * 60 * 1000;
export const SHEET_DEDUP_MS = 20 * 1000;
const CHECK_KEY = "umc_sheet_checked";

type SheetPayload = { ok?: boolean; days?: FlowDay[]; error?: string };

export type LiveSyncState = {
  running: boolean;
  lastCheck: number;
  nextAt: number;
  error: string | null;
};

let live: LiveSyncState = { running: false, lastCheck: 0, nextAt: 0, error: null };
const liveSubs = new Set<(s: LiveSyncState) => void>();

export function getLiveSync() {
  return live;
}
export function subscribeLiveSync(fn: (s: LiveSyncState) => void) {
  liveSubs.add(fn);
  fn(live);
  return () => liveSubs.delete(fn);
}
function setLive(patch: Partial<LiveSyncState>) {
  live = { ...live, ...patch };
  liveSubs.forEach((fn) => fn(live));
}
export function noteNextPull(from = Date.now()) {
  setLive({ lastCheck: from, nextAt: from + SHEET_POLL_MS, running: false, error: null });
}

let inFlight: Promise<{ changed: boolean; last: FlowDay; rows: number }> | null = null;
let lastCheckAt = 0;

export function isIosClient() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function readLastCheck(): number {
  if (lastCheckAt) return lastCheckAt;
  try {
    const raw = sessionStorage.getItem(CHECK_KEY);
    if (raw) lastCheckAt = Number(raw) || 0;
  } catch {
    /* ignore */
  }
  return lastCheckAt;
}

export function markChecked(at = Date.now()) {
  lastCheckAt = at;
  try {
    sessionStorage.setItem(CHECK_KEY, String(at));
  } catch {
    /* ignore */
  }
  noteNextPull(at);
}

export function isSheetStale(maxAge = SHEET_POLL_MS) {
  const at = readLastCheck();
  if (!at) return true;
  return Date.now() - at >= maxAge;
}

export async function fetchSheetDays(): Promise<FlowDay[]> {
  const res = await fetch("/api/luu-luong", { cache: "no-store" });
  const body = (await res.json()) as SheetPayload;
  if (!body.ok || !body.days?.length) {
    throw new Error(body.error || "Sheet trống");
  }
  return body.days;
}

export function sheetFingerprint(days: FlowDay[]) {
  const last = days[days.length - 1];
  return last ? `${days.length}|${last.iso}|${last.llnt}|${last.ll600}|${last.ll220}|${last.cb}` : "";
}

export function applySheetDays(days: FlowDay[]) {
  const prev = useAppStore.getState().flowDays;
  const changed = sheetFingerprint(prev) !== sheetFingerprint(days);
  if (changed) useAppStore.getState().applyFlowDays(days);
  else {
    useAppStore.setState({ lastSynced: new Date().toISOString() });
  }
  markChecked();
  return { changed, last: days[days.length - 1], rows: days.length };
}

export async function syncSheet(opts?: { toast?: "always" | "change" | "never"; force?: boolean }) {
  const mode = opts?.toast ?? "never";
  if (inFlight) return inFlight;
  if (!opts?.force && lastCheckAt && Date.now() - lastCheckAt < SHEET_DEDUP_MS) {
    const days = useAppStore.getState().flowDays;
    const last = days[days.length - 1];
    if (last) return { changed: false, last, rows: days.length };
  }

  setLive({ running: true, error: null });
  inFlight = (async () => {
    const days = await fetchSheetDays();
    return applySheetDays(days);
  })();

  try {
    const result = await inFlight;
    if (mode === "always" || (mode === "change" && result.changed)) {
      toast.success(`Đã lấy ${result.rows} ngày · chốt ${result.last.ngay}.`);
    }
    return result;
  } catch (err) {
    setLive({ running: false, error: err instanceof Error ? err.message : "Lỗi nạp sheet" });
    throw err;
  } finally {
    inFlight = null;
    if (!live.error) setLive({ running: false });
  }
}

export async function hydrateFromSwCache() {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open("umc-live");
    const hit = await cache.match("/api/luu-luong");
    if (!hit) return false;
    const body = (await hit.json()) as SheetPayload;
    if (!body.ok || !body.days?.length) return false;
    applySheetDays(body.days);
    return true;
  } catch {
    return false;
  }
}
