import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDateTime, fmtNum } from "@/lib/format";
import {
  CHEM_ITEMS,
  CHEM_PACK,
  dayToQty,
  daysCovered,
  findDose,
  liveChemStock,
  nextImport,
  splitOf,
  suggestRestock,
  type ChemDay,
  type ChemQtyKey,
} from "@/lib/chem-plan";
import type { ChemQty, Role } from "@/lib/types";
import { can } from "@/lib/permissions";
import { persistChemDose, persistChemRestock, persistChemRestockStatus } from "@/lib/ops/client";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function digits(k: ChemQtyKey) {
  return k === "micro" ? 1 : 0;
}

export function ChemDoseDesk({
  day,
  today,
  role,
  email,
}: {
  day: ChemDay;
  today: string;
  role: Role;
  email: string;
}) {
  const confirms = useAppStore((s) => s.chemConfirms) ?? [];
  const doses = useAppStore((s) => s.chemDoses) ?? [];
  const restocks = useAppStore((s) => s.chemRestocks) ?? [];
  const canDose = can(role, "write_chem_dose");
  const canOrder = can(role, "write_hoachat");

  const logged = findDose(doses, day.iso);
  const suggest = dayToQty(day);
  const [qty, setQty] = useState<ChemQty>(logged?.qty ?? suggest);
  const [note, setNote] = useState(logged?.note ?? "");

  useEffect(() => {
    const next = findDose(doses, day.iso);
    setQty(next?.qty ?? dayToQty(day));
    setNote(next?.note ?? "");
  }, [day.iso, doses]);

  const stock = useMemo(() => liveChemStock(confirms, doses, today), [confirms, doses, today]);
  const cover = daysCovered(stock, today);
  const order = useMemo(() => suggestRestock(stock, today), [stock, today]);
  const nhap = nextImport(today);
  const low = cover < 5;
  const pending = restocks.filter((r) => r.status === "MOI" || r.status === "DANG_DAT");
  const pastOrToday = day.iso <= today;

  const setKey = (k: ChemQtyKey, n: number) => setQty({ ...qty, [k]: n });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CHEM_ITEMS.map((c) => {
          const left = stock[c.key];
          const short = c.key === "micro" ? left < 1.5 : left < CHEM_PACK[c.key];
          return (
            <div key={c.key} className="rounded-xl border border-border bg-surface px-3 py-2">
              <div className="text-xs text-muted">{c.label}</div>
              <div className={cn("font-mono text-lg font-medium tabular-nums", short && "text-bad")}>
                {fmtNum(left, digits(c.key))}
                <span className="ml-1 text-xs font-normal text-muted">{c.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Tồn sau các lần châm đã ghi. Còn khoảng <strong className="text-fg">{cover} ngày</strong> theo gợi ý
        {nhap ? ` · nhập kế tiếp ${nhap.nhap}` : ""}.
      </p>

      {low ? (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">
          <div className="font-semibold text-bad">Tồn thấp — còn khoảng {cover} ngày</div>
          <p className="mt-1 text-muted">Gửi điều động theo quy cách bao/can để kịp trước ngày nhập kế tiếp.</p>
          {canDose || canOrder ? (
            <Button
              className="mt-2 min-h-11"
              onClick={() => {
                void persistChemRestock({
                  actor: email,
                  reason: `Tồn còn ~${cover} ngày tính ${today}`,
                  qty: order,
                }).then((r) => {
                  if (!r.ok) toast.error(r.error);
                  else toast.success("Đã gửi yêu cầu điều động.");
                });
              }}
            >
              Điều động hàng
            </Button>
          ) : null}
        </div>
      ) : null}

      {pending.length ? (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
          <div className="font-semibold text-warn">{pending.length} phiếu điều động chưa giao</div>
          <ul className="mt-2 space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {fmtDateTime(r.at)} · mật rỉ {fmtNum(r.qty.matri)} · NaOH {fmtNum(r.qty.naoh)} · Javen{" "}
                  {fmtNum(r.qty.javen)}
                </span>
                {canOrder ? (
                  <div className="flex gap-1">
                    {r.status === "MOI" ? (
                      <Button size="sm" variant="secondary" className="min-h-11" onClick={() => void persistChemRestockStatus(r.id, "DANG_DAT")}>
                        Đã đặt
                      </Button>
                    ) : null}
                    <Button size="sm" className="min-h-11" onClick={() => void persistChemRestockStatus(r.id, "DA_GIAO")}>
                      Đã giao
                    </Button>
                  </div>
                ) : (
                  <Badge variant="warn">{r.status === "MOI" ? "Chờ đặt" : "Đang đặt"}</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Liều gợi ý — chỉnh theo thực tế</h3>
          {logged ? <Badge variant="ok">Đã châm</Badge> : <Badge>Chưa ghi</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted">
          Số lớn là gợi ý. Sau khi pha xong, giữ nguyên hoặc sửa rồi ghi — tồn trừ đúng số thật.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHEM_ITEMS.map((c) => {
            const gợi = suggest[c.key];
            const split = splitOf(day, c.key);
            const diff = qty[c.key] - gợi;
            return (
              <article key={c.key} className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase tracking-wide text-muted">{c.label}</div>
                <div className="mt-0.5 text-xs text-dim">
                  Gợi ý {fmtNum(gợi, digits(c.key))} {c.unit}
                  {c.split && gợi > 0 ? ` · 600 ${fmtNum(split.a)} / 220 ${fmtNum(split.b)}` : ""}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    className="h-11 font-mono"
                    type="number"
                    min={0}
                    step={c.key === "micro" ? 0.1 : 1}
                    disabled={!canDose || !pastOrToday}
                    value={qty[c.key]}
                    onChange={(e) => setKey(c.key, Number(e.target.value))}
                  />
                  <span className="text-xs text-muted">{c.unit}</span>
                </div>
                {diff !== 0 ? (
                  <p className={cn("mt-1 text-xs", diff < 0 ? "text-warn" : "text-accent")}>
                    {diff > 0 ? "+" : ""}
                    {fmtNum(diff, digits(c.key))} so với gợi ý
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-dim">Khớp gợi ý</p>
                )}
              </article>
            );
          })}
        </div>
        {canDose && pastOrToday ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                setQty(suggest);
                setNote("Châm đúng gợi ý");
              }}
            >
              Điền đúng gợi ý
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              onClick={() => {
                void persistChemDose({ iso: day.iso, qty, actor: email, note }).then((r) => {
                  if (!r.ok) toast.error(r.error);
                  else toast.success("Đã ghi liều trên máy chủ. Tồn kho đã trừ.");
                });
              }}
            >
              Ghi liều đã châm
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-dim">
            {pastOrToday ? "Chỉ ca trực / nhà thầu / quản lý được ghi liều." : "Ngày tương lai — chỉ xem gợi ý."}
          </p>
        )}
        {logged ? (
          <p className="mt-2 text-xs text-muted">
            Lần ghi {fmtDateTime(logged.at)} · {logged.actor}
            {logged.note ? ` · ${logged.note}` : ""}
          </p>
        ) : null}
        <Label className="mt-3 block text-xs">Ghi chú pha</Label>
        <Input
          className="mt-1"
          disabled={!canDose || !pastOrToday}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Lệch gợi ý vì pH / lưu lượng…"
        />
      </div>
    </div>
  );
}
