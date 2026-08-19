import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { fmtDate, fmtNum } from "@/lib/format";
import type { Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/kpi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/baocao")({ component: BaoCao });

function BaoCao() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "QUAN_LY") as Role;
  const reports = useAppStore((s) => s.reports);
  const compileReport = useAppStore((s) => s.compileReport);
  const approveReport = useAppStore((s) => s.approveReport);
  const [from, setFrom] = useState("2026-08-01");
  const [to, setTo] = useState("2026-08-14");
  const [note, setNote] = useState("");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <p className="text-sm text-muted">
        Tổng hợp từ nhật ký, sự cố, hóa chất và cảnh báo trong khoảng ngày — không bịa số. Nghiệm thu thanh toán theo hợp
        đồng: 3 tháng/lần.
      </p>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3 shadow-panel">
        <div>
          <Label>Từ ngày</Label>
          <Input className="mt-1 w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>Đến ngày</Label>
          <Input className="mt-1 w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            if (from > to) {
              toast.error("Khoảng ngày không hợp lệ.");
              return;
            }
            compileReport(from, to, email);
            toast.success("Đã lập báo cáo.");
          }}
        >
          Lập báo cáo
        </Button>
      </div>

      {reports.length === 0 ? (
        <EmptyState title="Chưa có báo cáo" hint="Chọn khoảng ngày và lập báo cáo từ dữ liệu đang có." />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <article key={r.Report_ID} className="relative overflow-hidden rounded-lg border border-border bg-surface p-5 pl-6 shadow-panel">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-[3px]",
                  r.Trang_thai === "DA_DUYET" ? "bg-ok" : "bg-warn",
                )}
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-dim">{r.Report_ID}</div>
                  <h3 className="font-semibold">{r.Ten_bao_cao}</h3>
                  <p className="text-sm text-muted">
                    {fmtDate(r.Tu_ngay)} → {fmtDate(r.Den_ngay)} · {r.Nguoi_tao}
                  </p>
                </div>
                <Badge variant={r.Trang_thai === "DA_DUYET" ? "ok" : "warn"}>{r.Trang_thai}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">Nhật ký</dt>
                  <dd className="font-mono tabular-nums">
                    {r.Noi_dung.so_da_duyet}/{r.Noi_dung.so_nhat_ky}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">TB lưu lượng</dt>
                  <dd className="font-mono tabular-nums">{fmtNum(r.Noi_dung.tb_luu_luong)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">TB pH ra</dt>
                  <dd className="font-mono tabular-nums">{fmtNum(r.Noi_dung.tb_ph_out, 2)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">TB SV30</dt>
                  <dd className="font-mono tabular-nums">{fmtNum(r.Noi_dung.tb_sv30)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">TB Amoni</dt>
                  <dd className="font-mono tabular-nums">{fmtNum(r.Noi_dung.tb_amoni, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">TB COD</dt>
                  <dd className="font-mono tabular-nums">{fmtNum(r.Noi_dung.tb_cod, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Sự cố</dt>
                  <dd className="font-mono tabular-nums">{r.Noi_dung.so_su_co}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Cảnh báo</dt>
                  <dd className="font-mono tabular-nums">{r.Noi_dung.so_canh_bao}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Ca có bất thường</dt>
                  <dd className="font-mono tabular-nums">{r.Noi_dung.so_bat_thuong ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Việc chưa xong</dt>
                  <dd className="font-mono tabular-nums">{r.Noi_dung.so_chua_xu_ly ?? 0}</dd>
                </div>
              </dl>
              {can(role, "approve_baocao") && r.Trang_thai === "CHO_DUYET" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Textarea
                    className="min-h-16"
                    placeholder="Ghi chú duyệt"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      approveReport(r.Report_ID, "DUYET", note, email);
                      toast.success("Đã duyệt báo cáo.");
                    }}
                  >
                    Duyệt
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
