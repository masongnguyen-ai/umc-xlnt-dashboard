import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { listAuditsFn, restoreBackupFn, getOpsStateFn, getOpsLedgerFn } from "@/lib/ops/fns";
import { errMessage } from "@/lib/ops/client";
import type { AuditEvent, OpsBackup, SheetAuditRow } from "@/lib/ops/types";
import { can } from "@/lib/permissions";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/app/nhatky-so")({ component: NhatKySo });

function NhatKySo() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "CA_TRUC") as Role;
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [backups, setBackups] = useState<OpsBackup[]>([]);
  const [sheetAudit, setSheetAudit] = useState<SheetAuditRow[]>([]);
  const canRestore = can(role, "write_backup");

  useEffect(() => {
    void listAuditsFn()
      .then(setAudits)
      .catch((err) => toast.error(errMessage(err)));
    void getOpsLedgerFn()
      .then((l) => setSheetAudit(l.audit))
      .catch((err) => toast.error(errMessage(err)));
    void getOpsStateFn()
      .then((s) => setBackups(s.backups))
      .catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        <h2 className="text-sm font-semibold">Ghi Sheet vận hành</h2>
        <p className="mt-1 text-sm text-muted">
          Mỗi module đọc/ghi tab trên não chính. Sheet lưu lượng chỉ đọc, không ghi đè. Chốt = quản lý duyệt.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {["Module", "Tab", "Đã ghi Sheet?", "Đã duyệt?"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetAudit.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted" colSpan={4}>
                    Chưa đọc được bảng audit Sheet.
                  </td>
                </tr>
              ) : (
                sheetAudit.map((a) => (
                  <tr key={a.tab} className="border-t border-border">
                    <td className="px-3 py-2">{a.module}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.tab}</td>
                    <td className="px-3 py-2">
                      {a.error ? (
                        <Badge variant="bad">Lỗi</Badge>
                      ) : a.wrote ? (
                        <Badge variant="ok">Có</Badge>
                      ) : (
                        <Badge>Chưa</Badge>
                      )}
                      {a.error ? <span className="ml-2 text-xs text-bad">{a.error}</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      {a.tab === "LOGIN_LOG" || a.tab === "BAO_TRI_TB"
                        ? "—"
                        : a.pending > 0
                          ? `Chờ ${a.pending}`
                          : a.chot > 0
                            ? `Đã chốt (${a.chot})`
                            : "Chưa có phiếu"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Ai sửa số</h2>
        <p className="mt-1 text-sm text-muted">
          Mỗi lần ghi tồn, liều đã châm hoặc chốt nhập đều lưu người, giờ, số cũ và số mới trên máy chủ.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {["Thời điểm", "Người", "Vai trò", "Hành động", "Đối tượng", "Số"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted" colSpan={6}>
                    Chưa có lần sửa số trên máy chủ.
                  </td>
                </tr>
              ) : (
                audits.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{fmtDateTime(a.at)}</td>
                    <td className="px-3 py-2">{a.actorEmail}</td>
                    <td className="px-3 py-2">
                      <Badge>{a.actorRole}</Badge>
                    </td>
                    <td className="px-3 py-2 font-medium">{a.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {a.entity} · {a.entityId}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted">
                      {summarize(a.before)} → {summarize(a.after)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Bản sao lưu tự động</h2>
        <p className="mt-1 text-sm text-muted">Mỗi lần ghi số, máy chủ giữ một bản JSON (tối đa 40). Chỉ quản lý khôi phục.</p>
        <ul className="mt-3 space-y-2">
          {backups.length === 0 ? <li className="text-sm text-muted">Chưa có bản sao lưu.</li> : null}
          {backups.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span>
                <span className="font-mono text-xs">{fmtDateTime(b.at)}</span>
                <span className="mx-2 text-dim">·</span>
                {b.kind}
                <span className="mx-2 text-dim">·</span>
                {b.actorEmail}
              </span>
              {canRestore ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => {
                    if (!confirm("Khôi phục bản này sẽ thay số hóa chất hiện tại. Tiếp tục?")) return;
                    void restoreBackupFn({ data: b.id }).then((r) => {
                      if (!r.ok) toast.error(r.error);
                      else {
                        toast.success("Đã khôi phục. Tải lại trang Hóa chất để xem số.");
                        void getOpsStateFn().then((s) => {
                          setBackups(s.backups);
                          useAppStore.getState().hydrateOps({
                            chemConfirms: s.confirms,
                            chemDoses: s.doses,
                            chemRestocks: s.restocks,
                            transactions: s.transactions,
                            stocks: s.stocks,
                            sheetSync: s.sheet,
                          });
                        });
                      }
                    });
                  }}
                >
                  Khôi phục
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function summarize(v: string) {
  if (!v || v === "null") return "—";
  try {
    const parsed = JSON.parse(v) as Record<string, unknown>;
    if (parsed.qty && typeof parsed.qty === "object" && parsed.qty) {
      const q = parsed.qty as Record<string, number>;
      return `mật ${q.matri ?? "?"} · NaOH ${q.naoh ?? "?"}`;
    }
    if ("naoh" in parsed) return `NaOH ${parsed.naoh}`;
    if ("ton" in parsed) return `tồn ${parsed.ton}`;
    if ("locked" in parsed) return parsed.locked ? "đã chốt" : "nháp";
    return Object.keys(parsed).slice(0, 3).join(", ");
  } catch {
    return v.slice(0, 40);
  }
}
