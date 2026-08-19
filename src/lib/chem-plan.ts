import type { ChemDoseLog, ChemImportConfirm, ChemQty, ChemReceipt } from "./types";
import raw from "./chem-plan-data.json";
import { isChemSettled } from "./approval";

export type { ChemQty, ChemImportConfirm, ChemReceipt, ChemDoseLog };

export type ChemDay = ChemQty & {
  iso: string;
  thu: string;
  half: boolean;
  matri600: number;
  matri220: number;
  naoh600: number;
  naoh220: number;
  nahco3600: number;
  nahco3220: number;
  javen600: number;
  javen220: number;
};

export type ChemMonth = ChemQty & { stt: number; from: string; to: string };

export type ChemSchedule = {
  stt: number;
  thang: string;
  nhap: string;
  baotri: string;
  nghiemthu: string;
};

export type ChemStockRow = ChemQty & {
  thang: string;
  loai: string;
  ngay: string;
};

export const CHEM_PLAN = raw as {
  source: string;
  contractFrom: string;
  contractTo: string;
  months: ChemMonth[];
  days: ChemDay[];
  schedule: ChemSchedule[];
  stock: ChemStockRow[];
  compare: {
    used: ChemQty;
    actual: ChemQty;
    hsmt: ChemQty;
    duActual: ChemQty;
    duHsmt: ChemQty;
  };
};

export const CHEM_ITEMS = [
  { key: "matri" as const, label: "Mật rỉ đường", unit: "kg", pack: "40 kg/can", split: true },
  { key: "naoh" as const, label: "NaOH ≥98%", unit: "kg", pack: "25 kg/bao", split: true },
  { key: "javen" as const, label: "Javen 10%", unit: "kg", pack: "30 kg/can", split: true },
  { key: "nahco3" as const, label: "NaHCO₃", unit: "kg", pack: "25 kg/bao · T2 và T5", split: true },
  { key: "micro" as const, label: "Microbelift", unit: "gallon", pack: "Thứ 2 · theo đợt", split: false },
];

const DAY_BY_ISO = new Map(CHEM_PLAN.days.map((d) => [d.iso, d]));

export function vnTodayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function findChemDay(iso: string) {
  return DAY_BY_ISO.get(iso);
}

export function findChemMonth(iso: string) {
  return CHEM_PLAN.months.find((m) => m.from <= iso && iso <= m.to);
}

export function nearbyDays(iso: string, span = 3) {
  return Array.from({ length: span * 2 + 1 }, (_, i) => {
    const d = shiftIso(iso, i - span);
    return findChemDay(d);
  }).filter((d): d is ChemDay => Boolean(d));
}

function parseVnDate(s: string) {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function toIsoDate(s: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return parseVnDate(s);
}

export function nextImport(iso: string) {
  return CHEM_PLAN.schedule.find((s) => {
    const d = toIsoDate(s.nhap);
    return d && d >= iso;
  });
}

export function nextMaintenance(iso: string) {
  return CHEM_PLAN.schedule.find((s) => {
    const d = toIsoDate(s.baotri);
    return d && d >= iso;
  });
}

export function stockForMonth(iso: string) {
  const m = findChemMonth(iso);
  if (!m) return [];
  const vnFrom = `${m.from.slice(8, 10)}/${m.from.slice(5, 7)}/${m.from.slice(0, 4)}`;
  const use = CHEM_PLAN.stock.find((r) => r.loai === "Sử dụng" && r.ngay.includes(vnFrom));
  if (!use) return [];
  return CHEM_PLAN.stock.filter((r) => r.thang === use.thang);
}

export function splitOf(day: ChemDay, key: (typeof CHEM_ITEMS)[number]["key"]) {
  if (key === "matri") return { a: day.matri600, b: day.matri220 };
  if (key === "naoh") return { a: day.naoh600, b: day.naoh220 };
  if (key === "javen") return { a: day.javen600, b: day.javen220 };
  if (key === "nahco3") return { a: day.nahco3600, b: day.nahco3220 };
  return { a: 0, b: 0 };
}

export const CHEM_QTY_KEYS = ["micro", "matri", "naoh", "nahco3", "javen"] as const;
export type ChemQtyKey = (typeof CHEM_QTY_KEYS)[number];

export const ZERO_QTY: ChemQty = { micro: 0, matri: 0, naoh: 0, nahco3: 0, javen: 0 };

export const CHEM_PACK: Record<ChemQtyKey, number> = {
  micro: 1,
  matri: 40,
  naoh: 25,
  nahco3: 25,
  javen: 30,
};

export function qtyOf(row: ChemQty): ChemQty {
  return {
    micro: row.micro,
    matri: row.matri,
    naoh: row.naoh,
    nahco3: row.nahco3,
    javen: row.javen,
  };
}

export function addQty(a: ChemQty, b: ChemQty): ChemQty {
  return {
    micro: roundQty(a.micro + b.micro, 1),
    matri: roundQty(a.matri + b.matri, 0),
    naoh: roundQty(a.naoh + b.naoh, 0),
    nahco3: roundQty(a.nahco3 + b.nahco3, 0),
    javen: roundQty(a.javen + b.javen, 0),
  };
}

export function subQty(a: ChemQty, b: ChemQty): ChemQty {
  return {
    micro: roundQty(Math.max(0, a.micro - b.micro), 1),
    matri: roundQty(Math.max(0, a.matri - b.matri), 0),
    naoh: roundQty(Math.max(0, a.naoh - b.naoh), 0),
    nahco3: roundQty(Math.max(0, a.nahco3 - b.nahco3), 0),
    javen: roundQty(Math.max(0, a.javen - b.javen), 0),
  };
}

function roundQty(n: number, d: number) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

export type ChemCyclePlan = {
  thang: string;
  importIso: string;
  useRange: string;
  endIso: string;
  plannedNhap: ChemQty;
  plannedUse: ChemQty;
};

export type ChemLedgerStatus = "du-kien" | "dang-nhap" | "cho-chot" | "da-chot";

export type ChemLedgerCycle = ChemCyclePlan & {
  open: ChemQty;
  nhap: ChemQty;
  use: ChemQty;
  close: ChemQty;
  status: ChemLedgerStatus;
  confirm?: ChemImportConfirm;
  receipts: ChemReceipt[];
  actualDays: number;
  plannedDays: number;
};

function parseCycles(): ChemCyclePlan[] {
  const cycles: ChemCyclePlan[] = [];
  let cur: Partial<ChemCyclePlan> | null = null;
  for (const row of CHEM_PLAN.stock) {
    if (row.loai === "Nhập kho") {
      cur = {
        thang: row.thang,
        importIso: toIsoDate(row.ngay) ?? "",
        plannedNhap: qtyOf(row),
      };
    } else if (row.loai === "Sử dụng" && cur) {
      cur.useRange = row.ngay;
      cur.plannedUse = qtyOf(row);
    } else if (row.loai === "Tồn cuối kỳ" && cur) {
      cur.endIso = toIsoDate(row.ngay) ?? "";
      cycles.push(cur as ChemCyclePlan);
      cur = null;
    }
  }
  return cycles;
}

export const CHEM_CYCLES = parseCycles();

export function sumReceipts(receipts: ChemReceipt[]): ChemQty {
  return receipts.reduce((acc, r) => addQty(acc, r.qty), ZERO_QTY);
}

export function normalizeConfirm(c: ChemImportConfirm, fallbackIso: string): ChemImportConfirm {
  const receipts = c.receipts?.length > 0 ? c.receipts : [{ id: "legacy", ngay: fallbackIso, qty: c.qty }];
  return {
    ...c,
    receipts,
    qty: sumReceipts(receipts),
    locked: c.locked ?? true,
  };
}

export function dayToQty(day: ChemDay): ChemQty {
  return {
    micro: day.micro,
    matri: day.matri,
    naoh: day.naoh,
    nahco3: day.nahco3,
    javen: day.javen,
  };
}

export function cycleDayRange(c: ChemCyclePlan) {
  const parts = c.useRange.split("–").map((s) => toIsoDate(s.trim()) ?? "");
  return { from: parts[0] || c.importIso, to: parts[1] || c.endIso };
}

export function usageInRange(from: string, to: string, doses: ChemDoseLog[]) {
  const byIso = new Map(doses.map((d) => [d.iso, d]));
  let qty = ZERO_QTY;
  let actualDays = 0;
  let plannedDays = 0;
  for (const d of CHEM_PLAN.days) {
    if (d.iso < from || d.iso > to) continue;
    const log = byIso.get(d.iso);
    if (log && isChemSettled(log)) {
      qty = addQty(qty, log.qty);
      actualDays += 1;
    } else {
      qty = addQty(qty, dayToQty(d));
      plannedDays += 1;
    }
  }
  return { qty, actualDays, plannedDays };
}

export function buildChemLedger(
  confirms: ChemImportConfirm[],
  today: string,
  doses: ChemDoseLog[] = [],
): ChemLedgerCycle[] {
  let carry = ZERO_QTY;
  return CHEM_CYCLES.map((c) => {
    const raw = confirms.find((x) => x.thang === c.thang);
    const official = raw && isChemSettled(raw) ? normalizeConfirm(raw, c.importIso) : undefined;
    const display = raw ? normalizeConfirm(raw, c.importIso) : undefined;
    const receipts = display?.receipts ?? [];
    const locked = Boolean(official?.locked);
    const nhap = official ? (official.qty ?? c.plannedNhap) : c.plannedNhap;
    const range = cycleDayRange(c);
    const used = usageInRange(range.from, range.to, doses);
    const use = used.qty;
    const open = carry;
    const close = subQty(addQty(open, nhap), use);
    let status: ChemLedgerStatus = "du-kien";
    if (locked) status = "da-chot";
    else if (raw?.status === "CHO_DUYET") status = "dang-nhap";
    else if (receipts.length) status = "dang-nhap";
    else if (today >= c.importIso) status = "cho-chot";
    carry = close;
    return {
      ...c,
      open,
      nhap,
      use,
      close,
      status,
      confirm: display,
      receipts,
      actualDays: used.actualDays,
      plannedDays: used.plannedDays,
    };
  });
}

export function ledgerForMonth(ledger: ChemLedgerCycle[], iso: string) {
  const m = findChemMonth(iso);
  if (!m) return ledger[0];
  const vnFrom = `${m.from.slice(8, 10)}/${m.from.slice(5, 7)}/${m.from.slice(0, 4)}`;
  return ledger.find((c) => c.useRange.includes(vnFrom)) ?? ledger.find((c) => c.thang.includes(m.from.slice(5, 7)));
}

export function liveChemStock(confirms: ChemImportConfirm[], doses: ChemDoseLog[], today: string): ChemQty {
  let stock = ZERO_QTY;
  for (const c of CHEM_CYCLES) {
    const raw = confirms.find((x) => x.thang === c.thang);
    const confirm = raw && isChemSettled(raw) ? normalizeConfirm(raw, c.importIso) : undefined;
    const receipts = confirm?.receipts ?? [];
    if (receipts.length) {
      for (const r of receipts) {
        if (r.ngay <= today) stock = addQty(stock, r.qty);
      }
    } else if (c.importIso <= today) {
      stock = addQty(stock, c.plannedNhap);
    }
    const range = cycleDayRange(c);
    if (range.from <= today) {
      const end = range.to < today ? range.to : today;
      stock = subQty(stock, usageInRange(range.from, end, doses).qty);
    }
  }
  return stock;
}

export function daysCovered(stock: ChemQty, afterIso: string) {
  let left = { ...stock };
  let n = 0;
  for (const d of CHEM_PLAN.days) {
    if (d.iso <= afterIso) continue;
    const need = dayToQty(d);
    if (CHEM_QTY_KEYS.some((k) => need[k] > 0 && left[k] < need[k])) break;
    left = subQty(left, need);
    n += 1;
    if (n >= 45) break;
  }
  return n;
}

export function ceilPack(n: number, pack: number) {
  if (n <= 0) return 0;
  return Math.ceil(n / pack) * pack;
}

export function suggestRestock(stock: ChemQty, today: string): ChemQty {
  const next = nextImport(shiftIso(today, 1));
  const until = next ? (toIsoDate(next.nhap) ?? shiftIso(today, 14)) : shiftIso(today, 14);
  const need = usageInRange(shiftIso(today, 1), until, []).qty;
  const buffer = usageInRange(shiftIso(until, 1), shiftIso(until, 3), []).qty;
  const gap = subQty(addQty(need, buffer), stock);
  return {
    micro: ceilPack(gap.micro, CHEM_PACK.micro),
    matri: ceilPack(gap.matri, CHEM_PACK.matri),
    naoh: ceilPack(gap.naoh, CHEM_PACK.naoh),
    nahco3: ceilPack(gap.nahco3, CHEM_PACK.nahco3),
    javen: ceilPack(gap.javen, CHEM_PACK.javen),
  };
}

export function findDose(doses: ChemDoseLog[], iso: string) {
  return doses.find((d) => d.iso === iso);
}
