import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AppUserRecord, ChemQty, ChemReceipt, ChemRestockStatus, ChemTx, Maintenance, OpLog } from "@/lib/types";
import { OPS_SHEET_TABS, type ChemSnapshot, type OpsState, type StaffMe } from "./types";

export const getStaffMeFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<StaffMe> => {
    const { resolveStaff, StaffBlockedError } = await import("./staff.server");
    try {
      const staff = await resolveStaff(context.userId);
      return {
        ok: true as const,
        staff,
        sheet: { ok: true, mode: "sheets" as const, tabs: [...OPS_SHEET_TABS] },
      };
    } catch (err) {
      if (err instanceof StaffBlockedError) return { ok: false, blocked: err.message };
      throw err;
    }
  });

export const getOpsStateFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<OpsState> => {
    const { requireAction } = await import("./staff.server");
    const { loadOpsState } = await import("./chem.server");
    const { loadOpsLedger } = await import("./ops-sheet.server");
    await requireAction(context.userId, "hoachat");
    const state = await loadOpsState();
    try {
      const ledger = await loadOpsLedger();
      return {
        ...state,
        confirms: ledger.confirms,
        doses: ledger.doses,
        restocks: ledger.restocks,
        sheet: ledger.sheet,
      };
    } catch (err) {
      return {
        ...state,
        sheet: {
          ok: false,
          mode: "sheets",
          tabs: ["NHAT_KY", "HOA_CHAT_LIEU"],
          error: err instanceof Error ? err.message : "Không đọc được Sheet vận hành.",
        },
      };
    }
  });

export const saveChemImportFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { thang: string; receipts: ChemReceipt[]; note: string; lock: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { saveImport } = await import("./chem.server");
    return saveImport(context.userId, data);
  });

export const saveChemDoseFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { iso: string; qty: ChemQty; note: string }) => input)
  .handler(async ({ context, data }) => {
    const { saveDose } = await import("./chem.server");
    return saveDose(context.userId, data);
  });

export const saveChemTxFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Omit<ChemTx, "Tx_ID" | "Ngay_tao">) => input)
  .handler(async ({ context, data }) => {
    const { saveTx } = await import("./chem.server");
    return saveTx(context.userId, data);
  });

export const saveChemRestockFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { reason: string; qty: ChemQty }) => input)
  .handler(async ({ context, data }) => {
    const { saveRestock } = await import("./chem.server");
    return saveRestock(context.userId, data);
  });

export const patchChemRestockFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: ChemRestockStatus }) => input)
  .handler(async ({ context, data }) => {
    const { patchRestock } = await import("./chem.server");
    await patchRestock(context.userId, data.id, data.status);
    return { ok: true as const };
  });

export const saveStaffFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: AppUserRecord) => input)
  .handler(async ({ context, data }) => {
    const { upsertStaff, listStaff } = await import("./staff.server");
    const { writeAudit } = await import("./audit.server");
    const saved = await upsertStaff(context.userId, data);
    try {
      const actor = await (await import("./staff.server")).resolveStaff(context.userId);
      await writeAudit({
        actorEmail: actor.Email,
        actorRole: actor.Vai_tro,
        action: "LUU_NHAN_SU",
        entity: "staff",
        entityId: saved.User_ID,
        after: saved,
      });
    } catch {
      /* nhật ký số lỗi không được chặn lưu nhân sự */
    }
    return { ok: true as const, staff: saved, users: await listStaff() };
  });

export const listAuditsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAction } = await import("./staff.server");
    const { listAudits } = await import("./audit.server");
    await requireAction(context.userId, "view_audit");
    return listAudits(120);
  });

export const restoreBackupFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { restoreBackup } = await import("./chem.server");
    return restoreBackup(context.userId, id);
  });

export const migrateLocalChemFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Pick<ChemSnapshot, "confirms" | "doses" | "restocks" | "transactions">) => input)
  .handler(async ({ context, data }) => {
    const { importLocalSnapshot } = await import("./chem.server");
    return importLocalSnapshot(context.userId, data);
  });

export const saveIncidentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      incident: {
        Incident_ID: string;
        Equipment_ID: string;
        Ngay_phat_sinh: string;
        Mo_ta_su_co: string;
        Bien_phap_xu_ly: string;
        Trang_thai: string;
        Nguoi_khac_phuc: string;
        Ngay_hoan_thanh: string;
      };
      photos: Array<{ name: string; dataUrl?: string; driveUrl?: string }>;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { requireAction } = await import("./staff.server");
    const { uid } = await import("@/lib/utils");
    const staff = await requireAction(context.userId, "write_thietbi");
    const { persistIncidentServer } = await import("./ops-persist.server");
    const { uploadEvidencePhoto, appendIncidentRow } = await import("@/lib/google-drive");
    const { parseDriveFileId, driveViewUrl } = await import("@/lib/drive-tree");
    const photos: Array<{
      id: string;
      name: string;
      url: string;
      driveId?: string;
      bytes: number;
      local?: boolean;
    }> = [];
    let driveOk = true;
    let driveError = "";
    for (const p of data.photos.slice(0, 8)) {
      try {
        const existingId = p.driveUrl ? parseDriveFileId(p.driveUrl) : null;
        if (existingId) {
          photos.push({
            id: uid("PIC"),
            name: p.name || "drive",
            url: driveViewUrl(existingId),
            driveId: existingId,
            bytes: 0,
          });
          continue;
        }
        if (!p.dataUrl) throw new Error("Thiếu ảnh hoặc link Drive.");
        photos.push(await uploadEvidencePhoto({ name: p.name, dataUrl: p.dataUrl, kind: "su_co" }));
      } catch (err) {
        driveOk = false;
        driveError = err instanceof Error ? err.message : String(err);
      }
    }
    const links = photos.filter((p) => p.driveId).map((p) => p.url).join("\n");
    const persisted = await persistIncidentServer(context.userId, {
      ...data.incident,
      Anh: photos.filter((p) => p.driveId),
    });
    if (!persisted.ok) {
      return {
        ok: false as const,
        error: persisted.error,
        photos: photos.filter((p) => p.driveId),
        driveOk,
        driveError,
        sheetOk: false,
        sheetError: persisted.error,
      };
    }
    try {
      await appendIncidentRow({
        ...data.incident,
        Incident_ID: persisted.rec.Incident_ID,
        Hinh_anh_links: links,
        Nguoi_tao: staff.Email,
      });
    } catch {
      /* tab EQP_INCIDENTS phụ — nguồn sự thật là SU_CO_TB */
    }
    return {
      ok: true as const,
      rec: persisted.rec,
      photos: photos.filter((p) => p.driveId),
      driveOk,
      driveError,
      sheetOk: true,
      sheetError: "",
      sheet: persisted.sheet,
    };
  });

export const getOpsLedgerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { resolveStaff } = await import("./staff.server");
    await resolveStaff(context.userId);
    const { loadOpsLedger } = await import("./ops-sheet.server");
    return loadOpsLedger();
  });

export const saveShiftLogFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { log: OpLog; asDraft: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { persistShiftLogServer } = await import("./ops-persist.server");
    return persistShiftLogServer(context.userId, data);
  });

export const reviewShiftLogFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; action: "CHOT" | "TRA_LAI" | "MO_LAI"; note: string }) => input)
  .handler(async ({ context, data }) => {
    const { reviewShiftLogServer } = await import("./ops-persist.server");
    return reviewShiftLogServer(context.userId, data);
  });

export const saveOpsDoseFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { iso: string; qty: ChemQty; note: string }) => input)
  .handler(async ({ context, data }) => {
    const { persistDoseServer } = await import("./ops-persist.server");
    return persistDoseServer(context.userId, data);
  });

export const reviewOpsDoseFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { iso: string; action: "CHOT" | "TRA_LAI" | "MO_LAI"; note: string }) => input)
  .handler(async ({ context, data }) => {
    const { reviewDoseServer } = await import("./ops-persist.server");
    return reviewDoseServer(context.userId, data);
  });

export const saveOpsImportFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { thang: string; receipts: ChemReceipt[]; note: string; submit: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { persistImportServer } = await import("./ops-persist.server");
    return persistImportServer(context.userId, data);
  });

export const reviewOpsImportFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { thang: string; action: "CHOT" | "TRA_LAI"; note: string }) => input)
  .handler(async ({ context, data }) => {
    const { reviewImportServer } = await import("./ops-persist.server");
    return reviewImportServer(context.userId, data);
  });

export const saveOpsRestockFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { reason: string; qty: ChemQty }) => input)
  .handler(async ({ context, data }) => {
    const { persistRestockServer } = await import("./ops-persist.server");
    return persistRestockServer(context.userId, data);
  });

export const reviewOpsRestockFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; action: "CHOT" | "TRA_LAI"; note: string }) => input)
  .handler(async ({ context, data }) => {
    const { reviewRestockServer } = await import("./ops-persist.server");
    return reviewRestockServer(context.userId, data);
  });

export const reviewOpsIncidentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; action: "CHOT" | "TRA_LAI"; note: string }) => input)
  .handler(async ({ context, data }) => {
    const { reviewIncidentServer } = await import("./ops-persist.server");
    return reviewIncidentServer(context.userId, data);
  });

export const saveOpsMaintFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Omit<Maintenance, "Maint_ID"> & { Maint_ID?: string }) => input)
  .handler(async ({ context, data }) => {
    const { persistMaintServer } = await import("./ops-persist.server");
    return persistMaintServer(context.userId, data);
  });

export const logAuthEventFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      email: string;
      name: string;
      role: string;
      event: "DANG_NHAP" | "DANG_XUAT" | "DANG_KY" | "THAT_BAI";
    }) => input,
  )
  .handler(async ({ data }) => {
    const { persistLoginServer } = await import("./ops-persist.server");
    return persistLoginServer(data);
  });

