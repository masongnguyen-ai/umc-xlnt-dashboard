import { isChot } from "@/lib/approval";
import { validateShiftLog, normalizeLog, syncLegacyIncident } from "@/lib/shift-log";
import type {
  ApprovalStatus,
  ChemDoseLog,
  ChemImportConfirm,
  ChemQty,
  ChemReceipt,
  ChemRestockRequest,
  Incident,
  Maintenance,
  OpLog,
  Role,
} from "@/lib/types";
import { uid } from "@/lib/utils";
import {
  appendBaoTri,
  appendDieuDong,
  appendHoaChatLieu,
  appendHoaChatNhap,
  appendLoginLog,
  appendNhatKy,
  appendSuCo,
  loadOpsLedger,
} from "./ops-sheet.server";
import { requireAction } from "./staff.server";
import type { SheetSyncInfo } from "./types";

function managerOnly(role: Role) {
  if (role !== "QUAN_LY") throw new Error("Chỉ quản lý được chốt / trả lại / mở lại.");
}

export async function persistShiftLogServer(
  authUserId: string,
  input: { log: OpLog; asDraft: boolean },
): Promise<{ ok: true; log: OpLog; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_nhatky");
  const err = validateShiftLog(input.log, input.asDraft);
  if (err) return { ok: false, error: err };
  const ledger = await loadOpsLedger();
  const existing = input.log.Log_ID ? ledger.logs.find((l) => l.Log_ID === input.log.Log_ID) : undefined;
  if (existing && isChot(existing.Trang_thai)) {
    return { ok: false, error: "Phiếu đã chốt. Chỉ quản lý được mở lại." };
  }
  if (existing?.Trang_thai === "CHO_DUYET" && staff.Vai_tro !== "QUAN_LY") {
    return { ok: false, error: "Đang chờ quản lý duyệt — không sửa được." };
  }
  const status: ApprovalStatus = input.asDraft ? "NHAP" : "CHO_DUYET";
  const now = new Date().toISOString();
  const saved: OpLog = {
    ...syncLegacyIncident(normalizeLog(input.log)),
    Log_ID: input.log.Log_ID || uid("LOG"),
    Trang_thai: status,
    Nguoi_tao: input.log.Nguoi_tao || staff.Email,
    Nguoi_sua: staff.Email,
    Ngay_tao: input.log.Ngay_tao || now,
    Ngay_sua: now,
    approvedBy: undefined,
    approvedAt: undefined,
    reviewNote: undefined,
  };
  try {
    const sheet = await appendNhatKy({
      log: saved,
      email: staff.Email,
      name: staff.Ho_ten,
      role: staff.Vai_tro,
    });
    return { ok: true, log: saved, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab NHAT_KY." };
  }
}

export async function reviewShiftLogServer(
  authUserId: string,
  input: { id: string; action: "CHOT" | "TRA_LAI" | "MO_LAI"; note: string },
): Promise<{ ok: true; log: OpLog; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "approve_nhatky");
  managerOnly(staff.Vai_tro);
  const ledger = await loadOpsLedger();
  const prev = ledger.logs.find((l) => l.Log_ID === input.id);
  if (!prev) return { ok: false, error: "Không tìm thấy nhật ký trên Sheet." };
  if (input.action === "MO_LAI") {
    if (!isChot(prev.Trang_thai)) return { ok: false, error: "Chỉ mở lại phiếu đã chốt." };
  } else if (prev.Trang_thai !== "CHO_DUYET") {
    return { ok: false, error: "Chỉ chốt phiếu đang chờ duyệt." };
  }
  const now = new Date().toISOString();
  const next: OpLog = {
    ...prev,
    Trang_thai: input.action === "CHOT" ? "DA_CHOT" : input.action === "TRA_LAI" ? "TRA_LAI" : "NHAP",
    approvedBy: input.action === "MO_LAI" ? undefined : staff.Email,
    approvedAt: input.action === "MO_LAI" ? undefined : now,
    reviewNote: input.note,
    Nguoi_sua: staff.Email,
    Ngay_sua: now,
  };
  try {
    const sheet = await appendNhatKy({ log: next, email: staff.Email, name: staff.Ho_ten, role: staff.Vai_tro });
    return { ok: true, log: next, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab NHAT_KY." };
  }
}

export async function persistDoseServer(
  authUserId: string,
  input: { iso: string; qty: ChemQty; note: string },
): Promise<{ ok: true; dose: ChemDoseLog; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_chem_dose");
  if (!input.iso) return { ok: false, error: "Thiếu ngày châm." };
  if (Object.values(input.qty).some((n) => n < 0 || Number.isNaN(n))) {
    return { ok: false, error: "Liều không được âm." };
  }
  const ledger = await loadOpsLedger();
  const existing = ledger.doses.find((d) => d.iso === input.iso);
  if (existing && isChot(existing.status)) {
    return { ok: false, error: "Liều đã chốt. Chỉ quản lý được mở lại." };
  }
  if (existing?.status === "CHO_DUYET" && staff.Vai_tro !== "QUAN_LY") {
    return { ok: false, error: "Đang chờ quản lý duyệt — không sửa được." };
  }
  const rec: ChemDoseLog = {
    iso: input.iso,
    qty: input.qty,
    actor: staff.Email,
    at: new Date().toISOString(),
    note: input.note,
    status: "CHO_DUYET",
  };
  try {
    const sheet = await appendHoaChatLieu({
      iso: rec.iso,
      qty: rec.qty,
      email: staff.Email,
      name: staff.Ho_ten,
      status: "CHO_DUYET",
    });
    return { ok: true, dose: rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab HOA_CHAT_LIEU." };
  }
}

export async function reviewDoseServer(
  authUserId: string,
  input: { iso: string; action: "CHOT" | "TRA_LAI" | "MO_LAI"; note: string },
): Promise<{ ok: true; dose: ChemDoseLog; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "approve_hoachat");
  managerOnly(staff.Vai_tro);
  const ledger = await loadOpsLedger();
  const prev = ledger.doses.find((d) => d.iso === input.iso);
  if (!prev) return { ok: false, error: "Không tìm thấy phiếu liều trên Sheet." };
  if (input.action === "MO_LAI") {
    if (!isChot(prev.status)) return { ok: false, error: "Chỉ mở lại phiếu đã chốt." };
  } else if (prev.status !== "CHO_DUYET") {
    return { ok: false, error: "Chỉ chốt phiếu đang chờ duyệt." };
  }
  const now = new Date().toISOString();
  const status: ApprovalStatus =
    input.action === "CHOT" ? "DA_CHOT" : input.action === "TRA_LAI" ? "TRA_LAI" : "NHAP";
  const rec: ChemDoseLog = {
    ...prev,
    status,
    approvedBy: input.action === "MO_LAI" ? undefined : staff.Email,
    approvedAt: input.action === "MO_LAI" ? undefined : now,
    reviewNote: input.note,
  };
  try {
    const sheet = await appendHoaChatLieu({
      iso: rec.iso,
      qty: rec.qty,
      email: staff.Email,
      name: staff.Ho_ten,
      status,
      approvedBy: rec.approvedBy,
      approvedAt: rec.approvedAt,
    });
    return { ok: true, dose: rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab HOA_CHAT_LIEU." };
  }
}

export async function persistImportServer(
  authUserId: string,
  input: { thang: string; receipts: ChemReceipt[]; note: string; submit: boolean },
): Promise<{ ok: true; confirm: ChemImportConfirm; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_hoachat");
  if (!input.thang) return { ok: false, error: "Thiếu kỳ nhập." };
  if (!input.receipts.length) return { ok: false, error: "Cần ít nhất một ngày nhập." };
  const ledger = await loadOpsLedger();
  const existing = ledger.confirms.find((c) => c.thang === input.thang);
  if (existing && isChot(existing.status) && staff.Vai_tro !== "QUAN_LY") {
    return { ok: false, error: "Kỳ đã chốt. Chỉ quản lý được mở lại." };
  }
  if (existing?.status === "CHO_DUYET" && staff.Vai_tro !== "QUAN_LY") {
    return { ok: false, error: "Đang chờ quản lý duyệt — không sửa được." };
  }
  const qty = input.receipts.reduce(
    (acc, r) => ({
      micro: acc.micro + r.qty.micro,
      matri: acc.matri + r.qty.matri,
      naoh: acc.naoh + r.qty.naoh,
      nahco3: acc.nahco3 + r.qty.nahco3,
      javen: acc.javen + r.qty.javen,
    }),
    { micro: 0, matri: 0, naoh: 0, nahco3: 0, javen: 0 },
  );
  const rec: ChemImportConfirm = {
    thang: input.thang,
    receipts: input.receipts,
    qty,
    locked: input.submit && staff.Vai_tro === "QUAN_LY",
    actor: staff.Email,
    at: new Date().toISOString(),
    note: input.note,
    status: input.submit ? (staff.Vai_tro === "QUAN_LY" ? "DA_CHOT" : "CHO_DUYET") : "NHAP",
    approvedBy: input.submit && staff.Vai_tro === "QUAN_LY" ? staff.Email : undefined,
    approvedAt: input.submit && staff.Vai_tro === "QUAN_LY" ? new Date().toISOString() : undefined,
  };
  try {
    const sheet = await appendHoaChatNhap({ confirm: rec, email: staff.Email, name: staff.Ho_ten });
    return { ok: true, confirm: rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab HOA_CHAT_NHAP." };
  }
}

export async function reviewImportServer(
  authUserId: string,
  input: { thang: string; action: "CHOT" | "TRA_LAI"; note: string },
): Promise<{ ok: true; confirm: ChemImportConfirm; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "approve_hoachat");
  managerOnly(staff.Vai_tro);
  const ledger = await loadOpsLedger();
  const prev = ledger.confirms.find((c) => c.thang === input.thang);
  if (!prev) return { ok: false, error: "Không tìm thấy phiếu nhập trên Sheet." };
  if (prev.status !== "CHO_DUYET") return { ok: false, error: "Chỉ chốt phiếu đang chờ duyệt." };
  const now = new Date().toISOString();
  const rec: ChemImportConfirm = {
    ...prev,
    status: input.action === "CHOT" ? "DA_CHOT" : "TRA_LAI",
    locked: input.action === "CHOT",
    approvedBy: staff.Email,
    approvedAt: now,
    reviewNote: input.note,
  };
  try {
    const sheet = await appendHoaChatNhap({ confirm: rec, email: staff.Email, name: staff.Ho_ten });
    return { ok: true, confirm: rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab HOA_CHAT_NHAP." };
  }
}

export async function persistRestockServer(
  authUserId: string,
  input: { reason: string; qty: ChemQty },
): Promise<{ ok: true; rec: ChemRestockRequest; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_chem_dose");
  if (Object.values(input.qty).every((n) => n <= 0)) {
    return { ok: false, error: "Chưa có khối lượng cần điều động." };
  }
  const rec: ChemRestockRequest = {
    id: uid("RST"),
    at: new Date().toISOString(),
    actor: staff.Email,
    reason: input.reason,
    qty: input.qty,
    status: "MOI",
    approvalStatus: "CHO_DUYET",
  };
  try {
    const sheet = await appendDieuDong({ rec, email: staff.Email, name: staff.Ho_ten });
    return { ok: true, rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab HOA_CHAT_DIEU_DONG." };
  }
}

export async function reviewRestockServer(
  authUserId: string,
  input: { id: string; action: "CHOT" | "TRA_LAI"; note: string },
): Promise<{ ok: true; rec: ChemRestockRequest; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "approve_hoachat");
  managerOnly(staff.Vai_tro);
  const ledger = await loadOpsLedger();
  const prev = ledger.restocks.find((r) => r.id === input.id);
  if (!prev) return { ok: false, error: "Không tìm thấy phiếu điều động trên Sheet." };
  if (prev.approvalStatus !== "CHO_DUYET") return { ok: false, error: "Chỉ chốt phiếu đang chờ duyệt." };
  const now = new Date().toISOString();
  const rec: ChemRestockRequest = {
    ...prev,
    approvalStatus: input.action === "CHOT" ? "DA_CHOT" : "TRA_LAI",
    status: input.action === "TRA_LAI" ? "HUY" : prev.status,
    approvedBy: staff.Email,
    approvedAt: now,
    reviewNote: input.note,
  };
  try {
    const sheet = await appendDieuDong({ rec, email: staff.Email, name: staff.Ho_ten });
    return { ok: true, rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab HOA_CHAT_DIEU_DONG." };
  }
}

export async function persistIncidentServer(
  authUserId: string,
  inc: Incident,
): Promise<{ ok: true; rec: Incident; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_thietbi");
  const rec: Incident = {
    ...inc,
    Incident_ID: inc.Incident_ID || uid("INC"),
    status: staff.Vai_tro === "QUAN_LY" ? "DA_CHOT" : "CHO_DUYET",
    approvedBy: staff.Vai_tro === "QUAN_LY" ? staff.Email : undefined,
    approvedAt: staff.Vai_tro === "QUAN_LY" ? new Date().toISOString() : undefined,
  };
  try {
    const sheet = await appendSuCo({ inc: rec, email: staff.Email, name: staff.Ho_ten });
    return { ok: true, rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab SU_CO_TB." };
  }
}

export async function reviewIncidentServer(
  authUserId: string,
  input: { id: string; action: "CHOT" | "TRA_LAI"; note: string },
): Promise<{ ok: true; rec: Incident; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "approve_thietbi");
  managerOnly(staff.Vai_tro);
  const ledger = await loadOpsLedger();
  const prev = ledger.incidents.find((i) => i.Incident_ID === input.id);
  if (!prev) return { ok: false, error: "Không tìm thấy sự cố trên Sheet." };
  if (prev.status !== "CHO_DUYET") return { ok: false, error: "Chỉ chốt phiếu đang chờ duyệt." };
  const rec: Incident = {
    ...prev,
    status: input.action === "CHOT" ? "DA_CHOT" : "TRA_LAI",
    approvedBy: staff.Email,
    approvedAt: new Date().toISOString(),
    reviewNote: input.note,
  };
  try {
    const sheet = await appendSuCo({ inc: rec, email: staff.Email, name: staff.Ho_ten });
    return { ok: true, rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab SU_CO_TB." };
  }
}

export async function persistMaintServer(
  authUserId: string,
  m: Omit<Maintenance, "Maint_ID"> & { Maint_ID?: string },
): Promise<{ ok: true; rec: Maintenance; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_thietbi");
  const rec: Maintenance = { ...m, Maint_ID: m.Maint_ID || uid("MNT") };
  try {
    const sheet = await appendBaoTri({ m: rec, email: staff.Email, name: staff.Ho_ten });
    return { ok: true, rec, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab BAO_TRI_TB." };
  }
}

export async function persistLoginServer(input: {
  email: string;
  name: string;
  role: string;
  event: "DANG_NHAP" | "DANG_XUAT" | "DANG_KY" | "THAT_BAI";
}): Promise<{ ok: true; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  try {
    const sheet = await appendLoginLog(input);
    return { ok: true, sheet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không ghi được tab LOGIN_LOG." };
  }
}
