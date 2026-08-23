import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import { writeAudit } from "@/lib/ops/audit.server";
import { requireAction } from "@/lib/ops/staff.server";
import { parseDxf, DxfError } from "./dxf";
import { pinsFromDxf } from "./pins";
import { MAX_DXF_CHARS, type CadDrawing, type CadDrawingKind, type CadDrawingMeta, type CadPin } from "./types";

type Row = {
  id: string;
  name: string;
  kind: string;
  he_thong: string;
  file_name: string;
  drive_url: string;
  dxf_text: string;
  entity_count: number;
  pins_json: string;
  actor_email: string;
  actor_role: string;
  created_at: string;
  updated_at: string;
};

function parsePins(raw: string): CadPin[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((p): p is CadPin => !!p && typeof p === "object" && typeof (p as CadPin).equipmentId === "string")
      .map((p) => ({
        equipmentId: String(p.equipmentId).trim().toUpperCase(),
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        label: p.label ? String(p.label) : undefined,
      }));
  } catch {
    return [];
  }
}

function toMeta(row: Row): CadDrawingMeta {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as CadDrawingKind,
    heThong: row.he_thong === "He_600" || row.he_thong === "He_220" ? row.he_thong : "CHUNG",
    fileName: row.file_name,
    driveUrl: row.drive_url,
    entityCount: Number(row.entity_count) || 0,
    pins: parsePins(row.pins_json),
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listCadDrawings(authUserId: string): Promise<CadDrawingMeta[]> {
  await requireAction(authUserId, "bave");
  const sql = await getSql();
  const rows = await sql<Omit<Row, "dxf_text">>`
    select id, name, kind, he_thong, file_name, drive_url, entity_count, pins_json,
           actor_email, actor_role, created_at, updated_at
    from cad_drawings
    order by updated_at desc
  `;
  return rows.map((r) => toMeta({ ...r, dxf_text: "" }));
}

export async function getCadDrawing(authUserId: string, id: string): Promise<CadDrawing | null> {
  await requireAction(authUserId, "bave");
  const sql = await getSql();
  const rows = await sql<Row>`
    select id, name, kind, he_thong, file_name, drive_url, dxf_text, entity_count, pins_json,
           actor_email, actor_role, created_at, updated_at
    from cad_drawings where id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return { ...toMeta(row), dxfText: row.dxf_text };
}

export async function saveCadDrawing(
  authUserId: string,
  input: {
    id?: string;
    name: string;
    kind: CadDrawingKind;
    heThong: "He_600" | "He_220" | "CHUNG";
    fileName: string;
    driveUrl: string;
    dxfText: string;
    pins: CadPin[];
  },
): Promise<CadDrawingMeta> {
  const staff = await requireAction(authUserId, "write_bave");
  const name = input.name.trim().slice(0, 160);
  if (!name) throw new Error("Cần tên bản vẽ.");
  const kind = input.kind;
  let dxfText = input.dxfText ?? "";
  let entityCount = 0;
  let pins = input.pins ?? [];

  if (kind === "DXF" || kind === "PLANT") {
    if (dxfText.length > MAX_DXF_CHARS) {
      throw new Error(`File DXF quá lớn (${Math.round(dxfText.length / 1024)} KB). Giới hạn ~1,8 MB — tách bản vẽ hoặc lưu DWG trên Drive rồi dán link.`);
    }
    if (dxfText.trim()) {
      try {
        const doc = parseDxf(dxfText);
        entityCount = doc.entities.length;
        const auto = pinsFromDxf(doc);
        if (!pins.length) pins = auto;
      } catch (err) {
        if (err instanceof DxfError) throw err;
        throw new Error(err instanceof Error ? err.message : "Không đọc được DXF.");
      }
    } else if (kind === "DXF") {
      throw new Error("Thiếu nội dung DXF.");
    }
  } else {
    dxfText = "";
    if (!input.driveUrl.trim()) throw new Error("Dán liên kết Drive của file DWG/DXF.");
  }

  const id = input.id?.trim() || uid("CAD");
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from cad_drawings where id = ${id}`;
  const pinsJson = JSON.stringify(pins);
  if (existing[0]) {
    await sql`
      update cad_drawings set
        name = ${name},
        kind = ${kind},
        he_thong = ${input.heThong},
        file_name = ${input.fileName.slice(0, 200)},
        drive_url = ${input.driveUrl.trim().slice(0, 800)},
        dxf_text = ${dxfText},
        entity_count = ${entityCount},
        pins_json = ${pinsJson},
        actor_email = ${staff.Email},
        actor_role = ${staff.Vai_tro},
        updated_at = now()
      where id = ${id}
    `;
  } else {
    await sql`
      insert into cad_drawings (
        id, name, kind, he_thong, file_name, drive_url, dxf_text, entity_count, pins_json, actor_email, actor_role
      ) values (
        ${id}, ${name}, ${kind}, ${input.heThong}, ${input.fileName.slice(0, 200)},
        ${input.driveUrl.trim().slice(0, 800)}, ${dxfText}, ${entityCount}, ${pinsJson},
        ${staff.Email}, ${staff.Vai_tro}
      )
    `;
  }
  try {
    await writeAudit({
      actorEmail: staff.Email,
      actorRole: staff.Vai_tro,
      action: existing[0] ? "SUA_BAN_VE_CAD" : "THEM_BAN_VE_CAD",
      entity: "cad",
      entityId: id,
      after: { name, kind, entityCount, pins: pins.length },
    });
  } catch {
    /* nhật ký số lỗi không chặn lưu bản vẽ */
  }
  const saved = await getCadDrawing(authUserId, id);
  if (!saved) throw new Error("Không đọc lại được bản vẽ vừa lưu.");
  return saved;
}

export async function saveCadPins(authUserId: string, id: string, pins: CadPin[]): Promise<CadDrawingMeta> {
  const staff = await requireAction(authUserId, "write_bave");
  const sql = await getSql();
  const found = await sql<{ id: string }>`select id from cad_drawings where id = ${id}`;
  if (!found[0]) throw new Error("Không tìm thấy bản vẽ.");
  const pinsJson = JSON.stringify(pins);
  await sql`
    update cad_drawings set pins_json = ${pinsJson}, actor_email = ${staff.Email},
      actor_role = ${staff.Vai_tro}, updated_at = now()
    where id = ${id}
  `;
  const saved = await getCadDrawing(authUserId, id);
  if (!saved) throw new Error("Không đọc lại được bản vẽ.");
  return saved;
}

export async function deleteCadDrawing(authUserId: string, id: string): Promise<void> {
  const staff = await requireAction(authUserId, "write_bave");
  const sql = await getSql();
  await sql`delete from cad_drawings where id = ${id}`;
  try {
    await writeAudit({
      actorEmail: staff.Email,
      actorRole: staff.Vai_tro,
      action: "XOA_BAN_VE_CAD",
      entity: "cad",
      entityId: id,
    });
  } catch {
    /* ignore */
  }
}
