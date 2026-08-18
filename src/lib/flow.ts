import { getDay } from "date-fns";
import { SHEET_FLOW_DAYS } from "./flow-data";
import type { Alert, FlowDay, SoftWarning, Threshold } from "./types";

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

function findTh(list: Threshold[], code: string) {
  return list.find((t) => t.Ma_nguong === code && t.Kich_hoat);
}

export function generateFlowDays(): FlowDay[] {
  return SHEET_FLOW_DAYS.map((d) => ({ ...d }));
}

export function parseSheetNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/⚠/g, "").replace(/,/g, "").replace(/\s/g, "").trim();
  if (!s || s.startsWith("#")) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseSheetDate(raw: string): { iso: string; ngay: string } | null {
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const ngay = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  return { iso, ngay };
}

export function parseFlowCsv(csvText: string): FlowDay[] {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const idx = (name: string) => headers.findIndex((h) => h.trim() === name);
  const iNgay = idx("Ngày");
  const iThu = idx("Thứ");
  const iNt = idx("LL Nước thải (24h)");
  const iDem = idx("LL Đêm (NThải)");
  const i600 = idx("LL Hệ 600 (24h)");
  const i220 = idx("LL Hệ 220 (24h)");
  const iCap = idx("LL Nước cấp A+B (24h)");
  const iChenh = idx("Chênh lệch Cấp − Thải");
  const iNtDay = idx("LL NThải ban ngày");
  const iCapDay = idx("LL Cấp ban ngày");
  const i600Day = idx("LL Hệ 600 ban ngày");
  const i220Day = idx("LL Hệ 220 ban ngày");
  const iCapA = idx("LL Cấp A (24h)");
  const iCapB = idx("LL Cấp B (24h)");
  const iVaoB = idx("LL Đầu vào Khu B (24h)");
  const iThat = idx("Thất thoát Khu B (24h)");
  const iNt730 = idx("NThải 7:30");
  const iNt1730 = idx("NThải 17:30 hôm trước");
  const iM600 = idx("600 7:30");
  const iM220 = idx("220 7:30");

  const out: FlowDay[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const dated = parseSheetDate(cols[iNgay] ?? "");
    const llnt = parseSheetNumber(cols[iNt]);
    if (!dated || llnt == null) continue;
    const ntday = parseSheetNumber(cols[iNtDay]) ?? 0;
    const llcap = parseSheetNumber(cols[iCap]) ?? 0;
    const capday = parseSheetNumber(cols[iCapDay]) ?? 0;
    const lldem = parseSheetNumber(cols[iDem]);
    out.push({
      iso: dated.iso,
      ngay: dated.ngay,
      thu: (cols[iThu] ?? "").trim() || DOW[getDay(new Date(dated.iso + "T00:00:00"))],
      llnt,
      ntday,
      lldem: lldem ?? llnt - ntday,
      ll600: parseSheetNumber(cols[i600]) ?? 0,
      he600day: parseSheetNumber(cols[i600Day]) ?? 0,
      ll220: parseSheetNumber(cols[i220]) ?? 0,
      he220day: parseSheetNumber(cols[i220Day]) ?? 0,
      llcap,
      capday,
      capdem: llcap - capday,
      llcapA: parseSheetNumber(cols[iCapA]) ?? 0,
      llcapB: parseSheetNumber(cols[iCapB]) ?? 0,
      llvaoB: parseSheetNumber(cols[iVaoB]) ?? 0,
      thatthoatB: parseSheetNumber(cols[iThat]) ?? 0,
      chenh: parseSheetNumber(cols[iChenh]) ?? 0,
      cb: "",
      nt730: parseSheetNumber(cols[iNt730]),
      nt1730: parseSheetNumber(cols[iNt1730]),
      m600: parseSheetNumber(cols[iM600]),
      m220: parseSheetNumber(cols[iM220]),
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function annotateFlow(days: FlowDay[], thresholds: Threshold[]): FlowDay[] {
  return days.map((d) => {
    const flags: string[] = [];
    const weekend = d.thu === "T7" || d.thu === "CN";
    const nt = findTh(thresholds, weekend ? "NT_CUOI_TUAN" : "NT_NGAY_THUONG");
    if (nt && d.llnt > nt.Gia_tri_1) flags.push(`Vượt thải ${nt.Gia_tri_1} m³`);
    const h6 = findTh(thresholds, "HE600_MAX");
    if (h6 && d.ll600 > h6.Gia_tri_1) flags.push(`Hệ 600 > ${h6.Gia_tri_1} m³`);
    const h2 = findTh(thresholds, "HE220_KHOANG");
    if (h2 && h2.Gia_tri_2 != null && (d.ll220 < h2.Gia_tri_1 || d.ll220 > h2.Gia_tri_2)) {
      flags.push(`Hệ 220 ngoài ${h2.Gia_tri_1}–${h2.Gia_tri_2} m³`);
    }
    const ch = findTh(thresholds, "CHENH_CAP_THAI");
    if (ch && d.chenh > ch.Gia_tri_1) flags.push(`Chênh > ${ch.Gia_tri_1} m³`);
    const tt = findTh(thresholds, "THAT_THOAT_B");
    if (tt && tt.Gia_tri_2 != null && (d.thatthoatB < tt.Gia_tri_1 || d.thatthoatB > tt.Gia_tri_2)) {
      const band = tt.Gia_tri_1 === -tt.Gia_tri_2 ? `±${tt.Gia_tri_2}` : `${tt.Gia_tri_1}–${tt.Gia_tri_2}`;
      const val = Number.isInteger(d.thatthoatB)
        ? String(d.thatthoatB)
        : d.thatthoatB.toFixed(1).replace(".", ",");
      flags.push(`Thất thoát B ${val} m³ ngoài ${band}`);
    }
    return { ...d, cb: flags.length ? flags.join("; ") : "OK" };
  });
}

export function scanFlowAlerts(days: FlowDay[], thresholds: Threshold[], existing: Alert[]): Alert[] {
  const seen = new Set(existing.map((a) => `${a.Ngay}::${a.Loai_canh_bao}`));
  const created: Alert[] = [];

  const push = (a: Omit<Alert, "Alert_ID" | "Trang_thai" | "Nguoi_xu_ly" | "Ngay_cap_nhat" | "Ghi_chu_xu_ly">) => {
    const key = `${a.Ngay}::${a.Loai_canh_bao}`;
    if (seen.has(key)) return;
    seen.add(key);
    created.push({
      ...a,
      Alert_ID: `ALT-${a.Ngay.replace(/-/g, "")}-${a.Loai_canh_bao.slice(0, 6)}`,
      Trang_thai: "MOI",
      Nguoi_xu_ly: "",
      Ngay_cap_nhat: new Date().toISOString(),
      Ghi_chu_xu_ly: "",
    });
  };

  for (const d of days) {
    const weekend = d.thu === "T7" || d.thu === "CN";
    const nt = findTh(thresholds, weekend ? "NT_CUOI_TUAN" : "NT_NGAY_THUONG");
    if (nt && d.llnt > nt.Gia_tri_1) {
      push({
        Ngay: d.iso,
        Loai_canh_bao: nt.Ma_nguong,
        Muc_do: nt.Muc_do,
        Noi_dung: `Lưu lượng nước thải ${d.llnt} m³ vượt hạn ${nt.Gia_tri_1} m³`,
        Gia_tri: d.llnt,
        Nguong: String(nt.Gia_tri_1),
        Chi_so: "Nước thải 24h",
      });
    }
    const h6 = findTh(thresholds, "HE600_MAX");
    if (h6 && d.ll600 > h6.Gia_tri_1) {
      push({
        Ngay: d.iso,
        Loai_canh_bao: "HE600_MAX",
        Muc_do: h6.Muc_do,
        Noi_dung: `Hệ 600 ${d.ll600} m³ vượt hạn ${h6.Gia_tri_1} m³`,
        Gia_tri: d.ll600,
        Nguong: String(h6.Gia_tri_1),
        Chi_so: "Hệ 600",
      });
    }
    const h2 = findTh(thresholds, "HE220_KHOANG");
    if (h2 && h2.Gia_tri_2 != null && (d.ll220 < h2.Gia_tri_1 || d.ll220 > h2.Gia_tri_2)) {
      push({
        Ngay: d.iso,
        Loai_canh_bao: "HE220_KHOANG",
        Muc_do: h2.Muc_do,
        Noi_dung: `Hệ 220 ${d.ll220} m³ nằm ngoài ${h2.Gia_tri_1}–${h2.Gia_tri_2}`,
        Gia_tri: d.ll220,
        Nguong: `${h2.Gia_tri_1}–${h2.Gia_tri_2}`,
        Chi_so: "Hệ 220",
      });
    }
    const ch = findTh(thresholds, "CHENH_CAP_THAI");
    if (ch && d.chenh > ch.Gia_tri_1) {
      push({
        Ngay: d.iso,
        Loai_canh_bao: "CHENH_CAP_THAI",
        Muc_do: ch.Muc_do,
        Noi_dung: `Chênh cấp−thải ${d.chenh} m³ vượt hạn ${ch.Gia_tri_1} m³`,
        Gia_tri: d.chenh,
        Nguong: String(ch.Gia_tri_1),
        Chi_so: "Chênh cấp − thải",
      });
    }
    const tt = findTh(thresholds, "THAT_THOAT_B");
    if (tt && tt.Gia_tri_2 != null && (d.thatthoatB < tt.Gia_tri_1 || d.thatthoatB > tt.Gia_tri_2)) {
      push({
        Ngay: d.iso,
        Loai_canh_bao: "THAT_THOAT_B",
        Muc_do: tt.Muc_do,
        Noi_dung: `Thất thoát khu B ${d.thatthoatB} m³ ngoài [${tt.Gia_tri_1}, ${tt.Gia_tri_2}]`,
        Gia_tri: d.thatthoatB,
        Nguong: `[${tt.Gia_tri_1}, ${tt.Gia_tri_2}]`,
        Chi_so: "Thất thoát khu B",
      });
    }
  }
  return created;
}

function outOfRange(v: number, lo: number, hi: number) {
  return v < lo || v > hi;
}

export function softValidateLog(
  thresholds: Threshold[],
  data: {
    He_thong: string;
    pH_dau_vao: number;
    pH_dau_ra: number;
    SV30: number;
    Amoni: number | null;
    COD: number | null;
  },
): SoftWarning[] {
  const sys = data.He_thong === "He_220" ? "HE220" : "HE600";
  const warn: SoftWarning[] = [];
  const check = (code: string, value: number | null, label: string) => {
    if (value == null) return;
    const t = findTh(thresholds, code);
    if (!t || t.Gia_tri_2 == null) return;
    if (outOfRange(value, t.Gia_tri_1, t.Gia_tri_2)) {
      warn.push({
        code,
        message: `${label} = ${value} nằm ngoài dải ${t.Gia_tri_1}–${t.Gia_tri_2}`,
      });
    }
  };
  check(`PH_IN_${sys}`, data.pH_dau_vao, "pH đầu vào");
  check(`PH_OUT_${sys}`, data.pH_dau_ra, "pH đầu ra");
  check(`SV30_${sys}`, data.SV30, "SV30");
  check(`AMONI_${sys}`, data.Amoni, "Amoni");
  check(`COD_${sys}`, data.COD, "COD");
  return warn;
}

export function kpiClass(v: number | null | undefined, max: number) {
  if (v == null) return "";
  if (v < 0 || v > max) return "bad";
  if (v > max * 0.92) return "warn";
  return "ok";
}
