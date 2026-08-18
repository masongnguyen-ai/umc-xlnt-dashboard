import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import type { EqStatus, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MAINT_SCHEDULE } from "@/lib/csdl";
import { todayISO } from "@/lib/format";

export const Route = createFileRoute("/app/thietbi")({ component: ThietBi });

function ThietBi() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "QUAN_LY") as Role;
  const equipments = useAppStore((s) => s.equipments);
  const incidents = useAppStore((s) => s.incidents);
  const maintenances = useAppStore((s) => s.maintenances);
  const updateEquipment = useAppStore((s) => s.updateEquipment);
  const addIncident = useAppStore((s) => s.addIncident);
  const writable = can(role, "write_thietbi");

  const [sys, setSys] = useState<"all" | "He_600" | "He_220">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [eid, setEid] = useState("TB-220-18");
  const [desc, setDesc] = useState("");
  const [fix, setFix] = useState("");

  const list = useMemo(
    () =>
      equipments.filter((e) => {
        if (sys !== "all" && e.He_thong !== sys) return false;
        return `${e.Equipment_ID} ${e.Ten_thiet_bi} ${e.Hang_SX} ${e.Model}`.toLowerCase().includes(q.toLowerCase());
      }),
    [equipments, sys, q],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap gap-2 text-sm text-muted">
        <span>34 hạng mục · 16 hệ 600 + 18 hệ 220</span>
        <span className="text-dim">·</span>
        <span>{incidents.length} sự cố lịch sử</span>
        <span className="text-dim">·</span>
        <span>{maintenances.length} bảo trì T04/2026</span>
      </div>

      <Tabs defaultValue="ds">
        <TabsList>
          <TabsTrigger value="ds">Danh mục</TabsTrigger>
          <TabsTrigger value="sc">Sự cố</TabsTrigger>
          <TabsTrigger value="bt">Bảo trì</TabsTrigger>
          <TabsTrigger value="lich">Lịch E-HSMT</TabsTrigger>
        </TabsList>
        <TabsContent value="ds" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Tìm mã, tên, hãng…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={sys} onValueChange={(v) => setSys(v as typeof sys)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cả hai hệ</SelectItem>
                <SelectItem value="He_600">Hệ 600</SelectItem>
                <SelectItem value="He_220">Hệ 220</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {["Mã", "Tên", "Hệ", "Hãng / model", "SL", "Thông số", "TT"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.Equipment_ID} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-mono text-xs">{e.Equipment_ID}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{e.Ten_thiet_bi}</div>
                      {e.Ghi_chu ? <div className="text-[11px] text-dim">{e.Ghi_chu}</div> : null}
                    </td>
                    <td className="px-3 py-2">{e.He_thong === "He_600" ? "600" : "220"}</td>
                    <td className="px-3 py-2 text-muted">
                      {e.Hang_SX || "—"}
                      {e.Model ? <div className="font-mono text-[11px]">{e.Model}</div> : null}
                    </td>
                    <td className="px-3 py-2 font-mono">{e.So_luong}</td>
                    <td className="max-w-xs px-3 py-2 text-xs text-muted">{e.Thong_so}</td>
                    <td className="px-3 py-2">
                      {writable ? (
                        <Select
                          value={e.Tinh_trang}
                          onValueChange={(v) => updateEquipment(e.Equipment_ID, { Tinh_trang: v as EqStatus })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HOAT_DONG">Hoạt động</SelectItem>
                            <SelectItem value="BAO_TRI">Bảo trì</SelectItem>
                            <SelectItem value="HONG">Hỏng</SelectItem>
                            <SelectItem value="NGUNG">Ngừng</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={e.Tinh_trang === "HOAT_DONG" ? "ok" : "warn"}>{e.Tinh_trang}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="sc" className="space-y-3">
          {writable ? (
            <div className="flex justify-end">
              <Button onClick={() => setOpen(true)}>Ghi sự cố</Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {incidents.map((i) => {
              const eq = equipments.find((e) => e.Equipment_ID === i.Equipment_ID);
              return (
                <article key={i.Incident_ID} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-dim">{i.Incident_ID}</span>
                    <Badge variant={i.Trang_thai === "DA_XU_LY" ? "ok" : "warn"}>{i.Trang_thai}</Badge>
                    <span className="text-xs text-muted">{fmtDate(i.Ngay_phat_sinh)}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">
                    {eq?.Ten_thiet_bi} <span className="font-mono font-normal text-dim">{i.Equipment_ID}</span>
                  </h3>
                  <p className="mt-1 text-sm text-muted">{i.Mo_ta_su_co}</p>
                  <p className="mt-2 text-sm">Xử lý: {i.Bien_phap_xu_ly}</p>
                </article>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="bt" className="space-y-2">
          {maintenances.map((m) => (
            <article key={m.Maint_ID} className="rounded-xl border border-border bg-surface p-4">
              <div className="font-mono text-xs text-dim">{m.Maint_ID}</div>
              <h3 className="mt-1 text-sm font-semibold">{m.Noi_dung_bao_tri}</h3>
              <p className="mt-1 text-sm text-muted">
                {m.Equipment_ID} · vật tư: {m.Vat_tu_thay_the} · {m.Ket_qua}
              </p>
              <p className="mt-2 text-xs text-dim">{m.Ghi_chu}</p>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="lich">
          <p className="mb-3 text-sm text-muted">
            Tần suất chính thức E-HSMT — thay thế 7 nhóm mô tả chung ở v2.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {["Nhóm", "Hạng mục", "Tần suất"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MAINT_SCHEDULE.map((r) => (
                  <tr key={`${r.nhom}-${r.hang}`} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.nhom}</td>
                    <td className="px-3 py-2 text-muted">{r.hang}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.tan === "Tuần" ? "accent" : r.tan === "Tháng" ? "ok" : "default"}>{r.tan}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi sự cố</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Thiết bị</Label>
            <Select value={eid} onValueChange={setEid}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {equipments.map((e) => (
                  <SelectItem key={e.Equipment_ID} value={e.Equipment_ID}>
                    {e.Equipment_ID} · {e.Ten_thiet_bi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea className="mt-1" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <Label>Biện pháp</Label>
            <Textarea className="mt-1" value={fix} onChange={(e) => setFix(e.target.value)} />
          </div>
          <Button
            onClick={() => {
              if (!desc.trim()) {
                toast.error("Cần mô tả sự cố.");
                return;
              }
              addIncident({
                Equipment_ID: eid,
                Ngay_phat_sinh: todayISO(),
                Mo_ta_su_co: desc,
                Bien_phap_xu_ly: fix,
                Trang_thai: "MOI",
                Nguoi_khac_phuc: "",
                Ngay_hoan_thanh: "",
              });
              toast.success("Đã ghi sự cố.");
              setOpen(false);
              setDesc("");
              setFix("");
            }}
          >
            Lưu
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
