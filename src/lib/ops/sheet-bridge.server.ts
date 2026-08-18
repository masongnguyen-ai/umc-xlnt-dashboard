import { liveChemStock, vnTodayISO } from "@/lib/chem-plan";
import type { ChemDoseLog, ChemImportConfirm, ChemQty } from "@/lib/types";
import type { AuditEvent, SheetSyncInfo } from "./types";
import { CHEM_SHEET_TABS, QTY_TO_MA } from "./types";

const FLOW_MARKERS = [
  "2PACX-1vTVjo2dh9Qd0mleS94_5LYzM-ju1wuJunMZohkLavn03i6W78IKwWOIUEsa6FEEH2UTpB8ee8XHWeoo",
  "gid=1963700720",
  "DASHBOARD_DATA",
];

export type ChemSheetPayload = {
  source: "umc-xlnt-web";
  neverTouch: "flow-sheet";
  secret: string;
  chemNhap: Array<{
    thang: string;
    locked: boolean;
    actor: string;
    at: string;
    note: string;
    micro: number;
    matri: number;
    naoh: number;
    nahco3: number;
    javen: number;
    receiptsJson: string;
  }>;
  chemLieu: Array<{
    iso: string;
    actor: string;
    at: string;
    note: string;
    micro: number;
    matri: number;
    naoh: number;
    nahco3: number;
    javen: number;
  }>;
  chemTon: Array<{ ma: string; ton: number; at: string }>;
  audit: {
    id: string;
    at: string;
    email: string;
    role: string;
    action: string;
    entity: string;
    entityId: string;
    before: string;
    after: string;
  } | null;
};

export function assertNotFlowSheet(url: string) {
  const lower = url.toLowerCase();
  for (const m of FLOW_MARKERS) {
    if (lower.includes(m.toLowerCase())) {
      throw new Error("Từ chối: webhook trỏ nhầm sheet lưu lượng. Chỉ ghi spreadsheet CSDL.");
    }
  }
}

function qtyRow(q: ChemQty) {
  return {
    micro: q.micro,
    matri: q.matri,
    naoh: q.naoh,
    nahco3: q.nahco3,
    javen: q.javen,
  };
}

export function buildChemSheetPayload(input: {
  secret: string;
  confirms: ChemImportConfirm[];
  doses: ChemDoseLog[];
  audit: AuditEvent | null;
}): ChemSheetPayload {
  const today = vnTodayISO();
  const live = liveChemStock(input.confirms, input.doses, today);
  const at = new Date().toISOString();
  return {
    source: "umc-xlnt-web",
    neverTouch: "flow-sheet",
    secret: input.secret,
    chemNhap: input.confirms.map((c) => ({
      thang: c.thang,
      locked: c.locked,
      actor: c.actor,
      at: c.at,
      note: c.note,
      ...qtyRow(c.qty),
      receiptsJson: JSON.stringify(c.receipts),
    })),
    chemLieu: input.doses.map((d) => ({
      iso: d.iso,
      actor: d.actor,
      at: d.at,
      note: d.note,
      ...qtyRow(d.qty),
    })),
    chemTon: (Object.keys(QTY_TO_MA) as Array<keyof typeof QTY_TO_MA>).map((k) => ({
      ma: QTY_TO_MA[k],
      ton: live[k],
      at,
    })),
    audit: input.audit
      ? {
          id: input.audit.id,
          at: input.audit.at,
          email: input.audit.actorEmail,
          role: input.audit.actorRole,
          action: input.audit.action,
          entity: input.audit.entity,
          entityId: input.audit.entityId,
          before: input.audit.before,
          after: input.audit.after,
        }
      : null,
  };
}

export function localSheetInfo(): SheetSyncInfo {
  return {
    ok: true,
    mode: "local",
    tabs: [...CHEM_SHEET_TABS],
    error: "Chưa gắn webhook Apps Script — số đã lưu máy chủ, chưa đẩy tab CHEM_*",
  };
}

export async function pushChemSheet(payload: ChemSheetPayload): Promise<SheetSyncInfo> {
  const url = (process.env.CHEM_SHEET_WEBHOOK_URL ?? "").trim();
  if (!url) return localSheetInfo();
  assertNotFlowSheet(url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "UMC-XLNT/chem-bridge" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body: { ok?: boolean; tabs?: string[]; error?: string; message?: string } = {};
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      body = { error: text.slice(0, 240) };
    }
    if (!res.ok || body.ok === false) {
      return {
        ok: false,
        mode: "webhook",
        tabs: [...CHEM_SHEET_TABS],
        error: body.error || body.message || `Sheet HTTP ${res.status}`,
      };
    }
    return { ok: true, mode: "webhook", tabs: body.tabs?.length ? body.tabs : [...CHEM_SHEET_TABS] };
  } catch (err) {
    return {
      ok: false,
      mode: "webhook",
      tabs: [...CHEM_SHEET_TABS],
      error: err instanceof Error ? err.message : "Không gửi được ChemBridge",
    };
  }
}

export function sheetConfigured(): boolean {
  return Boolean((process.env.CHEM_SHEET_WEBHOOK_URL ?? "").trim());
}

export function sheetSecret(): string {
  return (process.env.CHEM_SHEET_SECRET ?? "").trim();
}
