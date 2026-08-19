import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { ROLE_LABEL, USER_STATUS_LABEL } from "@/lib/format";
import type { AppUserRecord, Role, UserStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSDL, CSDL_TABS, DESIGN_SPECS, GPMT_FLOW, PERF_2023, PLANT_HYDRAULICS } from "@/lib/csdl";
import { HtmlFilesCard } from "@/components/html-files-card";
import { persistStaff } from "@/lib/ops/client";
import { uid } from "@/lib/utils";

export const Route = createFileRoute("/app/quantri")({ component: QuanTri });

function QuanTri() {
  const users = useAppStore((s) => s.users);
  const configs = useAppStore((s) => s.configs);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const syncFromCsdl = useAppStore((s) => s.syncFromCsdl);
  const lastSynced = useAppStore((s) => s.lastSynced);
  const sourceLabel = useAppStore((s) => s.sourceLabel);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AppUserRecord | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Nhân sự</h2>
          <Button
            onClick={() => {
              setForm({
                User_ID: uid("USR"),
                Email: "",
                Ho_ten: "",
                So_dien_thoai: "",
                Don_vi: "Công ty Đại Nam",
                Ghi_chu: "",
                Vai_tro: "CA_TRUC",
                Trang_thai: "HOAT_DONG",
                Ngay_tao: new Date().toISOString().slice(0, 10),
              });
              setOpen(true);
            }}
          >
            Thêm tài khoản
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border shadow-panel">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {["Họ tên", "Email", "Đơn vị", "Vai trò", "Trạng thái", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.User_ID} className="border-t border-border hover:bg-surface2">
                  <td className="px-3 py-2.5 font-medium">{u.Ho_ten}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{u.Email}</td>
                  <td className="px-3 py-2.5 text-muted">{u.Don_vi}</td>
                  <td className="px-3 py-2.5">{ROLE_LABEL[u.Vai_tro]}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={u.Trang_thai === "HOAT_DONG" ? "ok" : "warn"}>
                      {USER_STATUS_LABEL[u.Trang_thai]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setForm({ ...u });
                        setOpen(true);
                      }}
                    >
                      Sửa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Cơ sở dữ liệu Drive</h2>
            <p className="mt-1 text-sm text-muted">{sourceLabel}</p>
            <p className="mt-1 text-xs text-dim">
              {CSDL.note} Lần nạp: {lastSynced ? lastSynced.slice(0, 16).replace("T", " ") : "—"}.
            </p>
          </div>
          <Button
            onClick={() => {
              syncFromCsdl();
              toast.success("Đã nạp lại snapshot CSDL v7.");
            }}
          >
            Nạp lại CSDL
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {["Tab", "Dòng", "Ghi chú"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CSDL_TABS.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{t.id}</td>
                  <td className="px-3 py-2">{t.rows}</td>
                  <td className="px-3 py-2 text-muted">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-panel">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Công trình · GPMT</h2>
        <p className="mt-1 text-sm text-muted">
          Bể điều hòa 600 = {PLANT_HYDRAULICS.eq600} m³, hệ 220 = {PLANT_HYDRAULICS.eq220} m³, lưu {PLANT_HYDRAULICS.retentionHours} giờ.
          Bơm trung chuyển 600→220 bật {PLANT_HYDRAULICS.transferOn}, tắt {PLANT_HYDRAULICS.transferOff}.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Xả thải 2022</dt>
            <dd>TB {GPMT_FLOW.y2022.avg} · max {GPMT_FLOW.y2022.max} m³/ngày</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Xả thải 2023</dt>
            <dd>TB {GPMT_FLOW.y2023.avg} · max {GPMT_FLOW.y2023.max} m³/ngày</dd>
          </div>
        </dl>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-1.5 text-left font-medium">Thiết kế</th>
                <th className="py-1.5 text-left font-medium">Hệ 600</th>
                <th className="py-1.5 text-left font-medium">Hệ 220</th>
              </tr>
            </thead>
            <tbody>
              {DESIGN_SPECS.map((r) => (
                <tr key={r.chi} className="border-t border-border">
                  <td className="py-1.5">{r.chi}</td>
                  <td className="py-1.5 font-mono text-xs">{r.he600}</td>
                  <td className="py-1.5 font-mono text-xs">{r.he220}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Hiệu suất quan trắc 2023</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {["Chỉ tiêu", "Vào", "Ra", "HS"].map((h) => (
                  <th key={h} className="py-1.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERF_2023.map((r) => (
                <tr key={r.chi} className="border-t border-border">
                  <td className="py-1.5">{r.chi}</td>
                  <td className="py-1.5 font-mono text-xs">{r.vao}</td>
                  <td className="py-1.5 font-mono text-xs">{r.ra}</td>
                  <td className="py-1.5 font-mono text-xs">{r.hs}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-panel">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Cấu hình nhà máy</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Tên hệ thống</dt>
            <dd>{configs.SYS_NAME}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Nhà thầu</dt>
            <dd>{configs.CONTRACTOR_NAME}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Công suất thiết kế</dt>
            <dd>{configs.DESIGN_CAPACITY} m³/ngày</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Quy chuẩn</dt>
            <dd>QCVN 28:2010 cột B, K=1</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-dim">
          Nhân sự nhà thầu: ≥1 vận hành 7h–18h kể cả lễ Tết; giám sát mặt sự cố trong 2 giờ. Thay vật liệu lọc cả 2 hệ
          trong 90 ngày đầu hợp đồng 2026–2027.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            resetDemo();
            toast.message("Đã khôi phục snapshot CSDL v7.");
          }}
        >
          Khôi phục snapshot CSDL
        </Button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {form ? (
            <>
              <DialogHeader>
                <DialogTitle>{users.some((u) => u.User_ID === form.User_ID) ? "Sửa tài khoản" : "Thêm tài khoản"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Họ tên</Label>
                  <Input className="mt-1" value={form.Ho_ten} onChange={(e) => setForm({ ...form, Ho_ten: e.target.value })} />
                </div>
                <div>
                  <Label>Email Google</Label>
                  <Input className="mt-1" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} />
                </div>
                <div>
                  <Label>Đơn vị</Label>
                  <Input className="mt-1" value={form.Don_vi} onChange={(e) => setForm({ ...form, Don_vi: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vai trò</Label>
                    <Select value={form.Vai_tro} onValueChange={(v) => setForm({ ...form, Vai_tro: v as Role })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QUAN_LY">Quản lý</SelectItem>
                        <SelectItem value="NHA_THAU">Nhà thầu</SelectItem>
                        <SelectItem value="CA_TRUC">Ca trực</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Trạng thái</Label>
                    <Select value={form.Trang_thai} onValueChange={(v) => setForm({ ...form, Trang_thai: v as UserStatus })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOAT_DONG">Hoạt động</SelectItem>
                        <SelectItem value="TAM_KHOA">Tạm khóa</SelectItem>
                        <SelectItem value="NGUNG">Ngừng</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => {
                  if (!form.Email.includes("@") || !form.Ho_ten.trim()) {
                    toast.error("Cần họ tên và email hợp lệ.");
                    return;
                  }
                  void persistStaff({ ...form, Email: form.Email.toLowerCase().trim() })
                    .then(() => {
                      toast.success("Đã lưu tài khoản trên máy chủ. Người này đăng nhập Google là vào đúng vai trò.");
                      setOpen(false);
                    })
                    .catch((err) => toast.error(err instanceof Error ? err.message : "Không lưu được tài khoản."));
                }}
              >
                Lưu
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <HtmlFilesCard />
    </div>
  );
}
