import type {
  AppUserRecord,
  ChemDoseLog,
  ChemImportConfirm,
  ChemQty,
  ChemRestockRequest,
  ChemTx,
  Role,
} from "@/lib/types";

export type SheetSyncInfo = {
  ok: boolean;
  mode: "webhook" | "local" | "sheets";
  tabs: string[];
  error?: string;
};

/** before/after are JSON strings so server functions stay serializable. */
export type AuditEvent = {
  id: string;
  at: string;
  actorEmail: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  before: string;
  after: string;
};

export type OpsBackup = {
  id: string;
  at: string;
  actorEmail: string;
  kind: string;
};

export type StaffMe =
  | { ok: true; staff: AppUserRecord; sheet: SheetSyncInfo }
  | { ok: false; blocked: string };

export type ChemSnapshot = {
  confirms: ChemImportConfirm[];
  doses: ChemDoseLog[];
  restocks: ChemRestockRequest[];
  transactions: ChemTx[];
  stocks: Record<string, number>;
  liveStock: ChemQty;
};

export type OpsState = ChemSnapshot & {
  users: AppUserRecord[];
  sheet: SheetSyncInfo;
  audits: AuditEvent[];
  backups: OpsBackup[];
};

export type SheetAuditRow = {
  module: string;
  tab: string;
  wrote: boolean;
  pending: number;
  chot: number;
  error?: string;
};

export const OPS_SHEET_TABS = [
  "NHAT_KY",
  "HOA_CHAT_LIEU",
  "HOA_CHAT_NHAP",
  "HOA_CHAT_DIEU_DONG",
  "SU_CO_TB",
  "BAO_TRI_TB",
  "LOGIN_LOG",
] as const;

export const CHEM_SHEET_TABS = ["CHEM_NHAP", "CHEM_LIEU", "CHEM_TON", "AUDIT_SO"] as const;

export const QTY_TO_MA = {
  micro: "VISINH",
  matri: "MATRI",
  naoh: "NAOH",
  nahco3: "NAHCO3",
  javen: "JAVEN",
} as const;
