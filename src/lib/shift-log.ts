import { ABNORMAL_RESULT_LABEL, HANDOVER_STATUS_LABEL, SHIFT_LABEL, fmtDate } from "@/lib/format";
import type { AbnormalResult, HandoverStatus, LogAbnormal, OpLog } from "@/lib/types";
import { uid } from "@/lib/utils";

const OPEN: AbnormalResult[] = ["DANG_THEO_DOI", "CHUA_XU_LY"];

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function emptyAbnormal(nguoi = ""): LogAbnormal {
  return {
    id: uid("ABN"),
    gio_phat_hien: nowTime(),
    hien_tuong: "",
    nguyen_nhan: "",
    da_xu_ly: "",
    nguoi_xu_ly: nguoi,
    ket_qua: "CHUA_XU_LY",
    anh: [],
  };
}

export function normalizeLog(log: OpLog): OpLog {
  const items = Array.isArray(log.Bat_thuong) ? log.Bat_thuong : [];
  const legacy = (log.Su_co_phat_sinh ?? "").trim();
  const bat =
    items.length > 0
      ? items.map((a) => ({
          ...emptyAbnormal(),
          ...a,
          anh: Array.isArray(a.anh) ? a.anh : [],
        }))
      : legacy
        ? [
            {
              ...emptyAbnormal(),
              gio_phat_hien: "",
              hien_tuong: log.Su_co_phat_sinh,
              da_xu_ly: log.Bien_phap_khac_phuc ?? "",
              ket_qua: "DANG_THEO_DOI" as const,
            },
          ]
        : [];
  const co = log.Co_bat_thuong ?? bat.length > 0;
  return {
    ...log,
    Co_bat_thuong: co,
    Bat_thuong: bat,
    Ban_giao_tinh_trang: log.Ban_giao_tinh_trang ?? (co ? "CAN_THEO_DOI" : "BINH_THUONG"),
    Ban_giao_theo_doi: log.Ban_giao_theo_doi ?? "",
  };
}

export function isOpenAbnormal(a: LogAbnormal) {
  return OPEN.includes(a.ket_qua) && a.hien_tuong.trim().length > 0;
}

export function followupLine(log: Pick<OpLog, "Ngay" | "Ca" | "He_thong">, a: LogAbnormal) {
  const he = log.He_thong === "He_600" ? "Hệ 600" : "Hệ 220";
  const gio = a.gio_phat_hien ? ` · ${a.gio_phat_hien}` : "";
  return `• ${fmtDate(log.Ngay)} ${SHIFT_LABEL[log.Ca]} ${he}${gio} — ${a.hien_tuong.trim()} (${ABNORMAL_RESULT_LABEL[a.ket_qua]})`;
}

export function listOpenFollowups(logs: OpLog[], exceptId?: string) {
  const out: { line: string; ket_qua: AbnormalResult; logId: string }[] = [];
  for (const log of logs) {
    if (exceptId && log.Log_ID === exceptId) continue;
    const n = normalizeLog(log);
    if (!n.Co_bat_thuong) continue;
    for (const a of n.Bat_thuong) {
      if (isOpenAbnormal(a)) out.push({ line: followupLine(n, a), ket_qua: a.ket_qua, logId: n.Log_ID });
    }
  }
  return out;
}

export function followupFromLogs(logs: OpLog[], exceptId?: string) {
  return listOpenFollowups(logs, exceptId)
    .map((x) => x.line)
    .join("\n");
}

export function followupForDraft(draft: OpLog, prior: OpLog[]) {
  const fromPrior = followupFromLogs(prior, draft.Log_ID);
  const current = draft.Co_bat_thuong
    ? draft.Bat_thuong.filter(isOpenAbnormal).map((a) => followupLine(draft, a)).join("\n")
    : "";
  return [fromPrior, current].filter(Boolean).join("\n");
}

export function inferHandover(draft: OpLog, prior: OpLog[]): HandoverStatus {
  const open: AbnormalResult[] = [];
  if (draft.Co_bat_thuong) {
    for (const a of draft.Bat_thuong) {
      if (isOpenAbnormal(a)) open.push(a.ket_qua);
    }
  }
  for (const log of prior) {
    if (log.Log_ID === draft.Log_ID) continue;
    const n = normalizeLog(log);
    if (!n.Co_bat_thuong) continue;
    for (const a of n.Bat_thuong) {
      if (isOpenAbnormal(a)) open.push(a.ket_qua);
    }
  }
  if (open.includes("CHUA_XU_LY")) return "CO_VAN_DE";
  if (open.includes("DANG_THEO_DOI")) return "CAN_THEO_DOI";
  return "BINH_THUONG";
}

export function syncLegacyIncident(log: OpLog): OpLog {
  const items = log.Co_bat_thuong ? log.Bat_thuong.filter((a) => a.hien_tuong.trim()) : [];
  return {
    ...log,
    Tinh_trang_he_thong: HANDOVER_STATUS_LABEL[log.Ban_giao_tinh_trang],
    Su_co_phat_sinh: items.map((a) => `${a.gio_phat_hien ? `${a.gio_phat_hien} ` : ""}${a.hien_tuong}`.trim()).join("; "),
    Bien_phap_khac_phuc: items
      .map((a) => `${a.da_xu_ly.trim() || "Chưa xử lý"} (${ABNORMAL_RESULT_LABEL[a.ket_qua]})`)
      .join("; "),
    Bat_thuong: log.Co_bat_thuong ? log.Bat_thuong : [],
  };
}

export function validateShiftLog(log: OpLog, asDraft: boolean): string | null {
  if (asDraft) return null;
  if (!log.Co_bat_thuong) return null;
  const filled = log.Bat_thuong.filter((a) => a.hien_tuong.trim());
  if (!filled.length) return "Đã chọn có bất thường — cần mô tả hiện tượng.";
  for (const a of filled) {
    if (!a.gio_phat_hien) return "Cần giờ phát hiện cho từng trường hợp bất thường.";
    if (!a.da_xu_ly.trim()) return "Cần ghi đã xử lý (hoặc ghi «chưa xử lý»).";
  }
  return null;
}
