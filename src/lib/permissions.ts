import type { Role } from "./types";

export type Action =
  | "theodoi"
  | "canhbao"
  | "nhatky"
  | "ai"
  | "hoachat"
  | "thietbi"
  | "baocao"
  | "nguong"
  | "quantri"
  | "view_nhatky"
  | "write_nhatky"
  | "write_hoachat"
  | "write_chem_dose"
  | "write_thietbi"
  | "view_baocao"
  | "write_nguong"
  | "write_quantri"
  | "update_alert"
  | "approve_nhatky"
  | "approve_hoachat"
  | "approve_thietbi"
  | "approve_baocao"
  | "view_audit"
  | "write_backup";

const MATRIX: Record<Role, Action[]> = {
  CA_TRUC: ["theodoi", "canhbao", "nhatky", "ai", "hoachat", "view_nhatky", "write_nhatky", "write_chem_dose", "view_audit"],
  NHA_THAU: [
    "theodoi",
    "canhbao",
    "nhatky",
    "hoachat",
    "thietbi",
    "baocao",
    "ai",
    "view_nhatky",
    "write_nhatky",
    "write_hoachat",
    "write_chem_dose",
    "write_thietbi",
    "view_baocao",
    "update_alert",
    "view_audit",
  ],
  QUAN_LY: [
    "theodoi",
    "canhbao",
    "nguong",
    "ai",
    "thietbi",
    "hoachat",
    "nhatky",
    "baocao",
    "quantri",
    "view_nhatky",
    "write_nhatky",
    "write_hoachat",
    "write_chem_dose",
    "write_thietbi",
    "view_baocao",
    "write_nguong",
    "write_quantri",
    "update_alert",
    "approve_nhatky",
    "approve_hoachat",
    "approve_thietbi",
    "approve_baocao",
    "view_audit",
    "write_backup",
  ],
};

export function can(role: Role | undefined, action: Action) {
  if (!role) return false;
  return MATRIX[role].includes(action);
}

export type NavItem = {
  to: string;
  action: Action;
  label: string;
  hint: string;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/app/theodoi", action: "theodoi", label: "Theo dõi", hint: "Lưu lượng 3 đồng hồ" },
  { to: "/app/canhbao", action: "canhbao", label: "Cảnh báo", hint: "Quét ngưỡng động" },
  { to: "/app/nhatky", action: "nhatky", label: "Nhật ký", hint: "Ca trực · checklist" },
  { to: "/app/nguong", action: "nguong", label: "Ngưỡng", hint: "26 ngưỡng · 3 nhóm" },
  { to: "/app/hoachat", action: "hoachat", label: "Hóa chất", hint: "Tra cứu · tồn kho" },
  { to: "/app/thietbi", action: "thietbi", label: "Thiết bị", hint: "34 hạng mục" },
  { to: "/app/baocao", action: "baocao", label: "Báo cáo", hint: "Tổng hợp ca" },
  { to: "/app/ai", action: "ai", label: "Trợ lý", hint: "Kế hoạch" },
  { to: "/app/quantri", action: "quantri", label: "Quản trị", hint: "Tài khoản · cấu hình" },
  { to: "/app/nhatky-so", action: "view_audit", label: "Nhật ký số", hint: "Ai sửa tồn · liều · chốt" },
  { to: "/app/trienkhai", action: "quantri", label: "Triển khai", hint: "Sheet hóa chất · PWA · máy trực" },
];
