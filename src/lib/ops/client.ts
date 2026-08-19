import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type { AppUserRecord, ChemQty, ChemReceipt, ChemRestockStatus, ChemTx, EvidencePhoto, Incident } from "@/lib/types";
import type { SheetSyncInfo } from "./types";
import {
  getOpsStateFn,
  getStaffMeFn,
  migrateLocalChemFn,
  patchChemRestockFn,
  saveChemDoseFn,
  saveChemImportFn,
  saveChemRestockFn,
  saveChemTxFn,
  saveIncidentFn,
  saveStaffFn,
} from "./fns";

const MIGRATED_KEY = "umc_ops_migrated_v1";

function sheetToast(sheet?: SheetSyncInfo) {
  if (!sheet) return;
  if (sheet.mode === "local") return;
  if (sheet.ok) toast.success(`Đã ghi tab ${sheet.tabs.join(" · ")} — không đụng sheet lưu lượng.`);
  else toast.error(sheet.error || "Không ghi được sheet hóa chất.");
}

function errMsg(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

export function errMessage(err: unknown, fallback = "Lỗi máy chủ") {
  return errMsg(err, fallback);
}

export async function hydrateOpsFromServer() {
  const r = await getStaffMeFn();
  if (!r.ok) {
    useAppStore.setState({ staffBlocked: r.blocked, opsReady: true });
    return r;
  }
  const me = r;
  useAppStore.setState({ staffBlocked: null, sheetSync: me.sheet, opsReady: true });

  try {
    const snap = await getOpsStateFn();
    useAppStore.getState().hydrateOps({
      users: snap.users.length ? snap.users : [me.staff],
      chemConfirms: snap.confirms,
      chemDoses: snap.doses,
      chemRestocks: snap.restocks,
      transactions: snap.transactions,
      stocks: Object.keys(snap.stocks).length ? snap.stocks : useAppStore.getState().stocks,
      sheetSync: snap.sheet,
    });

    if (localStorage.getItem(MIGRATED_KEY) !== "1") {
      const store = useAppStore.getState();
      if (!snap.confirms.length && !snap.doses.length && (store.chemConfirms.length || store.chemDoses.length)) {
        await migrateLocalChemFn({
          data: {
            confirms: store.chemConfirms,
            doses: store.chemDoses,
            restocks: store.chemRestocks ?? [],
            transactions: store.transactions ?? [],
          },
        });
        const again = await getOpsStateFn();
        useAppStore.getState().hydrateOps({
          users: again.users.length ? again.users : [me.staff],
          chemConfirms: again.confirms,
          chemDoses: again.doses,
          chemRestocks: again.restocks,
          transactions: again.transactions,
          stocks: again.stocks,
          sheetSync: again.sheet,
        });
      }
      localStorage.setItem(MIGRATED_KEY, "1");
    }
  } catch {
    /* lần đầu / chưa có quyền hóa chất */
  }
  return me;
}

export async function persistChemImport(input: {
  thang: string;
  receipts: ChemReceipt[];
  actor: string;
  note: string;
  lock: boolean;
}) {
  const local = useAppStore.getState().confirmChemImport(input);
  if (!local.ok) return local;
  try {
    const r = await saveChemImportFn({
      data: { thang: input.thang, receipts: input.receipts, note: input.note, lock: input.lock },
    });
    if (!r.ok) return r;
    useAppStore.setState({ sheetSync: r.sheet });
    sheetToast(r.sheet);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Máy chủ từ chối chốt nhập.") };
  }
}

export async function persistChemDose(log: { iso: string; qty: ChemQty; actor: string; note: string }) {
  const local = useAppStore.getState().saveChemDose(log);
  if (!local.ok) return local;
  try {
    const r = await saveChemDoseFn({ data: { iso: log.iso, qty: log.qty, note: log.note } });
    if (!r.ok) return r;
    useAppStore.setState({ sheetSync: r.sheet });
    sheetToast(r.sheet);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Máy chủ từ chối ghi liều.") };
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
  const local = useAppStore.getState().requestChemRestock(input);
  if (!local.ok) return local;
  try {
    return await saveChemRestockFn({ data: { reason: input.reason, qty: input.qty } });
  } catch (err) {
    return { ok: false as const, error: errMsg(err, "Máy chủ từ chối điều động.") };
  }
}

export async function persistChemRestockStatus(id: string, status: ChemRestockStatus) {
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
  const rec = useAppStore.getState().addIncident({ ...inc, Anh: [] });
  try {
    const r = await saveIncidentFn({
      data: {
        incident: {
          Incident_ID: rec.Incident_ID,
          Equipment_ID: rec.Equipment_ID,
          Ngay_phat_sinh: rec.Ngay_phat_sinh,
          Mo_ta_su_co: rec.Mo_ta_su_co,
          Bien_phap_xu_ly: rec.Bien_phap_xu_ly,
          Trang_thai: rec.Trang_thai,
          Nguoi_khac_phuc: rec.Nguoi_khac_phuc,
          Ngay_hoan_thanh: rec.Ngay_hoan_thanh,
        },
        photos,
      },
    });
    const anh: EvidencePhoto[] = r.photos ?? [];
    useAppStore.setState({
      incidents: useAppStore.getState().incidents.map((i) => (i.Incident_ID === rec.Incident_ID ? { ...i, Anh: anh } : i)),
    });
    if (!r.driveOk) {
      toast.error(r.driveError || "Chưa lưu được ảnh lên Drive. Chia sẻ thư mục ảnh cho tài khoản máy chủ.");
    } else if (anh.length) {
      toast.success(`Đã ghi sự cố · ${anh.length} ảnh trên Drive.`);
    } else {
      toast.success("Đã ghi sự cố.");
    }
    if (!r.sheetOk && r.sheetError) {
      toast.message("Sự cố đã lưu trên máy — chưa ghi được tab EQP_INCIDENTS.");
    }
    return { ok: true as const };
  } catch (err) {
    toast.success("Đã ghi sự cố trên máy.");
    return { ok: true as const, warning: errMsg(err, "Chưa đẩy được Drive.") };
  }
}
