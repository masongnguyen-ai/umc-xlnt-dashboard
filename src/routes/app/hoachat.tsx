import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { fmtDate, fmtNum } from "@/lib/format";
import type { ChemKind, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/format";
import { persistChemTx } from "@/lib/ops/client";
import { cn } from "@/lib/utils";
import { ChemSyncBar } from "@/components/chem-sync-bar";
import { ChemStockLedger } from "@/components/chem-stock-ledger";
import { ChemDoseDesk } from "@/components/chem-dose-desk";
import {
  CHEM_PLAN,
  findChemDay,
  findChemMonth,
  nearbyDays,
  nextImport,
  nextMaintenance,
  shiftIso,
  vnTodayISO,
} from "@/lib/chem-plan";

export const Route = createFileRoute("/app/hoachat")({ component: HoaChat });

function HoaChat() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "CA_TRUC") as Role;
  const chemicals = useAppStore((s) => s.chemicals);
  const stocks = useAppStore((s) => s.stocks);
  const transactions = useAppStore((s) => s.transactions);
  const writable = can(role, "write_hoachat");

  const [open, setOpen] = useState(false);
  const [ma, setMa] = useState("NAOH");
  const [kind, setKind] = useState<ChemKind>("XUAT");
  const [qty, setQty] = useState(10);
  const [lot, setLot] = useState("");
  const [note, setNote] = useState("");
  const [ngay, setNgay] = useState(todayISO());
  const today = vnTodayISO();
  const [lookup, setLookup] = useState(today);

  const day = findChemDay(lookup);
  const month = findChemMonth(lookup);
  const week = nearbyDays(lookup, 3);
  const nhap = nextImport(lookup);
  const baotri = nextMaintenance(lookup);
  const inContract = lookup >= CHEM_PLAN.contractFrom && lookup <= CHEM_PLAN.contractTo;

  const monthUsed = useMemo(() => {
    if (!month) return null;
    const from = month.from;
    const to = month.to;
    return CHEM_PLAN.days.filter((d) => d.iso >= from && d.iso <= to && d.iso <= today);
  }, [month, today]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ChemSyncBar />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Kế hoạch 18 tháng · 27/06/2026–26/12/2027. Liều ngày là gợi ý — ghi số thật sau khi châm để trừ tồn. Gần hết
            thì điều động hàng.
          </p>
        </div>
        {writable ? <Button onClick={() => setOpen(true)}>Giao dịch kho</Button> : null}
      </div>

      <Tabs defaultValue="tra-cuu">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger className="min-h-11" value="tra-cuu">
            Tra cứu ngày
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="thang">
            Theo tháng
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="lich">
            Lịch nhập
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="ton">
            Nhập xuất tồn
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="danhmuc">
            Danh mục
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tra-cuu" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-1.5">
            <Button
              variant="secondary"
              size="icon"
              className="size-11"
              onClick={() => setLookup(shiftIso(lookup, -1))}
              disabled={lookup <= CHEM_PLAN.contractFrom}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Ngày trước</span>
            </Button>
            <Input
              type="date"
              className="h-11 w-[11.5rem]"
              min={CHEM_PLAN.contractFrom}
              max={CHEM_PLAN.contractTo}
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
            />
            <Button
              variant="secondary"
              size="icon"
              className="size-11"
              onClick={() => setLookup(shiftIso(lookup, 1))}
              disabled={lookup >= CHEM_PLAN.contractTo}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Ngày sau</span>
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => setLookup(today)}>
              Hôm nay
            </Button>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {week.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => setLookup(d.iso)}
                className={cn(
                  "min-h-11 min-w-14 shrink-0 rounded-lg border px-2 py-1 text-center text-xs",
                  d.iso === lookup ? "border-accent bg-accent/15 text-fg" : "border-border bg-surface text-muted",
                  d.half && d.iso !== lookup && "border-warn/40 text-warn",
                )}
              >
                <div className="font-semibold tabular-nums">{d.iso.slice(8)}</div>
                <div>{d.thu.replace("Thứ ", "T").replace("Chủ nhật", "CN")}</div>
              </button>
            ))}
          </div>

          {!inContract || !day ? (
            <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
              Ngoài hợp đồng 27/06/2026–26/12/2027. Chọn ngày trong khoảng để xem liều.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">
                  {fmtDate(day.iso)} · {day.thu}
                </h2>
                {day.iso === today ? <Badge variant="accent">Hôm nay</Badge> : null}
                {day.half ? <Badge variant="warn">CN / lễ — nửa liều</Badge> : null}
                {month ? (
                  <Badge>
                    Tháng {month.stt}/18 · {fmtDate(month.from)}–{fmtDate(month.to)}
                  </Badge>
                ) : null}
              </div>

              <ChemDoseDesk day={day} today={today} role={role} email={email} />

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-xs uppercase tracking-wide text-dim">Nhập kho kế tiếp</div>
                  <div className="mt-1 font-medium">{nhap ? nhap.nhap : "Hết lịch"}</div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-xs uppercase tracking-wide text-dim">Bảo trì kế tiếp</div>
                  <div className="mt-1 font-medium">{baotri ? baotri.baotri : "Hết lịch"}</div>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="thang">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  {["Th", "Từ", "Đến", "Micro", "Mật rỉ", "NaOH", "NaHCO₃", "Javen"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHEM_PLAN.months.map((m) => {
                  const on = month?.stt === m.stt;
                  return (
                    <tr
                      key={m.stt}
                      className={cn("cursor-pointer border-t border-border hover:bg-surface2", on && "bg-accent/10")}
                      onClick={() => setLookup(m.from <= today && today <= m.to ? today : m.from)}
                    >
                      <td className="px-3 py-2 font-medium">{m.stt}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDate(m.from)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDate(m.to)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(m.micro, 1)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(m.matri)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(m.naoh)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(m.nahco3)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(m.javen)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border bg-surface2 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    Tổng 18 tháng
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(CHEM_PLAN.compare.used.micro, 1)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(CHEM_PLAN.compare.used.matri)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(CHEM_PLAN.compare.used.naoh)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(CHEM_PLAN.compare.used.nahco3)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{fmtNum(CHEM_PLAN.compare.used.javen)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {monthUsed && month ? (
            <p className="mt-2 text-xs text-dim">
              Tháng {month.stt}: đã qua {monthUsed.length} ngày tính đến hôm nay. Bấm một hàng để mở ngày đầu kỳ.
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  {["Đối chiếu", "Micro", "Mật rỉ", "NaOH", "NaHCO₃", "Javen"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Tổng sử dụng", CHEM_PLAN.compare.used],
                    ["Nhập thực tế", CHEM_PLAN.compare.actual],
                    ["Nhập HSMT tối thiểu", CHEM_PLAN.compare.hsmt],
                    ["Dư so với nhập thực tế", CHEM_PLAN.compare.duActual],
                    ["Dư so với HSMT", CHEM_PLAN.compare.duHsmt],
                  ] as const
                ).map(([label, q]) => (
                  <tr key={label} className="border-t border-border">
                    <td className="px-3 py-2">{label}</td>
                    <td className={cn("px-3 py-2 font-mono tabular-nums", q.micro < 0 && "text-bad")}>
                      {fmtNum(q.micro, 1)}
                    </td>
                    <td className={cn("px-3 py-2 font-mono tabular-nums", q.matri < 0 && "text-bad")}>
                      {fmtNum(q.matri)}
                    </td>
                    <td className={cn("px-3 py-2 font-mono tabular-nums", q.naoh < 0 && "text-bad")}>
                      {fmtNum(q.naoh)}
                    </td>
                    <td className={cn("px-3 py-2 font-mono tabular-nums", q.nahco3 < 0 && "text-bad")}>
                      {fmtNum(q.nahco3)}
                    </td>
                    <td className={cn("px-3 py-2 font-mono tabular-nums", q.javen < 0 && "text-bad")}>
                      {fmtNum(q.javen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="lich">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  {["Tháng", "Nhập hóa chất", "Bảo trì T5–CN", "Nghiệm thu / thanh toán"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHEM_PLAN.schedule.map((s) => {
                  const on = month && s.stt === month.stt;
                  return (
                    <tr key={s.stt} className={cn("border-t border-border hover:bg-surface2", on && "bg-accent/10")}>
                      <td className="px-3 py-2 font-medium">{s.thang}</td>
                      <td className="px-3 py-2">{s.nhap}</td>
                      <td className="px-3 py-2">{s.baotri}</td>
                      <td className="px-3 py-2 text-muted">{s.nghiemthu || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="ton">
          <ChemStockLedger lookup={lookup} today={today} role={role} email={email} />
        </TabsContent>

        <TabsContent value="danhmuc" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {chemicals.map((c) => {
              const ton = stocks[c.Ma_hoa_chat] ?? 0;
              const low = c.Nguong_canh_bao_ton != null && ton <= c.Nguong_canh_bao_ton;
              const empty = ton === 0;
              return (
                <article
                  key={c.Ma_hoa_chat}
                  className="relative overflow-hidden rounded-lg border border-border bg-surface p-4 pl-5 shadow-panel"
                >
                  <span className={cn("absolute inset-y-0 left-0 w-[3px]", empty || low ? "bg-bad" : "bg-accent")} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-mono text-dim">{c.Ma_hoa_chat}</div>
                      <h3 className="font-semibold">{c.Ten_hoa_chat}</h3>
                    </div>
                    {empty ? (
                      <Badge variant="default">Chưa nhập kho</Badge>
                    ) : low ? (
                      <Badge variant="warn" className="gap-1">
                        <TriangleAlert className="size-3" strokeWidth={2} />
                        Sắp hết
                      </Badge>
                    ) : (
                      <Badge variant="ok">Đủ</Badge>
                    )}
                  </div>
                  <div className={cn("mt-3 font-mono text-3xl font-medium tabular-nums tracking-tight", (empty || low) && "text-bad")}>
                    {fmtNum(ton, c.Don_vi_tinh === "gallon" ? 1 : 0)}
                    <span className="ml-1 text-sm font-normal text-muted">{c.Don_vi_tinh}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                    <dt>Định mức/tháng</dt>
                    <dd className="text-right font-mono tabular-nums text-fg">{fmtNum(c.Dinh_muc_thang_van_hanh)}</dd>
                    <dt>Hệ 600 / 220</dt>
                    <dd className="text-right font-mono tabular-nums text-fg">
                      {fmtNum(c.Dinh_muc_he600)} / {fmtNum(c.Dinh_muc_he220)}
                    </dd>
                    <dt>Hợp đồng 18 th.</dt>
                    <dd className="text-right font-mono tabular-nums text-fg">{fmtNum(c.Khoi_luong_hopdong_18thang)}</dd>
                  </dl>
                  <p className="mt-3 text-xs text-dim">{c.Ghi_chu}</p>
                </article>
              );
            })}
          </div>

          <section>
            <h2 className="mb-3 text-sm font-semibold">Giao dịch gần đây</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    {["Ngày", "Mã", "Loại", "SL", "Lô", "Người", "Ghi chú"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.Tx_ID} className="border-t border-border hover:bg-surface2">
                      <td className="px-3 py-2">{fmtDate(t.Ngay_thuc_hien)}</td>
                      <td className="px-3 py-2 font-mono">{t.Ma_hoa_chat}</td>
                      <td className="px-3 py-2">
                        <Badge variant={t.Loai_giao_dich === "NHAP" ? "ok" : "accent"}>{t.Loai_giao_dich}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">{t.So_luong}</td>
                      <td className="px-3 py-2 text-muted">{t.Lo_san_xuat || "—"}</td>
                      <td className="max-w-36 truncate px-3 py-2 text-muted">{t.Nguoi_tao}</td>
                      <td className="px-3 py-2 text-muted">{t.Ghi_chu}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  CSDL không seed giao dịch. Nhập kho lần đầu khi Đại Nam giao hàng.
                </p>
              ) : null}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Giao dịch hóa chất</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Hóa chất</Label>
              <Select value={ma} onValueChange={setMa}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chemicals.map((c) => (
                    <SelectItem key={c.Ma_hoa_chat} value={c.Ma_hoa_chat}>
                      {c.Ten_hoa_chat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Loại</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ChemKind)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NHAP">Nhập kho</SelectItem>
                  <SelectItem value="XUAT">Xuất dùng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Số lượng</Label>
              <Input className="mt-1" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              <p className="mt-1 text-[11px] text-dim">Tồn {fmtNum(stocks[ma] ?? 0)}</p>
            </div>
            <div>
              <Label>Ngày</Label>
              <Input className="mt-1" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Lô sản xuất</Label>
              <Input className="mt-1" value={lot} onChange={(e) => setLot(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Ghi chú</Label>
              <Textarea className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => {
              void persistChemTx({
                Ma_hoa_chat: ma,
                Loai_giao_dich: kind,
                So_luong: qty,
                Lo_san_xuat: lot,
                Han_su_dung: "",
                Ngay_thuc_hien: ngay,
                Ghi_chu: note,
                Nguoi_tao: email,
              }).then((r) => {
                if (!r.ok) toast.error(r.error);
                else {
                  toast.success("Đã ghi giao dịch trên máy chủ.");
                  setOpen(false);
                }
              });
            }}
          >
            Ghi sổ
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
