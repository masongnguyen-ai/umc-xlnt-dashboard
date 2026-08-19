import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import type { AbnormalResult, HandoverStatus, Role, LogStatus, AlertStatus, UserStatus } from "./types";

export function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "–";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

export function fmtDate(iso: string) {
  if (!iso) return "–";
  try {
    return format(parseISO(iso.slice(0, 10)), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string) {
  if (!iso) return "–";
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: vi });
  } catch {
    return iso;
  }
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export const ROLE_LABEL: Record<Role, string> = {
  QUAN_LY: "Quản lý",
  NHA_THAU: "Nhà thầu",
  CA_TRUC: "Ca trực",
};

export const LOG_STATUS_LABEL: Record<LogStatus, string> = {
  NHAP: "Nháp",
  CHO_DUYET: "Chờ duyệt",
  DA_CHOT: "Đã chốt",
  TRA_LAI: "Trả lại",
  DA_DUYET: "Đã chốt",
  YEU_CAU_BO_SUNG: "Trả lại",
  KHOA: "Đã khóa",
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  MOI: "Mới",
  DA_XEM: "Đã xem",
  DANG_XU_LY: "Đang xử lý",
  DA_XU_LY: "Đã khắc phục",
  BO_QUA_CO_LY_DO: "Bỏ qua",
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  HOAT_DONG: "Hoạt động",
  TAM_KHOA: "Tạm khóa",
  NGUNG: "Ngừng",
};

export const SHIFT_LABEL = { SANG: "Ca sáng", CHIEU: "Ca chiều" } as const;

export const ABNORMAL_RESULT_LABEL: Record<AbnormalResult, string> = {
  DA_KHAC_PHUC: "Đã khắc phục",
  DANG_THEO_DOI: "Đang theo dõi",
  CHUA_XU_LY: "Chưa xử lý — cần bàn giao",
};

export const HANDOVER_STATUS_LABEL: Record<HandoverStatus, string> = {
  BINH_THUONG: "Bình thường",
  CAN_THEO_DOI: "Cần theo dõi",
  CO_VAN_DE: "Có vấn đề",
};

export const GROUP_LABEL = {
  LUU_LUONG: "Lưu lượng",
  CHAT_LUONG: "Chất lượng vận hành",
  PHAP_LY: "Pháp lý · QCVN 28:2010",
} as const;
