import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AppUserRecord, ChemQty, ChemReceipt, ChemRestockStatus, ChemTx } from "@/lib/types";
import type { ChemSnapshot, OpsState, SheetSyncInfo, StaffMe } from "./types";

export const getStaffMeFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<StaffMe> => {
    const { resolveStaff, StaffBlockedError } = await import("./staff.server");
    const { sheetConfigured, localSheetInfo } = await import("./sheet-bridge.server");
    try {
      const staff = await resolveStaff(context.userId);
      const sheet: SheetSyncInfo = sheetConfigured()
        ? { ok: true, mode: "webhook", tabs: ["CHEM_NHAP", "CHEM_LIEU", "CHEM_TON", "AUDIT_SO"] }
        : localSheetInfo();
      return { ok: true, staff, sheet };
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
    const { sheetConfigured, localSheetInfo } = await import("./sheet-bridge.server");
    await requireAction(context.userId, "hoachat");
    const state = await loadOpsState();
    return {
      ...state,
      sheet: sheetConfigured()
        ? { ok: true, mode: "webhook", tabs: state.sheet.tabs }
        : localSheetInfo(),
    };
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
    const actor = await (await import("./staff.server")).resolveStaff(context.userId);
    await writeAudit({
      actorEmail: actor.Email,
      actorRole: actor.Vai_tro,
      action: "LUU_NHAN_SU",
      entity: "staff",
      entityId: saved.User_ID,
      after: saved,
    });
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
    let sheetOk = false;
    let sheetError = "";
    try {
      await appendIncidentRow({
        ...data.incident,
        Hinh_anh_links: links,
        Nguoi_tao: staff.Email,
      });
      sheetOk = true;
    } catch (err) {
      sheetError = err instanceof Error ? err.message : String(err);
    }
    return {
      ok: true as const,
      photos: photos.filter((p) => p.driveId),
      driveOk,
      driveError,
      sheetOk,
      sheetError,
    };
  });
