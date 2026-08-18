import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import type { Role } from "@/lib/types";
import type { AuditEvent } from "./types";

export async function writeAudit(input: {
  actorEmail: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<AuditEvent> {
  const sql = await getSql();
  const id = uid("AUD");
  const before = JSON.stringify(input.before ?? null);
  const after = JSON.stringify(input.after ?? null);
  const rows = await sql<{ id: string; at: string }>`
    insert into audit_events (
      id, actor_email, actor_role, action, entity, entity_id, before_json, after_json
    ) values (
      ${id}, ${input.actorEmail}, ${input.actorRole}, ${input.action},
      ${input.entity}, ${input.entityId}, ${before}, ${after}
    )
    returning id, at
  `;
  return {
    id: rows[0]?.id ?? id,
    at: String(rows[0]?.at ?? new Date().toISOString()),
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before,
    after,
  };
}

export async function listAudits(limit = 80): Promise<AuditEvent[]> {
  const sql = await getSql();
  const cap = Math.min(Math.max(limit, 1), 200);
  const rows = await sql<{
    id: string;
    at: string;
    actor_email: string;
    actor_role: Role;
    action: string;
    entity: string;
    entity_id: string;
    before_json: string;
    after_json: string;
  }>`
    select id, at, actor_email, actor_role, action, entity, entity_id, before_json, after_json
    from audit_events
    order by at desc
    limit ${cap}
  `;
  return rows.map((r) => ({
    id: r.id,
    at: String(r.at),
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    before: r.before_json,
    after: r.after_json,
  }));
}
