import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Alert,
  AlertHistory,
  AlertStatus,
  AppUserRecord,
  ChemImportConfirm,
  ChemQty,
  ChemReceipt,
  ChemRestockRequest,
  ChemRestockStatus,
  ChemDoseLog,
  ChemTx,
  Equipment,
  Incident,
  LogHistory,
  Maintenance,
  OpLog,
  Report,
  Role,
  Threshold,
  UserStatus,
} from "./types";
import {
  CHECKLIST_ITEMS,
  CONFIGS_DEFAULT,
  SEED_CHEMICALS,
  SEED_EQUIPMENTS,
  SEED_INCIDENTS,
  SEED_LOGS,
  SEED_MAINT,
  SEED_STOCKS,
  SEED_THRESHOLDS,
  SEED_TX,
  SEED_USERS,
} from "./seed";
import { FLOW_SHEET_META } from "./flow-data";
import { annotateFlow, generateFlowDays, scanFlowAlerts, softValidateLog } from "./flow";
import type { FlowDay } from "./types";
import type { SheetSyncInfo } from "./ops/types";
import { uid } from "./utils";

function buildOfficialState() {
  const flowDays = annotateFlow(generateFlowDays(), SEED_THRESHOLDS);
  const alerts = scanFlowAlerts(flowDays, SEED_THRESHOLDS, []);
  return {
    users: SEED_USERS,
    thresholds: SEED_THRESHOLDS,
    logs: SEED_LOGS,
    logHistories: [] as LogHistory[],
    chemicals: SEED_CHEMICALS,
    stocks: { ...SEED_STOCKS },
    transactions: SEED_TX,
    chemConfirms: [] as ChemImportConfirm[],
    chemDoses: [] as ChemDoseLog[],
    chemRestocks: [] as ChemRestockRequest[],
    equipments: SEED_EQUIPMENTS,
    incidents: SEED_INCIDENTS,
    maintenances: SEED_MAINT,
    reports: [] as Report[],
    alerts,
    alertHistories: [] as AlertHistory[],
    flowDays,
    configs: { ...CONFIGS_DEFAULT },
    checklist: CHECKLIST_ITEMS,
    lastSynced: new Date().toISOString(),
    sourceLabel: `${FLOW_SHEET_META.title} · ${FLOW_SHEET_META.rows} ngày (${FLOW_SHEET_META.from} → ${FLOW_SHEET_META.to})`,
    opsReady: false,
    staffBlocked: null as string | null,
    sheetSync: null as SheetSyncInfo | null,
  };
}

type State = {
  users: AppUserRecord[];
  thresholds: Threshold[];
  logs: OpLog[];
  logHistories: LogHistory[];
  chemicals: typeof SEED_CHEMICALS;
  stocks: Record<string, number>;
  transactions: ChemTx[];
  chemConfirms: ChemImportConfirm[];
  chemDoses: ChemDoseLog[];
  chemRestocks: ChemRestockRequest[];
  equipments: Equipment[];
  incidents: Incident[];
  maintenances: Maintenance[];
  reports: Report[];
  alerts: Alert[];
  alertHistories: AlertHistory[];
  flowDays: ReturnType<typeof generateFlowDays>;
  configs: Record<string, string>;
  checklist: typeof CHECKLIST_ITEMS;

  lastSynced: string;
  sourceLabel: string;
  opsReady: boolean;
  staffBlocked: string | null;
  sheetSync: SheetSyncInfo | null;

  applyFlowDays: (days: FlowDay[]) => void;
  ensureUser: (email: string, name: string) => AppUserRecord;
  saveUser: (user: AppUserRecord) => void;
  setUserRole: (id: string, role: Role) => void;
  setUserStatus: (id: string, status: UserStatus) => void;
  saveThreshold: (id: string, patch: Partial<Threshold>) => void;
  saveLog: (log: OpLog, actor: string, asDraft: boolean) => { ok: true; warnings: ReturnType<typeof softValidateLog> } | { ok: false; error: string };
  approveLog: (id: string, action: "DUYET" | "BO_SUNG" | "KHOA", note: string, actor: string) => { ok: boolean; error?: string };
  addChemTx: (tx: Omit<ChemTx, "Tx_ID" | "Ngay_tao">) => { ok: true } | { ok: false; error: string };
  confirmChemImport: (input: {
    thang: string;
    receipts: ChemReceipt[];
    actor: string;
    note: string;
    lock: boolean;
  }) => { ok: true } | { ok: false; error: string };
  saveChemDose: (log: Omit<ChemDoseLog, "at">) => { ok: true } | { ok: false; error: string };
  requestChemRestock: (input: {
    actor: string;
    reason: string;
    qty: ChemQty;
  }) => { ok: true } | { ok: false; error: string };
  updateChemRestock: (id: string, status: ChemRestockStatus) => void;
  setChemThreshold: (ma: string, value: number | null) => void;
  updateEquipment: (id: string, patch: Partial<Equipment>) => void;
  addIncident: (inc: Omit<Incident, "Incident_ID">) => void;
  addMaintenance: (m: Omit<Maintenance, "Maint_ID">) => void;
  updateAlert: (id: string, status: AlertStatus, note: string, actor: string) => { ok: boolean; error?: string };
  scanAlerts: () => number;
  compileReport: (from: string, to: string, actor: string) => Report;
  approveReport: (id: string, action: "DUYET" | "TU_CHOI", note: string, actor: string) => void;
  resetDemo: () => void;
  syncFromCsdl: () => void;
  hydrateOps: (patch: {
    chemConfirms?: ChemImportConfirm[];
    chemDoses?: ChemDoseLog[];
    chemRestocks?: ChemRestockRequest[];
    transactions?: ChemTx[];
    stocks?: Record<string, number>;
    users?: AppUserRecord[];
    sheetSync?: SheetSyncInfo | null;
  }) => void;
};

function initial(): Omit<
  State,
  | "applyFlowDays"
  | "ensureUser"
  | "saveUser"
  | "setUserRole"
  | "setUserStatus"
  | "saveThreshold"
  | "saveLog"
  | "approveLog"
  | "addChemTx"
  | "confirmChemImport"
  | "saveChemDose"
  | "requestChemRestock"
  | "updateChemRestock"
  | "setChemThreshold"
  | "updateEquipment"
  | "addIncident"
  | "addMaintenance"
  | "updateAlert"
  | "scanAlerts"
  | "compileReport"
  | "approveReport"
  | "resetDemo"
  | "syncFromCsdl"
  | "hydrateOps"
> {
  return buildOfficialState();
}

export const useAppStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),

      applyFlowDays: (days) => {
        if (!days.length) return;
        const flowDays = annotateFlow(days, get().thresholds);
        const extra = scanFlowAlerts(flowDays, get().thresholds, get().alerts);
        set({
          flowDays,
          alerts: extra.length ? [...extra, ...get().alerts] : get().alerts,
          lastSynced: new Date().toISOString(),
          sourceLabel: `Sheet lưu lượng công khai · ${flowDays.length} ngày (${flowDays[0].iso} → ${flowDays[flowDays.length - 1].iso})`,
        });
      },

      ensureUser: (email, name) => {
        const key = email.toLowerCase().trim();
        const found = get().users.find((u) => u.Email.toLowerCase() === key);
        if (found) return found;
        const rec: AppUserRecord = {
          User_ID: uid("USR"),
          Email: key,
          Ho_ten: name || key.split("@")[0],
          So_dien_thoai: "",
          Don_vi: "Bệnh viện Đại học Y Dược TP.HCM",
          Ghi_chu: "Chờ máy chủ xác nhận vai trò",
          Vai_tro: "CA_TRUC",
          Trang_thai: "HOAT_DONG",
          Ngay_tao: new Date().toISOString().slice(0, 10),
        };
        set({ users: [...get().users, rec] });
        return rec;
      },

      saveUser: (user) => {
        const users = get().users;
        const i = users.findIndex((u) => u.User_ID === user.User_ID);
        if (i >= 0) {
          const next = users.slice();
          next[i] = user;
          set({ users: next });
        } else {
          set({ users: [...users, { ...user, User_ID: user.User_ID || uid("USR") }] });
        }
      },

      setUserRole: (id, role) =>
        set({
          users: get().users.map((u) => (u.User_ID === id ? { ...u, Vai_tro: role } : u)),
        }),

      setUserStatus: (id, status) =>
        set({
          users: get().users.map((u) => (u.User_ID === id ? { ...u, Trang_thai: status } : u)),
        }),

      saveThreshold: (id, patch) => {
        const next = get().thresholds.map((t) => (t.Threshold_ID === id ? { ...t, ...patch } : t));
        set({
          thresholds: next,
          flowDays: annotateFlow(get().flowDays, next),
        });
      },

      saveLog: (log, actor, asDraft) => {
        const temp = log.Nhiet_do;
        if (Number.isNaN(temp) || temp < 10 || temp > 50) {
          return { ok: false as const, error: "Nhiệt độ phải từ 10 đến 50 °C." };
        }
        if (log.pH_dau_vao < 0 || log.pH_dau_vao > 14) return { ok: false as const, error: "pH đầu vào không hợp lệ." };
        if (log.pH_dau_ra < 0 || log.pH_dau_ra > 14) return { ok: false as const, error: "pH đầu ra không hợp lệ." };
        if (log.DO < 0 || log.DO > 20) return { ok: false as const, error: "DO phải từ 0 đến 20 mg/L." };
        if (log.SV30 < 0 || log.SV30 > 1000) return { ok: false as const, error: "SV30 phải từ 0 đến 1000 mL/L." };
        if (log.Luu_luong_nt < 0) return { ok: false as const, error: "Lưu lượng không được âm." };

        const now = new Date().toISOString();
        const existing = get().logs.find((l) => l.Log_ID === log.Log_ID);
        const status = asDraft ? "NHAP" : "CHO_DUYET";
        const saved: OpLog = {
          ...log,
          Log_ID: log.Log_ID || uid("LOG"),
          Trang_thai: existing && existing.Trang_thai !== "NHAP" && existing.Trang_thai !== "YEU_CAU_BO_SUNG" ? existing.Trang_thai : status,
          Nguoi_tao: existing?.Nguoi_tao || actor,
          Nguoi_sua: actor,
          Ngay_tao: existing?.Ngay_tao || now,
          Ngay_sua: now,
        };

        const logs = existing
          ? get().logs.map((l) => (l.Log_ID === saved.Log_ID ? saved : l))
          : [saved, ...get().logs];

        const hist: LogHistory = {
          History_ID: uid("HST"),
          Log_ID: saved.Log_ID,
          Thoi_gian: now,
          Nguoi_thuc_hien: actor,
          Hanh_dong: asDraft ? "LUU_NHAP" : "GUI_DUYET",
          Ghi_chu: "",
        };

        set({ logs, logHistories: [hist, ...get().logHistories] });
        return { ok: true as const, warnings: softValidateLog(get().thresholds, saved) };
      },

      approveLog: (id, action, note, actor) => {
        const log = get().logs.find((l) => l.Log_ID === id);
        if (!log) return { ok: false, error: "Không tìm thấy nhật ký." };
        const map = { DUYET: "DA_DUYET", BO_SUNG: "YEU_CAU_BO_SUNG", KHOA: "KHOA" } as const;
        const next = map[action];
        const now = new Date().toISOString();
        set({
          logs: get().logs.map((l) =>
            l.Log_ID === id ? { ...l, Trang_thai: next, Nguoi_sua: actor, Ngay_sua: now } : l,
          ),
          logHistories: [
            {
              History_ID: uid("HST"),
              Log_ID: id,
              Thoi_gian: now,
              Nguoi_thuc_hien: actor,
              Hanh_dong: action,
              Ghi_chu: note,
            },
            ...get().logHistories,
          ],
        });
        return { ok: true };
      },

      addChemTx: (tx) => {
        const stock = get().stocks[tx.Ma_hoa_chat] ?? 0;
        if (tx.Loai_giao_dich === "XUAT" && tx.So_luong > stock) {
          return { ok: false as const, error: `Chặn tồn kho âm. Tồn hiện tại ${stock} ${get().chemicals.find((c) => c.Ma_hoa_chat === tx.Ma_hoa_chat)?.Don_vi_tinh ?? ""}.` };
        }
        if (tx.So_luong <= 0) return { ok: false as const, error: "Số lượng phải lớn hơn 0." };
        const next = tx.Loai_giao_dich === "NHAP" ? stock + tx.So_luong : stock - tx.So_luong;
        const rec: ChemTx = { ...tx, Tx_ID: uid("TX"), Ngay_tao: new Date().toISOString() };
        set({
          stocks: { ...get().stocks, [tx.Ma_hoa_chat]: next },
          transactions: [rec, ...get().transactions],
        });
        return { ok: true as const };
      },

      confirmChemImport: ({ thang, receipts, actor, note, lock }) => {
        if (!thang) return { ok: false as const, error: "Thiếu kỳ nhập." };
        if (!receipts.length) return { ok: false as const, error: "Cần ít nhất một ngày nhập." };
        if (receipts.length > 3) return { ok: false as const, error: "Tối đa 3 ngày nhập trong một kỳ." };
        for (const r of receipts) {
          if (!r.ngay) return { ok: false as const, error: "Thiếu ngày nhập." };
          if (Object.values(r.qty).some((n) => n < 0 || Number.isNaN(n))) {
            return { ok: false as const, error: "Số lượng không được âm." };
          }
        }
        const qty = receipts.reduce(
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
          thang,
          receipts,
          qty,
          locked: lock,
          actor,
          at: new Date().toISOString(),
          note,
        };
        const rest = (get().chemConfirms ?? []).filter((c) => c.thang !== thang);
        set({ chemConfirms: [...rest, rec] });
        return { ok: true as const };
      },

      saveChemDose: (log) => {
        if (!log.iso) return { ok: false as const, error: "Thiếu ngày châm." };
        if (Object.values(log.qty).some((n) => n < 0 || Number.isNaN(n))) {
          return { ok: false as const, error: "Liều không được âm." };
        }
        const rec: ChemDoseLog = { ...log, at: new Date().toISOString() };
        const rest = (get().chemDoses ?? []).filter((d) => d.iso !== log.iso);
        set({ chemDoses: [...rest, rec].sort((a, b) => b.iso.localeCompare(a.iso)) });
        return { ok: true as const };
      },

      requestChemRestock: ({ actor, reason, qty }) => {
        if (Object.values(qty).every((n) => n <= 0)) {
          return { ok: false as const, error: "Chưa có khối lượng cần điều động." };
        }
        const rec: ChemRestockRequest = {
          id: uid("RST"),
          at: new Date().toISOString(),
          actor,
          reason,
          qty,
          status: "MOI",
        };
        set({ chemRestocks: [rec, ...(get().chemRestocks ?? [])] });
        return { ok: true as const };
      },

      updateChemRestock: (id, status) =>
        set({
          chemRestocks: (get().chemRestocks ?? []).map((r) => (r.id === id ? { ...r, status } : r)),
        }),

      setChemThreshold: (ma, value) =>
        set({
          chemicals: get().chemicals.map((c) =>
            c.Ma_hoa_chat === ma ? { ...c, Nguong_canh_bao_ton: value } : c,
          ),
        }),

      updateEquipment: (id, patch) =>
        set({
          equipments: get().equipments.map((e) => (e.Equipment_ID === id ? { ...e, ...patch } : e)),
        }),

      addIncident: (inc) =>
        set({ incidents: [{ ...inc, Incident_ID: uid("INC") }, ...get().incidents] }),

      addMaintenance: (m) =>
        set({ maintenances: [{ ...m, Maint_ID: uid("MNT") }, ...get().maintenances] }),

      updateAlert: (id, status, note, actor) => {
        if (status === "BO_QUA_CO_LY_DO" && !note.trim()) {
          return { ok: false, error: "Cần ghi rõ lý do khi bỏ qua cảnh báo." };
        }
        const prev = get().alerts.find((a) => a.Alert_ID === id);
        if (!prev) return { ok: false, error: "Không tìm thấy cảnh báo." };
        const now = new Date().toISOString();
        set({
          alerts: get().alerts.map((a) =>
            a.Alert_ID === id
              ? { ...a, Trang_thai: status, Ghi_chu_xu_ly: note, Nguoi_xu_ly: actor, Ngay_cap_nhat: now }
              : a,
          ),
          alertHistories: [
            {
              History_ID: uid("HST"),
              Alert_ID: id,
              Thoi_gian: now,
              Nguoi_thuc_hien: actor,
              Trang_thai_cu: prev.Trang_thai,
              Trang_thai_moi: status,
              Ghi_chu: note,
            },
            ...get().alertHistories,
          ],
        });
        return { ok: true };
      },

      scanAlerts: () => {
        const created = scanFlowAlerts(get().flowDays, get().thresholds, get().alerts);
        if (created.length) set({ alerts: [...created, ...get().alerts] });
        return created.length;
      },

      compileReport: (from, to, actor) => {
        const logs = get().logs.filter((l) => l.Ngay >= from && l.Ngay <= to);
        const nums = (pick: (l: OpLog) => number | null) =>
          logs.map(pick).filter((n): n is number => n != null && !Number.isNaN(n));
        const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
        const report: Report = {
          Report_ID: uid("RPT"),
          Loai_bao_cao: "THANG",
          Ten_bao_cao: `Báo cáo vận hành ${from} → ${to}`,
          Tu_ngay: from,
          Den_ngay: to,
          Trang_thai: "CHO_DUYET",
          Noi_dung: {
            so_nhat_ky: logs.length,
            so_da_duyet: logs.filter((l) => l.Trang_thai === "DA_DUYET").length,
            tb_luu_luong: avg(nums((l) => l.Luu_luong_nt)),
            tb_ph_out: avg(nums((l) => l.pH_dau_ra)),
            tb_sv30: avg(nums((l) => l.SV30)),
            tb_amoni: avg(nums((l) => l.Amoni)),
            tb_cod: avg(nums((l) => l.COD)),
            so_su_co: get().incidents.filter((i) => i.Ngay_phat_sinh >= from && i.Ngay_phat_sinh <= to).length,
            so_giao_dich_hc: get().transactions.filter((t) => t.Ngay_thuc_hien >= from && t.Ngay_thuc_hien <= to).length,
            so_canh_bao: get().alerts.filter((a) => a.Ngay >= from && a.Ngay <= to).length,
          },
          Nguoi_tao: actor,
          Ngay_tao: new Date().toISOString(),
          Nguoi_duyet: "",
          Ngay_duyet: "",
          Ghi_chu_duyet: "",
        };
        set({ reports: [report, ...get().reports] });
        return report;
      },

      approveReport: (id, action, note, actor) =>
        set({
          reports: get().reports.map((r) =>
            r.Report_ID === id
              ? {
                  ...r,
                  Trang_thai: action === "DUYET" ? "DA_DUYET" : "NHAP",
                  Nguoi_duyet: actor,
                  Ngay_duyet: new Date().toISOString(),
                  Ghi_chu_duyet: note,
                }
              : r,
          ),
        }),

      resetDemo: () => set({ ...initial(), opsReady: true, staffBlocked: null, sheetSync: null }),
      syncFromCsdl: () => set({ ...buildOfficialState(), opsReady: true }),
      hydrateOps: (patch) =>
        set({
          ...(patch.chemConfirms !== undefined ? { chemConfirms: patch.chemConfirms } : {}),
          ...(patch.chemDoses !== undefined ? { chemDoses: patch.chemDoses } : {}),
          ...(patch.chemRestocks !== undefined ? { chemRestocks: patch.chemRestocks } : {}),
          ...(patch.transactions !== undefined ? { transactions: patch.transactions } : {}),
          ...(patch.stocks !== undefined ? { stocks: patch.stocks } : {}),
          ...(patch.users !== undefined ? { users: patch.users } : {}),
          sheetSync: patch.sheetSync !== undefined ? patch.sheetSync : get().sheetSync,
          opsReady: true,
          staffBlocked: null,
        }),
    }),
    {
      name: "umc-xlnt-flow-v4",
      skipHydration: true,
      partialize: (s) => {
        const { opsReady: _o, staffBlocked: _b, sheetSync: _sh, hydrateOps: _h, ...rest } = s;
        return rest;
      },
    },
  ),
);
