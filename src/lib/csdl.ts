export const CSDL = {
  name: "UMC - Cơ sở dữ liệu vận hành Trạm XLNT",
  version: "v7",
  dated: "2026-07-16",
  tabs: 15,
  equipments: 34,
  thresholds: 26,
  chemicals: 5,
  incidents: 8,
  maintenances: 2,
  checklist: 19,
  contractor: "Công ty Đại Nam",
  capacity: 820,
  qcvn: "QCVN 28:2010 cột B, K=1",
  note: "Danh mục thiết bị / ngưỡng / hóa chất theo DuLieu-HeThong v7. Lưu lượng ngày lấy trực tiếp từ sheet công khai 27/01–13/08/2026.",
} as const;

export const PLANT_HYDRAULICS = {
  eq600: 153,
  eq220: 134,
  retentionHours: 8.4,
  transferOn: "~45 m³ (1/3 bể 220)",
  transferOff: "~100 m³ (3/4 bể 220)",
} as const;

export const DESIGN_SPECS = [
  { chi: "Nhu cầu oxy", he600: "96 m³/giờ", he220: "50 m³/giờ" },
  { chi: "Bùn tuần hoàn", he600: "60%", he220: "60%" },
  { chi: "Tuần hoàn Nitrat", he600: "100%", he220: "100%" },
  { chi: "Vận tốc lắng", he600: "0,7 m/giờ", he220: "0,6 m/giờ" },
  { chi: "Vận tốc lọc", he600: "12 m/giờ", he220: "6 m/giờ" },
] as const;

export const GPMT_FLOW = {
  y2022: { avg: 733, max: 811 },
  y2023: { avg: 732.9, max: 818 },
} as const;

export const PERF_2023 = [
  { chi: "BOD5", vao: 151, ra: 15, hs: 88.8 },
  { chi: "COD", vao: 322, ra: 37.5, hs: 87.4 },
  { chi: "TSS", vao: 140.75, ra: 28.25, hs: 81.6 },
  { chi: "Amoni", vao: 58.7, ra: 2.97, hs: 95.6 },
  { chi: "Coliform", vao: 378525, ra: 680.75, hs: 86.1 },
] as const;

export const MAINT_SCHEDULE = [
  { nhom: "Bể điều hòa", hang: "Vệ sinh đo lưu lượng, cân chỉnh, đo pH, vệ sinh bể", tan: "Tuần" },
  { nhom: "Bể sinh học", hang: "Kiểm tra nồng độ bùn, SV30, màu/tốc độ lắng", tan: "Tuần" },
  { nhom: "Bể sinh học", hang: "Kiểm tra đĩa phân phối khí", tan: "Tháng" },
  { nhom: "Bể lắng", hang: "Lắng, bùn nổi, bùn tuần hoàn, khí nâng", tan: "Tuần" },
  { nhom: "Bể lắng", hang: "Vệ sinh tấm lắng lamen", tan: "Tháng" },
  { nhom: "Bể lắng", hang: "Bể lắng ly tâm / cánh gạt", tan: "Năm" },
  { nhom: "Bể khử trùng", hang: "Pha hóa chất, kiểm tra độ đục", tan: "Tuần" },
  { nhom: "Bồn lọc", hang: "Chế độ vận hành, rửa lọc", tan: "Tuần" },
  { nhom: "Tủ điều khiển", hang: "Điện áp, Ampe, cách điện, mối nối", tan: "Tháng" },
  { nhom: "Bơm chìm", hang: "Điện, phao, rác, dòng/cách điện", tan: "Tháng" },
  { nhom: "Bơm chìm", hang: "Ổ bi, nhớt", tan: "Quý" },
  { nhom: "Máy thổi khí", hang: "Tín hiệu, áp suất, curoa, độ rung", tan: "Tháng" },
  { nhom: "Máy thổi khí", hang: "Vệ sinh, mỡ bò, bạc đạn, lọc gió", tan: "Quý" },
  { nhom: "Máy khuấy", hang: "Điện, rác, độ rung", tan: "Tháng" },
  { nhom: "Máy khuấy", hang: "Ổ bi, nhớt", tan: "Quý" },
  { nhom: "Bơm định lượng", hang: "Tắc nghẽn / van / đầu hút", tan: "Tuần" },
  { nhom: "Bơm định lượng", hang: "Vệ sinh đầu hút", tan: "Tháng" },
  { nhom: "Đường ống", hang: "Tắc, bể, ăn mòn, van", tan: "Tuần" },
  { nhom: "Phân phối khí", hang: "Đường ống, đĩa — thay khi hỏng", tan: "Quý" },
] as const;

export const CSDL_TABS = [
  { id: "USERS", rows: "3 tài khoản", note: "1 quản trị gốc + 2 vận hành để phân quyền" },
  { id: "CONFIGS", rows: "6 khóa", note: "Tên hệ thống, nhà thầu, công suất 820" },
  { id: "THRESHOLDS", rows: "26 quy tắc", note: "6 lưu lượng + 10 chất lượng + 10 QCVN" },
  { id: "OP_LOGS", rows: "0", note: "Không seed — ghi ca thật trên web" },
  { id: "LOG_CHECKLIST_ITEMS", rows: "19 mục", note: "Báo cáo T04/2026 mục 3.1" },
  { id: "CHEMICALS", rows: "5 hóa chất", note: "GPMT Bảng 7 + hợp đồng 18 tháng" },
  { id: "CHEM_STOCKS", rows: "0", note: "Không seed tồn ảo — phát sinh từ chốt nhập / liều" },
  { id: "CHEM_NHAP", rows: "chốt nhập", note: "Tab riêng — xe về từng ngày, khóa kỳ" },
  { id: "CHEM_LIEU", rows: "liều ngày", note: "Tab riêng — số đã châm, trừ tồn" },
  { id: "CHEM_TON", rows: "tồn live", note: "Tab riêng — snapshot máy chủ, không đụng lưu lượng" },
  { id: "AUDIT_SO", rows: "nhật ký", note: "Ai sửa số · trước/sau" },
  { id: "CHEM_TRANSACTIONS", rows: "0", note: "Không seed giao dịch mẫu" },
  { id: "EQUIPMENTS", rows: "34 hạng mục", note: "16 hệ 600 + 18 hệ 220 (gồm TB-220-18)" },
  { id: "EQP_INCIDENTS", rows: "8 sự cố", note: "Lịch sử thật 11/2025–01/2026" },
  { id: "EQP_MAINTENANCES", rows: "2 phiếu", note: "Thay phốt AB-03 / AB-05 T04/2026" },
  { id: "ALERTS", rows: "quét động", note: "Từ lưu lượng mô phỏng GPMT 2022–2023" },
  { id: "REPORTS", rows: "0", note: "Lập trên module Báo cáo" },
  { id: "DASHBOARD_DATA", rows: "199 ngày thật", note: "Sheet công khai 27/01/2026–13/08/2026 — không mô phỏng" },
  { id: "ACCESS_LOGS", rows: "trên phiên", note: "Ghi khi thao tác" },
] as const;
