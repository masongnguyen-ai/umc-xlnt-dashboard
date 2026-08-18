import { liveChemStock, vnTodayISO } from "@/lib/chem-plan";
import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import type {
  ChemDoseLog,
  ChemImportConfirm,
  ChemQty,
  ChemReceipt,
  ChemRestockRequest,
  ChemRestockStatus,
  ChemTx,
  Role,
} from "@/lib/types";
import { listAudits, writeAudit } from "./audit.server";
import { listBackups, loadBackupPayload, saveBackup } from "./backup.server";
import { buildChemSheetPayload, localSheetInfo, pushChemSheet, sheetSecret } from "./sheet-bridge.server";
import { listStaff, requireAction } from "./staff.server";
import type { ChemSnapshot, OpsState, SheetSyncInfo } from "./types";
import { QTY_TO_MA } from "./types";

type ImportRow = {
  thang: string;
  receipts_json: string;
  qty_json: string;
  locked: boolean;
  actor_email: string;
  note: string;
  at: string;
};

type DoseRow = {
  iso: string;
  qty_json: string;
  actor_email: string;
  note: string;
  at: string;
};

type RestockRow = {
  id: string;
  qty_json: string;
  actor_email: string;
  reason: string;
  status: ChemRestockStatus;
  at: string;
};

type TxRow = {
  tx_id: string;
  ma_hoa_chat: string;
  loai_giao_dich: "NHAP" | "XUAT";
  so_luong: number;
  lo_san_xuat: string;
  han_su_dung: string;
  ngay_thuc_hien: string;
  ghi_chu: string;
  nguoi_tao: string;
  ngay_tao: string;
};

function parseQty(raw: string): ChemQty {
  const v = JSON.parse(raw) as ChemQty;
  return {
    micro: Number(v.micro) || 0,
    matri: Number(v.matri) || 0,
    naoh: Number(v.naoh) || 0,
    nahco3: Number(v.nahco3) || 0,
    javen: Number(v.javen) || 0,
  };
}

function toConfirm(r: ImportRow): ChemImportConfirm {
  return {
    thang: r.thang,
    receipts: JSON.parse(r.receipts_json) as ChemReceipt[],
    qty: parseQty(r.qty_json),
    locked: Boolean(r.locked),
    actor: r.actor_email,
    at: String(r.at),
    note: r.note,
  };
}

function toDose(r: DoseRow): ChemDoseLog {
  return {
    iso: r.iso,
    qty: parseQty(r.qty_json),
    actor: r.actor_email,
    at: String(r.at),
    note: r.note,
  };
}

function toRestock(r: RestockRow): ChemRestockRequest {
  return {
    id: r.id,
    at: String(r.at),
    actor: r.actor_email,
    reason: r.reason,
    qty: parseQty(r.qty_json),
    status: r.status,
  };
}

function toTx(r: TxRow): ChemTx {
  return {
    Tx_ID: r.tx_id,
    Ma_hoa_chat: r.ma_hoa_chat,
    Loai_giao_dich: r.loai_giao_dich,
    So_luong: Number(r.so_luong),
    Lo_san_xuat: r.lo_san_xuat,
    Han_su_dung: r.han_su_dung,
    Ngay_thuc_hien: r.ngay_thuc_hien,
    Ghi_chu: r.ghi_chu,
    Nguoi_tao: r.nguoi_tao,
    Ngay_tao: String(r.ngay_tao),
  };
}

async function readSnapshot(): Promise<ChemSnapshot> {
  const sql = await getSql();
  const confirms = (await sql<ImportRow>`select thang, receipts_json, qty_json, locked, actor_email, note, at from chem_imports order by thang desc`).map(toConfirm);
  const doses = (await sql<DoseRow>`select iso, qty_json, actor_email, note, at from chem_doses order by iso desc`).map(toDose);
  const restocks = (await sql<RestockRow>`select id, qty_json, actor_email, reason, status, at from chem_restocks order by at desc`).map(toRestock);
  const transactions = (
    await sql<TxRow>`
      select tx_id, ma_hoa_chat, loai_giao_dich, so_luong, lo_san_xuat, han_su_dung, ngay_thuc_hien, ghi_chu, nguoi_tao, ngay_tao
      from chem_transactions order by ngay_tao desc
    `
  ).map(toTx);
  const stockRows = await sql<{ ma_hoa_chat: string; ton_kho: number }>`select ma_hoa_chat, ton_kho from chem_stocks`;
  const stocks = { NAOH: 0, JAVEN: 0, NAHCO3: 0, MATRI: 0, VISINH: 0 };
  for (const s of stockRows) {
    if (s.ma_hoa_chat === "NAOH" || s.ma_hoa_chat === "JAVEN" || s.ma_hoa_chat === "NAHCO3" || s.ma_hoa_chat === "MATRI" || s.ma_hoa_chat === "VISINH") {
      stocks[s.ma_hoa_chat] = Number(s.ton_kho) || 0;
    }
  }
  const liveStock = liveChemStock(confirms, doses, vnTodayISO());
  return { confirms, doses, restocks, transactions, stocks, liveStock };
}

async function upsertLiveStocks(live: ChemQty) {
  const sql = await getSql();
  for (const key of Object.keys(QTY_TO_MA) as Array<keyof typeof QTY_TO_MA>) {
    const ma = QTY_TO_MA[key];
    await sql`
      insert into chem_stocks (ma_hoa_chat, ton_kho, ngay_cap_nhat)
      values (${ma}, ${live[key]}, now())
      on conflict (ma_hoa_chat) do update set ton_kho = excluded.ton_kho, ngay_cap_nhat = now()
    `;
  }
}

async function afterWrite(actorEmail: string, kind: string, auditId: string | null): Promise<SheetSyncInfo> {
  const snap = await readSnapshot();
  await upsertLiveStocks(snap.liveStock);
  await saveBackup(actorEmail, kind, snap);
  const audits = await listAudits(1);
  const audit = auditId ? audits.find((a) => a.id === auditId) ?? audits[0] ?? null : audits[0] ?? null;
  return pushChemSheet(
    buildChemSheetPayload({
      secret: sheetSecret(),
      confirms: snap.confirms,
      doses: snap.doses,
      audit,
    }),
  );
}

export async function loadOpsState(): Promise<Omit<OpsState, "sheet"> & { sheet: SheetSyncInfo }> {
  const snap = await readSnapshot();
  const [users, audits, backups] = await Promise.all([listStaff(), listAudits(80), listBackups(20)]);
  return { ...snap, users, audits, backups, sheet: localSheetInfo() };
}

export async function saveImport(
  authUserId: string,
  input: { thang: string; receipts: ChemReceipt[]; note: string; lock: boolean },
): Promise<{ ok: true; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_hoachat");
  if (!input.thang) return { ok: false, error: "Thiếu kỳ nhập." };
  if (!input.receipts.length) return { ok: false, error: "Cần ít nhất một ngày nhập." };
  if (input.receipts.length > 3) return { ok: false, error: "Tối đa 3 ngày nhập trong một kỳ." };
  for (const r of input.receipts) {
    if (!r.ngay) return { ok: false, error: "Thiếu ngày nhập." };
    if (Object.values(r.qty).some((n) => n < 0 || Number.isNaN(n))) {
      return { ok: false, error: "Số lượng không được âm." };
    }
  }

  const sql = await getSql();
  const prevRows = await sql<ImportRow>`
    select thang, receipts_json, qty_json, locked, actor_email, note, at from chem_imports where thang = ${input.thang}
  `;
  const prev = prevRows[0] ? toConfirm(prevRows[0]) : null;
  if (prev?.locked && staff.Vai_tro !== "QUAN_LY") {
    return { ok: false, error: "Kỳ đã chốt. Chỉ quản lý được sửa lại." };
  }

  const qty = input.receipts.reduce(
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
    thang: input.thang,
    receipts: input.receipts,
    qty,
    locked: input.lock,
    actor: staff.Email,
    at: new Date().toISOString(),
    note: input.note,
  };

  await sql`
    insert into chem_imports (thang, receipts_json, qty_json, locked, actor_email, actor_role, note, at)
    values (
      ${rec.thang}, ${JSON.stringify(rec.receipts)}, ${JSON.stringify(rec.qty)},
      ${rec.locked}, ${staff.Email}, ${staff.Vai_tro}, ${rec.note}, now()
    )
    on conflict (thang) do update set
      receipts_json = excluded.receipts_json,
      qty_json = excluded.qty_json,
      locked = excluded.locked,
      actor_email = excluded.actor_email,
      actor_role = excluded.actor_role,
      note = excluded.note,
      at = now()
  `;
  const audit = await writeAudit({
    actorEmail: staff.Email,
    actorRole: staff.Vai_tro as Role,
    action: rec.locked ? "CHOT_NHAP" : "LUU_NHAP",
    entity: "chem_import",
    entityId: rec.thang,
    before: prev,
    after: rec,
  });
  const sheet = await afterWrite(staff.Email, rec.locked ? "chot-nhap" : "nhap-nhap", audit.id);
  return { ok: true, sheet };
}

export async function saveDose(
  authUserId: string,
  input: { iso: string; qty: ChemQty; note: string },
): Promise<{ ok: true; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_chem_dose");
  if (!input.iso) return { ok: false, error: "Thiếu ngày châm." };
  if (Object.values(input.qty).some((n) => n < 0 || Number.isNaN(n))) {
    return { ok: false, error: "Liều không được âm." };
  }
  const sql = await getSql();
  const prevRows = await sql<DoseRow>`select iso, qty_json, actor_email, note, at from chem_doses where iso = ${input.iso}`;
  const prev = prevRows[0] ? toDose(prevRows[0]) : null;
  const rec: ChemDoseLog = {
    iso: input.iso,
    qty: input.qty,
    actor: staff.Email,
    at: new Date().toISOString(),
    note: input.note,
  };
  await sql`
    insert into chem_doses (iso, qty_json, actor_email, actor_role, note, at)
    values (${rec.iso}, ${JSON.stringify(rec.qty)}, ${staff.Email}, ${staff.Vai_tro}, ${rec.note}, now())
    on conflict (iso) do update set
      qty_json = excluded.qty_json,
      actor_email = excluded.actor_email,
      actor_role = excluded.actor_role,
      note = excluded.note,
      at = now()
  `;
  const audit = await writeAudit({
    actorEmail: staff.Email,
    actorRole: staff.Vai_tro as Role,
    action: prev ? "SUA_LIEU" : "GHI_LIEU",
    entity: "chem_dose",
    entityId: rec.iso,
    before: prev,
    after: rec,
  });
  const sheet = await afterWrite(staff.Email, "lieu", audit.id);
  return { ok: true, sheet };
}

export async function saveTx(
  authUserId: string,
  tx: Omit<ChemTx, "Tx_ID" | "Ngay_tao">,
): Promise<{ ok: true; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_hoachat");
  if (tx.So_luong <= 0) return { ok: false, error: "Số lượng phải lớn hơn 0." };
  const sql = await getSql();
  const stockRows = await sql<{ ton_kho: number }>`select ton_kho from chem_stocks where ma_hoa_chat = ${tx.Ma_hoa_chat}`;
  const stock = Number(stockRows[0]?.ton_kho ?? 0);
  if (tx.Loai_giao_dich === "XUAT" && tx.So_luong > stock) {
    return { ok: false, error: `Chặn tồn kho âm. Tồn hiện tại ${stock}.` };
  }
  const next = tx.Loai_giao_dich === "NHAP" ? stock + tx.So_luong : stock - tx.So_luong;
  const rec: ChemTx = { ...tx, Tx_ID: uid("TX"), Ngay_tao: new Date().toISOString(), Nguoi_tao: staff.Email };
  await sql`
    insert into chem_transactions (
      tx_id, ma_hoa_chat, loai_giao_dich, so_luong, lo_san_xuat, han_su_dung, ngay_thuc_hien, ghi_chu, nguoi_tao
    ) values (
      ${rec.Tx_ID}, ${rec.Ma_hoa_chat}, ${rec.Loai_giao_dich}, ${rec.So_luong},
      ${rec.Lo_san_xuat}, ${rec.Han_su_dung}, ${rec.Ngay_thuc_hien}, ${rec.Ghi_chu}, ${staff.Email}
    )
  `;
  await sql`
    insert into chem_stocks (ma_hoa_chat, ton_kho, ngay_cap_nhat)
    values (${tx.Ma_hoa_chat}, ${next}, now())
    on conflict (ma_hoa_chat) do update set ton_kho = excluded.ton_kho, ngay_cap_nhat = now()
  `;
  const audit = await writeAudit({
    actorEmail: staff.Email,
    actorRole: staff.Vai_tro as Role,
    action: rec.Loai_giao_dich,
    entity: "chem_tx",
    entityId: rec.Tx_ID,
    before: { ton: stock },
    after: { ...rec, ton: next },
  });
  const sheet = await afterWrite(staff.Email, "giao-dich", audit.id);
  return { ok: true, sheet };
}

export async function saveRestock(
  authUserId: string,
  input: { reason: string; qty: ChemQty },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_chem_dose");
  if (Object.values(input.qty).every((n) => n <= 0)) {
    return { ok: false, error: "Chưa có khối lượng cần điều động." };
  }
  const sql = await getSql();
  const id = uid("RST");
  await sql`
    insert into chem_restocks (id, qty_json, actor_email, reason, status)
    values (${id}, ${JSON.stringify(input.qty)}, ${staff.Email}, ${input.reason}, ${"MOI"})
  `;
  await writeAudit({
    actorEmail: staff.Email,
    actorRole: staff.Vai_tro as Role,
    action: "DIEU_DONG",
    entity: "chem_restock",
    entityId: id,
    after: input,
  });
  return { ok: true };
}

export async function patchRestock(authUserId: string, id: string, status: ChemRestockStatus) {
  const staff = await requireAction(authUserId, "write_hoachat");
  const sql = await getSql();
  const prev = await sql<{ status: string }>`select status from chem_restocks where id = ${id}`;
  await sql`update chem_restocks set status = ${status} where id = ${id}`;
  await writeAudit({
    actorEmail: staff.Email,
    actorRole: staff.Vai_tro as Role,
    action: "CAP_NHAT_DIEU_DONG",
    entity: "chem_restock",
    entityId: id,
    before: prev[0] ?? null,
    after: { status },
  });
}

export async function restoreBackup(authUserId: string, id: string): Promise<{ ok: true; sheet: SheetSyncInfo } | { ok: false; error: string }> {
  const staff = await requireAction(authUserId, "write_backup");
  const payload = await loadBackupPayload(id);
  if (!payload) return { ok: false, error: "Không tìm thấy bản sao lưu." };
  const sql = await getSql();
  await sql`delete from chem_imports`;
  await sql`delete from chem_doses`;
  await sql`delete from chem_restocks`;
  await sql`delete from chem_transactions`;
  for (const c of payload.confirms) {
    await sql`
      insert into chem_imports (thang, receipts_json, qty_json, locked, actor_email, actor_role, note, at)
      values (${c.thang}, ${JSON.stringify(c.receipts)}, ${JSON.stringify(c.qty)}, ${c.locked}, ${c.actor}, ${staff.Vai_tro}, ${c.note}, ${c.at}::timestamptz)
    `;
  }
  for (const d of payload.doses) {
    await sql`
      insert into chem_doses (iso, qty_json, actor_email, actor_role, note, at)
      values (${d.iso}, ${JSON.stringify(d.qty)}, ${d.actor}, ${staff.Vai_tro}, ${d.note}, ${d.at}::timestamptz)
    `;
  }
  for (const r of payload.restocks) {
    await sql`
      insert into chem_restocks (id, qty_json, actor_email, reason, status, at)
      values (${r.id}, ${JSON.stringify(r.qty)}, ${r.actor}, ${r.reason}, ${r.status}, ${r.at}::timestamptz)
    `;
  }
  for (const t of payload.transactions) {
    await sql`
      insert into chem_transactions (
        tx_id, ma_hoa_chat, loai_giao_dich, so_luong, lo_san_xuat, han_su_dung, ngay_thuc_hien, ghi_chu, nguoi_tao, ngay_tao
      ) values (
        ${t.Tx_ID}, ${t.Ma_hoa_chat}, ${t.Loai_giao_dich}, ${t.So_luong},
        ${t.Lo_san_xuat}, ${t.Han_su_dung}, ${t.Ngay_thuc_hien}, ${t.Ghi_chu}, ${t.Nguoi_tao}, ${t.Ngay_tao}::timestamptz
      )
    `;
  }
  const audit = await writeAudit({
    actorEmail: staff.Email,
    actorRole: staff.Vai_tro as Role,
    action: "KHOI_PHUC_BACKUP",
    entity: "backup",
    entityId: id,
    after: { confirms: payload.confirms.length, doses: payload.doses.length },
  });
  const sheet = await afterWrite(staff.Email, "restore", audit.id);
  return { ok: true, sheet };
}

export async function importLocalSnapshot(
  authUserId: string,
  snap: Pick<ChemSnapshot, "confirms" | "doses" | "restocks" | "transactions">,
): Promise<SheetSyncInfo> {
  const staff = await requireAction(authUserId, "hoachat");
  const current = await readSnapshot();
  if (current.confirms.length || current.doses.length) return localSheetInfo();
  const sql = await getSql();
  for (const c of snap.confirms) {
    await sql`
      insert into chem_imports (thang, receipts_json, qty_json, locked, actor_email, actor_role, note, at)
      values (${c.thang}, ${JSON.stringify(c.receipts)}, ${JSON.stringify(c.qty)}, ${c.locked}, ${c.actor}, ${staff.Vai_tro}, ${c.note}, now())
      on conflict (thang) do nothing
    `;
  }
  for (const d of snap.doses) {
    await sql`
      insert into chem_doses (iso, qty_json, actor_email, actor_role, note, at)
      values (${d.iso}, ${JSON.stringify(d.qty)}, ${d.actor}, ${staff.Vai_tro}, ${d.note}, now())
      on conflict (iso) do nothing
    `;
  }
  if (snap.confirms.length || snap.doses.length) {
    const audit = await writeAudit({
      actorEmail: staff.Email,
      actorRole: staff.Vai_tro as Role,
      action: "NAP_LOCAL",
      entity: "chem",
      entityId: "migrate",
      after: { confirms: snap.confirms.length, doses: snap.doses.length },
    });
    return afterWrite(staff.Email, "migrate-local", audit.id);
  }
  return localSheetInfo();
}
