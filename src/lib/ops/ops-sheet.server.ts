/**
 * Ghi / đọc vận hành trên não chính (Google Sheets).
 * Server-only. Tab lưu lượng không đụng.
 */
import {
  appendMainRow,
  appendMainRows,
  ensureMainTab,
  getMainSheetData,
  GoogleSheetsError,
  type SheetCell,
} from "@/lib/google-sheets";
import { asApproval, isChot, isPending } from "@/lib/approval";
import { CHEM_ITEMS, dayToQty, findChemDay } from "@/lib/chem-plan";
import type {
  ApprovalStatus,
  ChemDoseLog,
  ChemImportConfirm,
  ChemQty,
  ChemRestockRequest,
  Incident,
  Maintenance,
  OpLog,
  Role,
} from "@/lib/types";
import type { SheetAuditRow, SheetSyncInfo } from "./types";
import { OPS_SHEET_TABS } from "./types";

const HEADERS: Record<(typeof OPS_SHEET_TABS)[number], string[]> = {
  NHAT_KY: [
    "Log_ID",
    "Iso",
    "Ca",
    "Nguoi_nhap",
    "Email",
    "Chuc_vu",
    "Noi_dung",
    "Checklist_JSON",
    "Trang_thai",
    "Nguoi_duyet",
    "Luc_duyet",
    "Ghi_chu_duyet",
  ],
  HOA_CHAT_LIEU: [
    "Dose_ID",
    "Iso",
    "Chat",
    "Lieu_ke_hoach",
    "Lieu_thuc_te",
    "Don_vi",
    "Nguoi_cham",
    "Email",
    "Trang_thai",
    "Nguoi_duyet",
    "Luc_duyet",
  ],
  HOA_CHAT_NHAP: [
    "Confirm_ID",
    "Cycle_ID",
    "Chat",
    "Ngay_nhap",
    "So_luong",
    "Nguoi_xac_nhan",
    "Email",
    "Trang_thai",
    "Nguoi_duyet",
    "Luc_duyet",
  ],
  HOA_CHAT_DIEU_DONG: [
    "Restock_ID",
    "Chat",
    "So_luong",
    "Ly_do",
    "Nguoi_gui",
    "Email",
    "Trang_thai",
    "Nguoi_duyet",
    "Luc_duyet",
  ],
  SU_CO_TB: [
    "Incident_ID",
    "Equipment_ID",
    "Mo_ta",
    "Xu_ly",
    "Nguoi_ghi",
    "Email",
    "Trang_thai",
    "Nguoi_duyet",
    "Luc_duyet",
  ],
  BAO_TRI_TB: ["Maint_ID", "Equipment_ID", "Hang_muc", "Ngay", "Nguoi_ghi", "Email", "Ghi_chu"],
  LOGIN_LOG: ["Thoi_gian+07", "Email", "Ho_ten", "Vai_tro", "Su_kien", "IP", "Thiet_bi"],
};

function cell(row: SheetCell[], i: number) {
  const v = row[i];
  if (v == null) return "";
  return String(v);
}

function lastById(rows: SheetCell[][], idCol = 0): Map<string, SheetCell[]> {
  const map = new Map<string, SheetCell[]>();
  for (const row of rows.slice(1)) {
    const id = cell(row, idCol).trim();
    if (id) map.set(id, row);
  }
  return map;
}

function vnNow() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");
}

export async function ensureOpsTabs() {
  for (const tab of OPS_SHEET_TABS) {
    await ensureMainTab(tab, HEADERS[tab]);
  }
}

function okSheet(tabs: string[]): SheetSyncInfo {
  return { ok: true, mode: "sheets", tabs };
}

function failSheet(tabs: string[], err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  throw new GoogleSheetsError(msg, { cause: err });
}

export async function appendNhatKy(input: {
  log: OpLog;
  email: string;
  name: string;
  role: Role;
}) {
  await ensureOpsTabs();
  const { log, email, name, role } = input;
  const payload = {
    He_thong: log.He_thong,
    Nhiet_do: log.Nhiet_do,
    pH_dau_vao: log.pH_dau_vao,
    pH_dau_ra: log.pH_dau_ra,
    DO: log.DO,
    SV30: log.SV30,
    Luu_luong_nt: log.Luu_luong_nt,
    Amoni: log.Amoni,
    COD: log.COD,
    Tinh_trang_he_thong: log.Tinh_trang_he_thong,
    Co_bat_thuong: log.Co_bat_thuong,
    Bat_thuong: log.Bat_thuong,
    Ban_giao_tinh_trang: log.Ban_giao_tinh_trang,
    Ban_giao_theo_doi: log.Ban_giao_theo_doi,
    Nguoi_xacnhan_BV: log.Nguoi_xacnhan_BV,
    Chucvu_xacnhan_BV: log.Chucvu_xacnhan_BV,
    Su_co_phat_sinh: log.Su_co_phat_sinh,
    Bien_phap_khac_phuc: log.Bien_phap_khac_phuc,
  };
  try {
    await appendMainRow("NHAT_KY", [
      log.Log_ID,
      log.Ngay,
      log.Ca,
      log.Nguoi_xacnhan_BV || name,
      email,
      log.Chucvu_xacnhan_BV || role,
      JSON.stringify(payload),
      log.Checklist_Ket_qua ?? "",
      log.Trang_thai,
      log.approvedBy ?? "",
      log.approvedAt ?? "",
      log.reviewNote ?? "",
    ]);
    return okSheet(["NHAT_KY"]);
  } catch (err) {
    failSheet(["NHAT_KY"], err);
  }
}

export function parseNhatKy(rows: SheetCell[][]): OpLog[] {
  const byId = lastById(rows);
  const out: OpLog[] = [];
  for (const row of byId.values()) {
    let body: Partial<OpLog> = {};
    try {
      body = JSON.parse(cell(row, 6) || "{}") as Partial<OpLog>;
    } catch {
      body = {};
    }
    const id = cell(row, 0);
    if (!id) continue;
    out.push({
      Log_ID: id,
      Ngay: cell(row, 1),
      Ca: (cell(row, 2) === "CHIEU" ? "CHIEU" : "SANG") as OpLog["Ca"],
      He_thong: body.He_thong === "He_220" ? "He_220" : "He_600",
      Nhiet_do: Number(body.Nhiet_do) || 29,
      pH_dau_vao: Number(body.pH_dau_vao) || 7,
      pH_dau_ra: Number(body.pH_dau_ra) || 7,
      DO: Number(body.DO) || 2.6,
      SV30: Number(body.SV30) || 0,
      Luu_luong_nt: Number(body.Luu_luong_nt) || 0,
      Amoni: body.Amoni ?? null,
      COD: body.COD ?? null,
      Tinh_trang_he_thong: body.Tinh_trang_he_thong ?? "",
      Su_co_phat_sinh: body.Su_co_phat_sinh ?? "",
      Bien_phap_khac_phuc: body.Bien_phap_khac_phuc ?? "",
      Co_bat_thuong: Boolean(body.Co_bat_thuong),
      Bat_thuong: Array.isArray(body.Bat_thuong) ? body.Bat_thuong : [],
      Ban_giao_tinh_trang: body.Ban_giao_tinh_trang ?? "BINH_THUONG",
      Ban_giao_theo_doi: body.Ban_giao_theo_doi ?? "",
      Trang_thai: asApproval(cell(row, 8)),
      Nguoi_tao: cell(row, 4),
      Nguoi_sua: cell(row, 9) || cell(row, 4),
      Ngay_tao: cell(row, 1),
      Ngay_sua: cell(row, 10) || cell(row, 1),
      Checklist_Ket_qua: cell(row, 7),
      Nguoi_xacnhan_BV: cell(row, 3),
      Chucvu_xacnhan_BV: cell(row, 5),
      Da_xacnhan_BV: isChot(cell(row, 8)),
      approvedBy: cell(row, 9) || undefined,
      approvedAt: cell(row, 10) || undefined,
      reviewNote: cell(row, 11) || undefined,
    });
  }
  return out.sort((a, b) => `${b.Ngay}${b.Ca}`.localeCompare(`${a.Ngay}${a.Ca}`));
}

export async function appendHoaChatLieu(input: {
  iso: string;
  qty: ChemQty;
  email: string;
  name: string;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
}) {
  await ensureOpsTabs();
  const day = findChemDay(input.iso);
  const plan = day ? dayToQty(day) : { micro: 0, matri: 0, naoh: 0, nahco3: 0, javen: 0 };
  const rows = CHEM_ITEMS.map((c) => [
    `${input.iso}__${c.key}`,
    input.iso,
    c.label,
    plan[c.key],
    input.qty[c.key],
    c.unit,
    input.name,
    input.email,
    input.status,
    input.approvedBy ?? "",
    input.approvedAt ?? "",
  ]);
  try {
    await appendMainRows("HOA_CHAT_LIEU", rows);
    return okSheet(["HOA_CHAT_LIEU"]);
  } catch (err) {
    failSheet(["HOA_CHAT_LIEU"], err);
  }
}

export function parseHoaChatLieu(rows: SheetCell[][]): ChemDoseLog[] {
  const last = lastById(rows);
  const byIso = new Map<string, ChemDoseLog>();
  for (const row of last.values()) {
    const iso = cell(row, 1);
    const chat = cell(row, 2);
    const item = CHEM_ITEMS.find((c) => c.label === chat);
    if (!iso || !item) continue;
    const cur = byIso.get(iso) ?? {
      iso,
      qty: { micro: 0, matri: 0, naoh: 0, nahco3: 0, javen: 0 },
      actor: cell(row, 7) || cell(row, 6),
      at: cell(row, 10) || iso,
      note: "",
      status: asApproval(cell(row, 8)),
      approvedBy: cell(row, 9) || undefined,
      approvedAt: cell(row, 10) || undefined,
    };
    cur.qty[item.key] = Number(cell(row, 4)) || 0;
    cur.status = asApproval(cell(row, 8));
    cur.approvedBy = cell(row, 9) || cur.approvedBy;
    cur.approvedAt = cell(row, 10) || cur.approvedAt;
    byIso.set(iso, cur);
  }
  return [...byIso.values()].sort((a, b) => b.iso.localeCompare(a.iso));
}

export async function appendHoaChatNhap(input: {
  confirm: ChemImportConfirm;
  email: string;
  name: string;
}) {
  await ensureOpsTabs();
  const { confirm, email, name } = input;
  const rows: SheetCell[][] = [];
  for (const r of confirm.receipts) {
    for (const c of CHEM_ITEMS) {
      rows.push([
        `${confirm.thang}__${r.id}__${c.key}`,
        confirm.thang,
        c.label,
        r.ngay,
        r.qty[c.key],
        name,
        email,
        confirm.status ?? (confirm.locked ? "DA_CHOT" : "NHAP"),
        confirm.approvedBy ?? "",
        confirm.approvedAt ?? "",
      ]);
    }
  }
  try {
    await appendMainRows("HOA_CHAT_NHAP", rows);
    return okSheet(["HOA_CHAT_NHAP"]);
  } catch (err) {
    failSheet(["HOA_CHAT_NHAP"], err);
  }
}

export function parseHoaChatNhap(rows: SheetCell[][]): ChemImportConfirm[] {
  const last = lastById(rows);
  const byCycle = new Map<string, ChemImportConfirm>();
  for (const row of last.values()) {
    const cycle = cell(row, 1);
    const chat = cell(row, 2);
    const ngay = cell(row, 3);
    const item = CHEM_ITEMS.find((c) => c.label === chat);
    if (!cycle || !item) continue;
    const rec =
      byCycle.get(cycle) ??
      ({
        thang: cycle,
        receipts: [],
        qty: { micro: 0, matri: 0, naoh: 0, nahco3: 0, javen: 0 },
        locked: isChot(cell(row, 7)),
        actor: cell(row, 6) || cell(row, 5),
        at: cell(row, 9) || ngay,
        note: "",
        status: asApproval(cell(row, 7)),
        approvedBy: cell(row, 8) || undefined,
        approvedAt: cell(row, 9) || undefined,
      } satisfies ChemImportConfirm);
    rec.status = asApproval(cell(row, 7));
    rec.locked = isChot(rec.status);
    rec.qty[item.key] += Number(cell(row, 4)) || 0;
    let receipt = rec.receipts.find((x) => x.ngay === ngay);
    if (!receipt) {
      receipt = {
        id: `${cycle}-${ngay}`,
        ngay,
        qty: { micro: 0, matri: 0, naoh: 0, nahco3: 0, javen: 0 },
      };
      rec.receipts.push(receipt);
    }
    receipt.qty[item.key] = Number(cell(row, 4)) || 0;
    byCycle.set(cycle, rec);
  }
  return [...byCycle.values()];
}

export async function appendDieuDong(input: {
  rec: ChemRestockRequest;
  email: string;
  name: string;
}) {
  await ensureOpsTabs();
  const st = input.rec.approvalStatus ?? "CHO_DUYET";
  const rows = CHEM_ITEMS.filter((c) => input.rec.qty[c.key] > 0).map((c) => [
    `${input.rec.id}__${c.key}`,
    c.label,
    input.rec.qty[c.key],
    input.rec.reason,
    input.name,
    input.email,
    st,
    input.rec.approvedBy ?? "",
    input.rec.approvedAt ?? "",
  ]);
  const payload = rows.length
    ? rows
    : [
        [
          `${input.rec.id}__all`,
          "—",
          0,
          input.rec.reason,
          input.name,
          input.email,
          st,
          input.rec.approvedBy ?? "",
          input.rec.approvedAt ?? "",
        ],
      ];
  try {
    await appendMainRows("HOA_CHAT_DIEU_DONG", payload);
    return okSheet(["HOA_CHAT_DIEU_DONG"]);
  } catch (err) {
    failSheet(["HOA_CHAT_DIEU_DONG"], err);
  }
}

export function parseDieuDong(rows: SheetCell[][]): ChemRestockRequest[] {
  const last = lastById(rows);
  const byId = new Map<string, ChemRestockRequest>();
  for (const row of last.values()) {
    const rawId = cell(row, 0);
    const id = rawId.split("__")[0] || rawId;
    const chat = cell(row, 1);
    const item = CHEM_ITEMS.find((c) => c.label === chat);
    const rec =
      byId.get(id) ??
      ({
        id,
        at: "",
        actor: cell(row, 5) || cell(row, 4),
        reason: cell(row, 3),
        qty: { micro: 0, matri: 0, naoh: 0, nahco3: 0, javen: 0 },
        status: "MOI",
        approvalStatus: asApproval(cell(row, 6)),
        approvedBy: cell(row, 7) || undefined,
        approvedAt: cell(row, 8) || undefined,
      } satisfies ChemRestockRequest);
    if (item) rec.qty[item.key] = Number(cell(row, 2)) || 0;
    rec.approvalStatus = asApproval(cell(row, 6));
    byId.set(id, rec);
  }
  return [...byId.values()];
}

export async function appendSuCo(input: {
  inc: Incident;
  email: string;
  name: string;
}) {
  await ensureOpsTabs();
  try {
    await appendMainRow("SU_CO_TB", [
      input.inc.Incident_ID,
      input.inc.Equipment_ID,
      input.inc.Mo_ta_su_co,
      input.inc.Bien_phap_xu_ly,
      input.name,
      input.email,
      input.inc.status ?? "CHO_DUYET",
      input.inc.approvedBy ?? "",
      input.inc.approvedAt ?? "",
    ]);
    return okSheet(["SU_CO_TB"]);
  } catch (err) {
    failSheet(["SU_CO_TB"], err);
  }
}

export function parseSuCo(rows: SheetCell[][]): Incident[] {
  const last = lastById(rows);
  return [...last.values()].map((row) => ({
    Incident_ID: cell(row, 0),
    Equipment_ID: cell(row, 1),
    Ngay_phat_sinh: "",
    Mo_ta_su_co: cell(row, 2),
    Bien_phap_xu_ly: cell(row, 3),
    Trang_thai: "MOI",
    Nguoi_khac_phuc: "",
    Ngay_hoan_thanh: "",
    status: asApproval(cell(row, 6)),
    approvedBy: cell(row, 7) || undefined,
    approvedAt: cell(row, 8) || undefined,
  }));
}

export async function appendBaoTri(input: {
  m: Maintenance;
  email: string;
  name: string;
}) {
  await ensureOpsTabs();
  try {
    await appendMainRow("BAO_TRI_TB", [
      input.m.Maint_ID,
      input.m.Equipment_ID,
      input.m.Noi_dung_bao_tri,
      input.m.Ngay_bao_tri,
      input.name,
      input.email,
      input.m.Ghi_chu,
    ]);
    return okSheet(["BAO_TRI_TB"]);
  } catch (err) {
    failSheet(["BAO_TRI_TB"], err);
  }
}

export function parseBaoTri(rows: SheetCell[][]): Maintenance[] {
  const last = lastById(rows);
  return [...last.values()].map((row) => ({
    Maint_ID: cell(row, 0),
    Equipment_ID: cell(row, 1),
    Ngay_bao_tri: cell(row, 3),
    Ket_qua: "",
    Noi_dung_bao_tri: cell(row, 2),
    Vat_tu_thay_the: "",
    Ghi_chu: cell(row, 6),
  }));
}

export async function appendLoginLog(input: {
  email: string;
  name: string;
  role: string;
  event: "DANG_NHAP" | "DANG_XUAT" | "DANG_KY" | "THAT_BAI";
}) {
  await ensureOpsTabs();
  let ip = "";
  let ua = "";
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    ua = req.headers.get("user-agent") || "";
  } catch {
    /* script / no request */
  }
  try {
    await appendMainRow("LOGIN_LOG", [vnNow(), input.email, input.name, input.role, input.event, ip, ua.slice(0, 180)]);
    return okSheet(["LOGIN_LOG"]);
  } catch (err) {
    failSheet(["LOGIN_LOG"], err);
  }
}

export async function loadOpsLedger(): Promise<{
  logs: OpLog[];
  doses: ChemDoseLog[];
  confirms: ChemImportConfirm[];
  restocks: ChemRestockRequest[];
  incidents: Incident[];
  maintenances: Maintenance[];
  audit: SheetAuditRow[];
  sheet: SheetSyncInfo;
}> {
  await ensureOpsTabs();
  const audit: SheetAuditRow[] = [];
  const read = async (
    tab: (typeof OPS_SHEET_TABS)[number],
    module: string,
    statusCol: number | null,
    group: (row: SheetCell[]) => string,
  ) => {
    try {
      const rows = await getMainSheetData(tab);
      const last = new Map<string, SheetCell[]>();
      for (const row of rows.slice(1)) {
        const id = group(row).trim();
        if (id) last.set(id, row);
      }
      let pending = 0;
      let chot = 0;
      if (statusCol != null) {
        for (const row of last.values()) {
          const st = asApproval(cell(row, statusCol));
          if (isPending(st)) pending += 1;
          if (isChot(st)) chot += 1;
        }
      }
      audit.push({ module, tab, wrote: last.size > 0, pending, chot });
      return rows;
    } catch (err) {
      audit.push({
        module,
        tab,
        wrote: false,
        pending: 0,
        chot: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as SheetCell[][];
    }
  };

  const [nhatky, lieu, nhap, dd, suco, baotri] = await Promise.all([
    read("NHAT_KY", "Nhật ký ca", 8, (row) => cell(row, 0)),
    read("HOA_CHAT_LIEU", "Liều hóa chất", 8, (row) => cell(row, 1)),
    read("HOA_CHAT_NHAP", "Nhập xe", 7, (row) => cell(row, 1)),
    read("HOA_CHAT_DIEU_DONG", "Điều động", 6, (row) => cell(row, 0).split("__")[0] ?? ""),
    read("SU_CO_TB", "Sự cố thiết bị", 6, (row) => cell(row, 0)),
    read("BAO_TRI_TB", "Bảo trì", null, (row) => cell(row, 0)),
  ]);
  try {
    const loginRows = await getMainSheetData("LOGIN_LOG");
    audit.push({ module: "Đăng nhập", tab: "LOGIN_LOG", wrote: loginRows.length > 1, pending: 0, chot: 0 });
  } catch (err) {
    audit.push({
      module: "Đăng nhập",
      tab: "LOGIN_LOG",
      wrote: false,
      pending: 0,
      chot: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const failed = audit.filter((a) => a.error);
  return {
    logs: parseNhatKy(nhatky),
    doses: parseHoaChatLieu(lieu),
    confirms: parseHoaChatNhap(nhap),
    restocks: parseDieuDong(dd),
    incidents: parseSuCo(suco),
    maintenances: parseBaoTri(baotri),
    audit,
    sheet: {
      ok: failed.length === 0,
      mode: "sheets",
      tabs: [...OPS_SHEET_TABS],
      error: failed.length ? failed.map((f) => `${f.tab}: ${f.error}`).join(" · ") : undefined,
    },
  };
}
