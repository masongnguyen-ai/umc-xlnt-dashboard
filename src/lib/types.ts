export type Role = "QUAN_LY" | "NHA_THAU" | "CA_TRUC";
export type UserStatus = "HOAT_DONG" | "TAM_KHOA" | "NGUNG";
export type Shift = "SANG" | "CHIEU";
export type ApprovalStatus = "NHAP" | "CHO_DUYET" | "DA_CHOT" | "TRA_LAI";
/** DA_DUYET / YEU_CAU_BO_SUNG / KHOA: phiếu cũ — đọc như DA_CHOT / TRA_LAI. */
export type LogStatus = ApprovalStatus | "DA_DUYET" | "YEU_CAU_BO_SUNG" | "KHOA";
export type AlertStatus = "MOI" | "DA_XEM" | "DANG_XU_LY" | "DA_XU_LY" | "BO_QUA_CO_LY_DO";
export type ThresholdGroup = "LUU_LUONG" | "CHAT_LUONG" | "PHAP_LY";
export type ChemKind = "NHAP" | "XUAT";
export type EqStatus = "HOAT_DONG" | "BAO_TRI" | "HONG" | "NGUNG";
export type AbnormalResult = "DA_KHAC_PHUC" | "DANG_THEO_DOI" | "CHUA_XU_LY";
export type HandoverStatus = "BINH_THUONG" | "CAN_THEO_DOI" | "CO_VAN_DE";

export type LogPhoto = {
  id: string;
  name: string;
  dataUrl: string;
};

export type LogAbnormal = {
  id: string;
  gio_phat_hien: string;
  hien_tuong: string;
  nguyen_nhan: string;
  da_xu_ly: string;
  nguoi_xu_ly: string;
  ket_qua: AbnormalResult;
  anh: LogPhoto[];
};

export type AppUserRecord = {
  User_ID: string;
  Email: string;
  Ho_ten: string;
  So_dien_thoai: string;
  Don_vi: string;
  Ghi_chu: string;
  Vai_tro: Role;
  Trang_thai: UserStatus;
  Ngay_tao: string;
};

export type Threshold = {
  Threshold_ID: string;
  Ma_nguong: string;
  Ten_nguong: string;
  Nhom: ThresholdGroup;
  He_thong: string;
  Toan_tu: string;
  Gia_tri_1: number;
  Gia_tri_2: number | null;
  Muc_do: string;
  Kich_hoat: boolean;
  Ghi_chu: string;
};

export type OpLog = {
  Log_ID: string;
  Ngay: string;
  Ca: Shift;
  He_thong: "He_600" | "He_220";
  Nhiet_do: number;
  pH_dau_vao: number;
  pH_dau_ra: number;
  DO: number;
  SV30: number;
  Luu_luong_nt: number;
  Amoni: number | null;
  COD: number | null;
  Tinh_trang_he_thong: string;
  Su_co_phat_sinh: string;
  Bien_phap_khac_phuc: string;
  Co_bat_thuong: boolean;
  Bat_thuong: LogAbnormal[];
  Ban_giao_tinh_trang: HandoverStatus;
  Ban_giao_theo_doi: string;
  Trang_thai: LogStatus;
  Nguoi_tao: string;
  Nguoi_sua: string;
  Ngay_tao: string;
  Ngay_sua: string;
  Checklist_Ket_qua: string;
  Nguoi_xacnhan_BV: string;
  Chucvu_xacnhan_BV: string;
  Da_xacnhan_BV: boolean;
  approvedBy?: string;
  approvedAt?: string;
  reviewNote?: string;
};

export type LogHistory = {
  History_ID: string;
  Log_ID: string;
  Thoi_gian: string;
  Nguoi_thuc_hien: string;
  Hanh_dong: string;
  Ghi_chu: string;
};

export type Chemical = {
  Ma_hoa_chat: string;
  Ten_hoa_chat: string;
  Don_vi_tinh: string;
  Nguong_canh_bao_ton: number | null;
  Dinh_muc_thang_van_hanh: number | null;
  Dinh_muc_he600: number | null;
  Dinh_muc_he220: number | null;
  Khoi_luong_hopdong_18thang: number | null;
  Ghi_chu: string;
};

export type ChemTx = {
  Tx_ID: string;
  Ma_hoa_chat: string;
  Loai_giao_dich: ChemKind;
  So_luong: number;
  Lo_san_xuat: string;
  Han_su_dung: string;
  Ngay_thuc_hien: string;
  Ghi_chu: string;
  Nguoi_tao: string;
  Ngay_tao: string;
};

export type ChemQty = {
  micro: number;
  matri: number;
  naoh: number;
  nahco3: number;
  javen: number;
};

export type ChemReceipt = {
  id: string;
  ngay: string;
  qty: ChemQty;
};

export type ChemImportConfirm = {
  thang: string;
  receipts: ChemReceipt[];
  qty: ChemQty;
  locked: boolean;
  actor: string;
  at: string;
  note: string;
  status?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  reviewNote?: string;
};

export type ChemRestockStatus = "MOI" | "DANG_DAT" | "DA_GIAO" | "HUY";

export type ChemDoseLog = {
  iso: string;
  qty: ChemQty;
  actor: string;
  at: string;
  note: string;
  status?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  reviewNote?: string;
};

export type ChemRestockRequest = {
  id: string;
  at: string;
  actor: string;
  reason: string;
  qty: ChemQty;
  status: ChemRestockStatus;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  reviewNote?: string;
};

export type Equipment = {
  Equipment_ID: string;
  Ten_thiet_bi: string;
  He_thong: "He_600" | "He_220";
  Hang_SX: string;
  Model: string;
  So_luong: number;
  Thong_so: string;
  Tinh_trang: EqStatus;
  Ghi_chu: string;
};

export type EvidencePhoto = {
  id: string;
  name: string;
  url: string;
  driveId?: string;
  bytes: number;
  local?: boolean;
};

export type Incident = {
  Incident_ID: string;
  Equipment_ID: string;
  Ngay_phat_sinh: string;
  Mo_ta_su_co: string;
  Bien_phap_xu_ly: string;
  Trang_thai: string;
  Nguoi_khac_phuc: string;
  Ngay_hoan_thanh: string;
  Anh?: EvidencePhoto[];
  Loai?: "THIET_BI" | "BAT_THUONG";
  Doi_tuong?: string;
  He_lien_quan?: "He_600" | "He_220" | "CHUNG";
  status?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  reviewNote?: string;
};

export type Maintenance = {
  Maint_ID: string;
  Equipment_ID: string;
  Ngay_bao_tri: string;
  Ket_qua: string;
  Noi_dung_bao_tri: string;
  Vat_tu_thay_the: string;
  Ghi_chu: string;
};

export type Alert = {
  Alert_ID: string;
  Ngay: string;
  Loai_canh_bao: string;
  Muc_do: string;
  Noi_dung: string;
  Gia_tri: number;
  Nguong: string;
  Chi_so: string;
  Trang_thai: AlertStatus;
  Nguoi_xu_ly: string;
  Ngay_cap_nhat: string;
  Ghi_chu_xu_ly: string;
};

export type AlertHistory = {
  History_ID: string;
  Alert_ID: string;
  Thoi_gian: string;
  Nguoi_thuc_hien: string;
  Trang_thai_cu: AlertStatus;
  Trang_thai_moi: AlertStatus;
  Ghi_chu: string;
};

export type Report = {
  Report_ID: string;
  Loai_bao_cao: string;
  Ten_bao_cao: string;
  Tu_ngay: string;
  Den_ngay: string;
  Trang_thai: string;
  Noi_dung: {
    so_nhat_ky: number;
    so_da_duyet: number;
    tb_luu_luong: number | null;
    tb_ph_out: number | null;
    tb_sv30: number | null;
    tb_amoni: number | null;
    tb_cod: number | null;
    so_su_co: number;
    so_giao_dich_hc: number;
    so_canh_bao: number;
    so_bat_thuong: number;
    so_chua_xu_ly: number;
  };
  Nguoi_tao: string;
  Ngay_tao: string;
  Nguoi_duyet: string;
  Ngay_duyet: string;
  Ghi_chu_duyet: string;
};

export type FlowDay = {
  iso: string;
  ngay: string;
  thu: string;
  llnt: number;
  ntday: number;
  lldem: number;
  ll600: number;
  he600day: number;
  ll220: number;
  he220day: number;
  llcap: number;
  capday: number;
  capdem: number;
  llcapA: number;
  llcapB: number;
  llvaoB: number;
  thatthoatB: number;
  chenh: number;
  cb: string;
  nt730: number | null;
  nt1730: number | null;
  m600: number | null;
  m220: number | null;
};

export type SoftWarning = { code: string; message: string };

export type ChecklistItem = {
  Item_ID: string;
  Noi_dung: string;
  Thu_tu: number;
  Kich_hoat: boolean;
};

export type AuditEvent = {
  id: string;
  at: string;
  actorEmail: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
};

export type OpsBackup = {
  id: string;
  at: string;
  actorEmail: string;
  kind: string;
};

export type SheetSyncInfo = {
  ok: boolean;
  mode: "webhook" | "local";
  tabs: string[];
  error?: string;
};

export type ChemOpsState = {
  confirms: ChemImportConfirm[];
  doses: ChemDoseLog[];
  restocks: ChemRestockRequest[];
  transactions: ChemTx[];
  stocks: Record<string, number>;
};

export type OpsSnapshot = ChemOpsState & {
  users: AppUserRecord[];
  sheet: SheetSyncInfo;
  audits: AuditEvent[];
  backups: OpsBackup[];
};
