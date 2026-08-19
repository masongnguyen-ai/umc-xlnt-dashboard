import type { Alert, ApprovalStatus, ChemDoseLog, ChemImportConfirm, ChemRestockRequest, Incident, OpLog } from "./types";

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  NHAP: "Nháp",
  CHO_DUYET: "Chờ duyệt",
  DA_CHOT: "Đã chốt",
  TRA_LAI: "Trả lại",
};

export function asApproval(status?: string | null): ApprovalStatus {
  if (status === "DA_DUYET" || status === "KHOA") return "DA_CHOT";
  if (status === "YEU_CAU_BO_SUNG") return "TRA_LAI";
  if (status === "NHAP" || status === "CHO_DUYET" || status === "DA_CHOT" || status === "TRA_LAI") return status;
  return "DA_CHOT";
}

export function isChot(status?: string | null): boolean {
  return asApproval(status) === "DA_CHOT";
}

export function isPending(status?: string | null): boolean {
  return status === "CHO_DUYET";
}

export function isReturned(status?: string | null): boolean {
  return asApproval(status) === "TRA_LAI";
}

export function canStaffEdit(status?: string | null): boolean {
  const s = asApproval(status);
  return s === "NHAP" || s === "TRA_LAI";
}

/** Phiếu cũ không có field status = đã chốt (không làm mất tồn hiện tại). */
export function isChemSettled(rec: { status?: string | null; locked?: boolean } | null | undefined): boolean {
  if (!rec) return false;
  if (rec.status) return isChot(rec.status);
  if (rec.locked) return true;
  return true;
}

export function restockApproval(r: ChemRestockRequest): ApprovalStatus {
  if (r.approvalStatus) return asApproval(r.approvalStatus);
  if (r.status === "DA_GIAO") return "DA_CHOT";
  if (r.status === "HUY") return "TRA_LAI";
  return "DA_CHOT";
}

export function incidentApproval(i: Incident): ApprovalStatus {
  return i.status ? asApproval(i.status) : "DA_CHOT";
}

export function settledDoses(doses: ChemDoseLog[]): ChemDoseLog[] {
  return doses.filter((d) => isChemSettled(d));
}

export function settledConfirms(confirms: ChemImportConfirm[]): ChemImportConfirm[] {
  return confirms.filter((c) => isChemSettled(c));
}

export function pendingLogs(logs: OpLog[]): OpLog[] {
  return logs.filter((l) => l.Trang_thai === "CHO_DUYET");
}

export function pendingDoses(doses: ChemDoseLog[]): ChemDoseLog[] {
  return doses.filter((d) => d.status === "CHO_DUYET");
}

export function pendingImports(confirms: ChemImportConfirm[]): ChemImportConfirm[] {
  return confirms.filter((c) => c.status === "CHO_DUYET");
}

export function pendingRestocks(restocks: ChemRestockRequest[]): ChemRestockRequest[] {
  return restocks.filter((r) => restockApproval(r) === "CHO_DUYET" && r.approvalStatus === "CHO_DUYET");
}

export function pendingIncidents(incidents: Incident[]): Incident[] {
  return incidents.filter((i) => i.status === "CHO_DUYET");
}

export function pendingChemCount(
  doses: ChemDoseLog[],
  confirms: ChemImportConfirm[],
  restocks: ChemRestockRequest[],
): number {
  return pendingDoses(doses).length + pendingImports(confirms).length + pendingRestocks(restocks).length;
}

/** Cảnh báo chưa xử lý trong 7 ngày — không đếm cả kho sheet ngưỡng cũ. */
export function openAlerts7d(alerts: Alert[]): number {
  const cut = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return alerts.filter((a) => {
    if (a.Trang_thai === "DA_XU_LY" || a.Trang_thai === "BO_QUA_CO_LY_DO") return false;
    const t = Date.parse(a.Ngay.length <= 10 ? `${a.Ngay}T00:00:00` : a.Ngay);
    return Number.isFinite(t) && t >= cut;
  }).length;
}

export function overlayPending<T>(
  local: T[] | undefined,
  remote: T[] | undefined,
  key: (item: T) => string,
  keep: (item: T) => boolean,
): T[] {
  if (remote === undefined) return local ?? [];
  const map = new Map(remote.map((item) => [key(item), item]));
  for (const item of local ?? []) {
    if (keep(item)) map.set(key(item), item);
  }
  return [...map.values()];
}
