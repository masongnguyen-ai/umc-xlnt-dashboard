import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type {
  AppUserRecord,
  ChemQty,
  ChemReceipt,
  ChemRestockStatus,
  ChemTx,
  EvidencePhoto,
  Incident,
  Maintenance,
  OpLog,
} from "@/lib/types";
import type { SheetAuditRow, SheetSyncInfo } from "./types";
import {
  getOpsLedgerFn,
  getOpsStateFn,
  getStaffMeFn,
  logAuthEventFn,
  patchChemRestockFn,
  reviewOpsDoseFn,
  reviewOpsImportFn,
  reviewOpsIncidentFn,
  reviewOpsRestockFn,
  reviewShiftLogFn,
  saveChemTxFn,
  saveIncidentFn,
  saveOpsDoseFn,
  saveOpsImportFn,
  saveOpsMaintFn,
  saveOpsRestockFn,
  saveShiftLogFn,
  saveStaffFn,
} from "./fns";

function sheetToast(sheet?: SheetSyncInfo) {
  if (!sheet) return;
  if (sheet.ok) toast.success(`Đã ghi tab ${sheet.tabs.join(" · ")}.`);
  else toast.error(sheet.error || "Không ghi được Sheet vận hành.", { id: "ops-sheet" });
}

const NET_RE =
  /failed to fetch|networkerror|load failed|network request failed|the internet connection appears to be offline|aborted|err_network|err_connection|timeout/i;

export function isNetworkFailure(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return NET_RE.test(msg);
}

function errMsg(err: unknown, fallback: string) {
  if (isNetworkFailure(err)) {
    return "Không kết nối được máy chủ. Thử lại sau vài giây.";
  }
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

export function errMessage(err: unknown, fallback = "Lỗi máy chủ") {
  return errMsg(err, fallback);
}

function failedTabs(audit: SheetAuditRow[]) {
  return new Set(audit.filter((a) => a.error).map((a) => a.tab));
}

const LEDGER_CLIENT_MS = 15_000;
let ledgerInflight: Promise<Awaited<ReturnType<typeof getOpsLedgerFn>> | null> | null = null;
let ledgerOkAt = 0;
let ledgerFailAt = 0;

export async function reloadOpsLedger(force = false) {
  if (ledgerInflight) return ledgerInflight;
  const now = Date.now();
  if (!force && ledgerOkAt && now - ledgerOkAt < LEDGER_CLIENT_MS) return null;
  if (!force && ledgerFailAt && now - ledgerFailAt < 8_000) return null;

  ledgerInflight = (async () => {
    try {
      const ledger = await getOpsLedgerFn();
      const failed = failedTabs(ledger.audit);
      useAppStore.getState().hydrateOps({
        logs: failed.has("NHAT_KY") ? undefined : ledger.logs,
        chemConfirms: failed.has("HOA_CHAT_NHAP") ? undefined : ledger.confirms,
        chemDoses: failed.has("HOA_CHAT_LIEU") ? undefined : ledger.doses,
        chemRestocks: failed.has("HOA_CHAT_DIEU_DONG") ? undefined : ledger.restocks,
        incidents: failed.has("SU_CO_TB") ? undefined : ledger.incidents,
        maintenances: failed.has("BAO_TRI_TB") ? undefined : ledger.maintenances,
        sheetAudit: ledger.audit,
        sheetSync: ledger.sheet,
      });
      ledgerOkAt = Date.now();
      ledgerFailAt = 0;
      if (!ledger.sheet.ok) toast.error(ledger.sheet.error || "Không đọc được Sheet vận hành.", { id: "ops-sheet" });
      return ledger;
    } catch (err) {
      ledgerFailAt = Date.now();
      const error = errMsg(err, "Không đọc được Sheet vận hành.");
      useAppStore.setState({
        sheetSync: { ok: false, mode: "sheets", tabs: [], error },
      });
      toast.error(error, { id: "ops-sheet" });
      return null;
    }
  })().finally(() => {
    ledgerInflight = null;
  });

  return ledgerInflight;
}

let hydrateInflight: Promise<Awaited<ReturnType<typeof getStaffMeFn>> | undefined> | null = null;

export async function hydrateOpsFromServer() {
  if (hydrateInflight) return hydrateInflight;
  hydrateInflight = runHydrate().finally(() => {
    hydrateInflight = null;
  });
  return hydrateInflight;
}

async function runHydrate() {
  let r: Awaited<ReturnType<typeof getStaffMeFn>>;
  try {
    r = await getStaffMeFn();
  } catch (err) {
    const error = errMsg(err, "Không kết nối được máy chủ.");
    useAppStore.setState({
      opsReady: true,
      staffBlocked: isNetworkFailure(err) ? null : err instanceof Error && err.message !== "Unauthorized" ? err.message : null,
    });
    toast.error(error, { id: "ops-hydrate" });
    return undefined;
  }
  if (!r.ok) {
    useAppStore.setState({ staffBlocked: r.blocked, opsReady: true });
    return r;
  }
  const me = r;
  useAppStore.getState().saveUser(me.staff);
  useAppStore.setState({ staffBlocked: null, sheetSync: me.sheet, opsReady: true });
  if (me.sheet && !me.sheet.ok) toast.error(me.sheet.error || "Không kết nối được Sheet vận hành.");

  try {
    const snap = await getOpsStateFn();
    useAppStore.getState().hydrateOps({
      users: snap.users.length ? snap.users : [me.staff],
      transactions: snap.transactions,
      stocks: Object.keys(snap.stocks).length ? snap.stocks : useAppStore.getState().stocks,
    });
  } catch {
    /* chưa có quyền hóa chất / Neon */
  }

  await reloadOpsLedger();

  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("umc_login_logged") !== "1") {
      sessionStorage.setItem("umc_login_logged", "1");
      await persistAuthEvent({
          email: me.staff.Email,
          name: me.staff.Ho_ten,
          role: me.staff.Vai_tro,
          event: "DANG_NHAP",
        });
    }
  } catch {
    /* đăng nhập vẫn vào app — LOGIN_LOG lỗi thì toast ở persistAuthEvent */
  }

  return me;
}

export async function persistAuthEvent(input: {
  email: string;
  name: string;
  role: string;
  event: "DANG_NHAP" | "DANG_XUAT" | "DANG_KY" | "THAT_BAI";
}) {
  try {
    const r = await logAuthEventFn({ data: input });
    if (!r.ok) toast.error(r.error);
    return r;
  } catch (err) {
    toast.error(errMsg(err, "Không ghi được tab LOGIN_LOG."));
    return { ok: false as const, error: errMsg(err, "Không ghi được tab LOGIN_LOG.") };
  }
}

export async function persistShiftLog(log: OpLog, asDraft: boolean) {
  try {
    const r = await saveShiftLogFn({ data: { log, asDraft } });
    if (!r.ok) return r;
    const logs = useAppStore.getState().logs;
    useAppStore.setState({
      logs: logs.some((l) => l.Log_ID === r.log.Log_ID)
        ? logs.map((l) => (l.Log_ID === r.log.Log_ID ? r.log : l))
        : [r.log, ...logs],
      sheetSync: r.sheet,
    });
    return r;
  } catch (err) {
    const error = errMsg(err, "Không ghi được nhật ký lên Sheet.");
    toast.error(error);
    return { ok: false as const, error };
  }
}

export async function persistShiftLogReview(id: string, action: "CHOT" | "TRA_LAI" | "MO_LAI", note: string) {
  try {
    const r = await reviewShiftLogFn({ data: { id, action, note } });
    if (!r.ok) return r;
    useAppStore.setState({
      logs: useAppStore.getState().logs.map((l) => (l.Log_ID === r.log.Log_ID ? r.log : l)),
      sheetSync: r.sheet,
    });
    return r;
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được nhật ký lên Sheet.") };
  }
}

export async function persistChemImport(input: {
  thang: string;
  receipts: ChemReceipt[];
  actor: string;
  note: string;
  lock: boolean;
}) {
  try {
    const r = await saveOpsImportFn({
      data: { thang: input.thang, receipts: input.receipts, note: input.note, submit: input.lock },
    });
    if (!r.ok) return r;
    const rest = (useAppStore.getState().chemConfirms ?? []).filter((c) => c.thang !== r.confirm.thang);
    useAppStore.setState({ chemConfirms: [...rest, r.confirm], sheetSync: r.sheet });
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được tab HOA_CHAT_NHAP.") };
  }
}

export async function persistChemDose(log: { iso: string; qty: ChemQty; actor: string; note: string }) {
  try {
    const r = await saveOpsDoseFn({ data: { iso: log.iso, qty: log.qty, note: log.note } });
    if (!r.ok) return r;
    const rest = (useAppStore.getState().chemDoses ?? []).filter((d) => d.iso !== r.dose.iso);
    useAppStore.setState({
      chemDoses: [...rest, r.dose].sort((a, b) => b.iso.localeCompare(a.iso)),
      sheetSync: r.sheet,
    });
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được tab HOA_CHAT_LIEU.") };
  }
}

export async function persistChemDoseReview(iso: string, action: "CHOT" | "TRA_LAI" | "MO_LAI", note: string) {
  try {
    const r = await reviewOpsDoseFn({ data: { iso, action, note } });
    if (!r.ok) return r;
    useAppStore.setState({
      chemDoses: (useAppStore.getState().chemDoses ?? []).map((d) => (d.iso === r.dose.iso ? r.dose : d)),
      sheetSync: r.sheet,
    });
    return r;
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được tab HOA_CHAT_LIEU.") };
  }
}

export async function persistChemImportReview(thang: string, action: "CHOT" | "TRA_LAI", note: string) {
  try {
    const r = await reviewOpsImportFn({ data: { thang, action, note } });
    if (!r.ok) return r;
    const rest = (useAppStore.getState().chemConfirms ?? []).filter((c) => c.thang !== r.confirm.thang);
    useAppStore.setState({ chemConfirms: [...rest, r.confirm], sheetSync: r.sheet });
    return r;
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được tab HOA_CHAT_NHAP.") };
  }
}

export async function persistChemTx(tx: Omit<ChemTx, "Tx_ID" | "Ngay_tao">) {
  const local = useAppStore.getState().addChemTx(tx);
  if (!local.ok) return local;
  try {
    const r = await saveChemTxFn({ data: tx });
    if (!r.ok) return r;
    useAppStore.setState({ sheetSync: r.sheet });
    sheetToast(r.sheet);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Máy chủ từ chối giao dịch kho.") };
  }
}

export async function persistChemRestock(input: { actor: string; reason: string; qty: ChemQty }) {
  try {
    const r = await saveOpsRestockFn({ data: { reason: input.reason, qty: input.qty } });
    if (!r.ok) return r;
    useAppStore.setState({
      chemRestocks: [r.rec, ...(useAppStore.getState().chemRestocks ?? []).filter((x) => x.id !== r.rec.id)],
      sheetSync: r.sheet,
    });
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được tab HOA_CHAT_DIEU_DONG.") };
  }
}

export async function persistChemRestockReview(id: string, action: "CHOT" | "TRA_LAI", note: string) {
  try {
    const r = await reviewOpsRestockFn({ data: { id, action, note } });
    if (!r.ok) return r;
    useAppStore.setState({
      chemRestocks: (useAppStore.getState().chemRestocks ?? []).map((x) => (x.id === r.rec.id ? r.rec : x)),
      sheetSync: r.sheet,
    });
    return r;
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được tab HOA_CHAT_DIEU_DONG.") };
  }
}

export async function persistChemRestockStatus(id: string, status: ChemRestockStatus) {
  const rec = (useAppStore.getState().chemRestocks ?? []).find((r) => r.id === id);
  if (rec?.approvalStatus === "CHO_DUYET") {
    return { ok: false as const, error: "Chờ quản lý chốt trước khi cập nhật giao hàng." };
  }
  useAppStore.getState().updateChemRestock(id, status);
  try {
    await patchChemRestockFn({ data: { id, status } });
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Máy chủ từ chối cập nhật phiếu.") };
  }
}

export async function persistStaff(user: AppUserRecord) {
  try {
    const r = await saveStaffFn({ data: user });
    useAppStore.getState().saveUser(r.staff);
    if (r.users?.length) useAppStore.setState({ users: r.users });
    toast.success("Đã lưu tài khoản trên máy chủ.");
    return r.staff;
  } catch (err) {
    toast.error(errMsg(err, "Máy chủ từ chối lưu nhân sự."));
    throw err;
  }
}

export async function persistIncident(
  inc: Omit<Incident, "Incident_ID" | "Anh">,
  photos: Array<{ name: string; dataUrl?: string; driveUrl?: string }>,
) {
  try {
    const r = await saveIncidentFn({
      data: {
        incident: {
          Incident_ID: "",
          Equipment_ID: inc.Equipment_ID,
          Ngay_phat_sinh: inc.Ngay_phat_sinh,
          Mo_ta_su_co: inc.Mo_ta_su_co,
          Bien_phap_xu_ly: inc.Bien_phap_xu_ly,
          Trang_thai: inc.Trang_thai,
          Nguoi_khac_phuc: inc.Nguoi_khac_phuc,
          Ngay_hoan_thanh: inc.Ngay_hoan_thanh,
        },
        photos,
      },
    });
    if (!r.ok || !r.sheetOk) {
      const error = ("error" in r && r.error) || r.sheetError || "Không ghi được tab SU_CO_TB.";
      toast.error(error);
      return { ok: false as const, error };
    }
    const anh: EvidencePhoto[] = r.photos ?? [];
    const rec = { ...inc, ...r.rec, Anh: anh };
    useAppStore.setState({
      incidents: [rec, ...useAppStore.getState().incidents.filter((i) => i.Incident_ID !== rec.Incident_ID)],
      sheetSync: r.sheet,
    });
    if (!r.driveOk) toast.error(r.driveError || "Chưa lưu được ảnh lên Drive.");
    else if (anh.length) toast.success(`Đã ghi sự cố lên Sheet · ${anh.length} ảnh trên Drive.`);
    else toast.success("Đã ghi sự cố lên Sheet.");
    return { ok: true as const };
  } catch (err) {
    const error = errMsg(err, "Không ghi được tab SU_CO_TB.");
    toast.error(error);
    return { ok: false as const, error };
  }
}

export async function persistIncidentReview(id: string, action: "CHOT" | "TRA_LAI", note: string) {
  try {
    const r = await reviewOpsIncidentFn({ data: { id, action, note } });
    if (!r.ok) return r;
    useAppStore.setState({
      incidents: useAppStore.getState().incidents.map((i) => (i.Incident_ID === r.rec.Incident_ID ? { ...i, ...r.rec } : i)),
      sheetSync: r.sheet,
    });
    return r;
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Không ghi được tab SU_CO_TB.") };
  }
}

export async function persistMaint(m: Omit<Maintenance, "Maint_ID">) {
  try {
    const r = await saveOpsMaintFn({ data: m });
    if (!r.ok) {
      toast.error(r.error);
      return r;
    }
    useAppStore.setState({
      maintenances: [r.rec, ...useAppStore.getState().maintenances.filter((x) => x.Maint_ID !== r.rec.Maint_ID)],
      sheetSync: r.sheet,
    });
    return r;
  } catch (err) {
    const error = errMsg(err, "Không ghi được tab BAO_TRI_TB.");
    toast.error(error);
    return { ok: false as const, error };
  }
}
