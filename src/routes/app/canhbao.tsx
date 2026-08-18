import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { ALERT_STATUS_LABEL, fmtDate, fmtDateTime } from "@/lib/format";
import type { AlertStatus, Role } from "@/lib/types";
import { Kpi } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/kpi";

export const Route = createFileRoute("/app/canhbao")({ component: CanhBao });

const SEV: Record<string, "ok" | "warn" | "bad" | "accent" | "legal"> = {
  CRITICAL: "bad",
  HIGH: "warn",
  WARNING: "accent",
  NHAC_NHO: "warn",
  LOI: "legal",
  DATA_ERROR: "bad",
};

function CanhBao() {
  const user = useCurrentUser();
  const users = useAppStore((s) => s.users);
  const profile = users.find((u) => u.Email.toLowerCase() === (user?.primaryEmail ?? "").toLowerCase());
  const role = (profile?.Vai_tro ?? "QUAN_LY") as Role;
  const alerts = useAppStore((s) => s.alerts);
  const histories = useAppStore((s) => s.alertHistories);
  const scanAlerts = useAppStore((s) => s.scanAlerts);
  const updateAlert = useAppStore((s) => s.updateAlert);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState<AlertStatus>("DA_XEM");

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (from && a.Ngay < from) return false;
      if (to && a.Ngay > to) return false;
      if (status !== "all" && a.Trang_thai !== status) return false;
      if (q && !`${a.Chi_so} ${a.Loai_canh_bao} ${a.Noi_dung}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [alerts, from, to, status, q]);

  const active = alerts.find((a) => a.Alert_ID === openId);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Mới" value={String(alerts.filter((a) => a.Trang_thai === "MOI").length)} />
        <Kpi
          label="Chưa xử lý"
          value={String(alerts.filter((a) => a.Trang_thai === "MOI" || a.Trang_thai === "DA_XEM").length)}
          tone="warn"
        />
        <Kpi
          label="Đang xử lý"
          value={String(alerts.filter((a) => a.Trang_thai === "DANG_XU_LY").length)}
        />
        <Kpi label="Đã khắc phục" value={String(alerts.filter((a) => a.Trang_thai === "DA_XU_LY").length)} tone="ok" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label>Từ ngày</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
        </div>
        <div>
          <Label>Đến ngày</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
        </div>
        <div className="w-44">
          <Label>Trạng thái</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {(Object.keys(ALERT_STATUS_LABEL) as AlertStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {ALERT_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-40 flex-1">
          <Label>Tìm chỉ số</Label>
          <Input className="mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="pH, thất thoát…" />
        </div>
        <Button
          onClick={() => {
            const n = scanAlerts();
            toast.success(n ? `Sinh thêm ${n} cảnh báo mới.` : "Không có cảnh báo mới so với ngưỡng hiện tại.");
          }}
        >
          Quét lại
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Không có cảnh báo khớp bộ lọc" hint="Đổi khoảng ngày hoặc bấm Quét lại sau khi sửa ngưỡng." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {["Ngày", "Chỉ số", "Giá trị / ngưỡng", "Mức", "Trạng thái", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.Alert_ID} className="border-t border-border hover:bg-surface2/40">
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(a.Ngay)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{a.Chi_so}</div>
                    <div className="font-mono text-[11px] text-dim">{a.Loai_canh_bao}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">
                    {a.Gia_tri} <span className="text-dim">/ {a.Nguong}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={SEV[a.Muc_do] ?? "default"}>{a.Muc_do}</Badge>
                  </td>
                  <td className="px-3 py-2.5">{ALERT_STATUS_LABEL[a.Trang_thai]}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setOpenId(a.Alert_ID);
                        setNote(a.Ghi_chu_xu_ly);
                        setNextStatus(a.Trang_thai === "MOI" ? "DA_XEM" : a.Trang_thai);
                      }}
                    >
                      Xem
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>{active.Chi_so}</DialogTitle>
                <p className="font-mono text-xs text-dim">{active.Alert_ID}</p>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted">Ngày</div>
                  {fmtDate(active.Ngay)}
                </div>
                <div>
                  <div className="text-xs text-muted">Mức</div>
                  <Badge variant={SEV[active.Muc_do] ?? "default"}>{active.Muc_do}</Badge>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted">Nội dung</div>
                  {active.Noi_dung}
                </div>
              </div>
              {can(role, "update_alert") ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <Label>Trạng thái mới</Label>
                    <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as AlertStatus)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ALERT_STATUS_LABEL) as AlertStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {ALERT_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ghi chú xử lý</Label>
                    <Textarea className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <Button
                    onClick={() => {
                      const r = updateAlert(active.Alert_ID, nextStatus, note, user?.primaryEmail ?? "");
                      if (!r.ok) toast.error(r.error);
                      else {
                        toast.success("Đã cập nhật cảnh báo.");
                        setOpenId(null);
                      }
                    }}
                  >
                    Lưu
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted">Ca trực chỉ xem, không đổi trạng thái.</p>
              )}
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Lịch sử</div>
                {histories.filter((h) => h.Alert_ID === active.Alert_ID).length === 0 ? (
                  <p className="text-sm text-dim">Chưa có thao tác.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {histories
                      .filter((h) => h.Alert_ID === active.Alert_ID)
                      .map((h) => (
                        <li key={h.History_ID} className="rounded-md border border-border bg-surface2 px-3 py-2">
                          <div className="text-xs text-muted">{fmtDateTime(h.Thoi_gian)}</div>
                          {ALERT_STATUS_LABEL[h.Trang_thai_cu]} → {ALERT_STATUS_LABEL[h.Trang_thai_moi]}
                          <div className="text-xs text-dim">{h.Nguoi_thuc_hien}</div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
