import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import type { ChemSnapshot, OpsBackup } from "./types";

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) return v;
  return new Date().toISOString();
}

export async function saveBackup(actorEmail: string, kind: string, snap: ChemSnapshot): Promise<string> {
  const sql = await getSql();
  const id = uid("BKP");
  await sql`
    insert into data_backups (id, actor_email, kind, payload_json)
    values (${id}, ${actorEmail}, ${kind}, ${JSON.stringify(snap)})
  `;
  const extra = await sql<{ id: string }>`
    select id from data_backups order by at desc offset 40
  `;
  for (const row of extra) {
    await sql`delete from data_backups where id = ${row.id}`;
  }
  return id;
}

export async function listBackups(limit = 20): Promise<OpsBackup[]> {
  const sql = await getSql();
  const cap = Math.min(Math.max(limit, 1), 40);
  const rows = await sql<{ id: string; at: unknown; actor_email: string; kind: string }>`
    select id, at, actor_email, kind from data_backups order by at desc limit ${cap}
  `;
  return rows.map((r) => ({
    id: r.id,
    at: iso(r.at),
    actorEmail: r.actor_email,
    kind: r.kind,
  }));
}

export async function loadBackupPayload(id: string): Promise<ChemSnapshot | null> {
  const sql = await getSql();
  const rows = await sql<{ payload_json: string }>`select payload_json from data_backups where id = ${id}`;
  const raw = rows[0]?.payload_json;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChemSnapshot;
  } catch {
    return null;
  }
}
