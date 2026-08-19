import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Lock, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import {
  CHEM_QTY_KEYS,
  ZERO_QTY,
  buildChemLedger,
  ledgerForMonth,
  sumReceipts,
  type ChemLedgerCycle,
  type ChemQtyKey,
} from "@/lib/chem-plan";
import type { ChemQty, ChemReceipt, Role } from "@/lib/types";
import { can } from "@/lib/permissions";
import { persistChemImport } from "@/lib/ops/client";
import { useAppStore } from "@/lib/store";
import { cn, uid } from "@/lib/utils";

const LABEL: Record<ChemQtyKey, string> = {
  micro: "Micro",
  matri: "Mật rỉ",
  naoh: "NaOH",
  nahco3: "NaHCO₃",
  javen: "Javen",
};

const UNIT: Record<ChemQtyKey, string> = {
  micro: "gal",
  matri: "kg",
  naoh: "kg",
  nahco3: "kg",
  javen: "kg",
};

function digits(k: ChemQtyKey) {
  return k === "micro" ? 1 : 0;
}

function emptyReceipt(ngay: string, qty: ChemQty): ChemReceipt {
  return { id: uid("NH"), ngay, qty: { ...qty } };
}

function QtyCells({ q, muted }: { q: ChemQty; muted?: boolean }) {
  return (
    <>
      {CHEM_QTY_KEYS.map((k) => (
        <td key={k} className={cn("px-3 py-2 font-mono tabular-nums", muted && "text-muted")}>
          {fmtNum(q[k], digits(k))}
        </td>
      ))}
    </>
  );
}

export function ChemStockLedger({
  lookup,
  today,
  role,
  email,
}: {
  lookup: string;
  today: string;
  role: Role;
  email: string;
}) {
  const confirms = useAppStore((s) => s.chemConfirms) ?? [];
  const doses = useAppStore((s) => s.chemDoses) ?? [];
  const writable = can(role, "write_hoachat");
  const isManager = role === "QUAN_LY";
  const ledger = useMemo(() => buildChemLedger(confirms, today, doses), [confirms, today, doses]);
  const current = ledgerForMonth(ledger, lookup) ?? ledger[0];
  const openCycles = ledger.filter((c) => c.status === "cho-chot" || c.status === "dang-nhap");

  const [edit, setEdit] = useState<ChemLedgerCycle | null>(null);
  const [receipts, setReceipts] = useState<ChemReceipt[]>([]);
  const [note, setNote] = useState("");
  const [confirmLock, setConfirmLock] = useState(false);

  const openEditor = (c: ChemLedgerCycle) => {
    setEdit(c);
    setConfirmLock(false);
    setReceipts(
      c.receipts.length
        ? c.receipts.map((r) => ({ ...r, qty: { ...r.qty } }))
        : [emptyReceipt(c.importIso || today, { ...c.plannedNhap })],
    );
    setNote(c.confirm?.note ?? "");
  };

  const total = sumReceipts(receipts);
  const locked = Boolean(edit?.confirm?.locked) || edit?.confirm?.status === "DA_CHOT";
  const pendingReview = edit?.confirm?.status === "CHO_DUYET";
  const canEdit = writable && !pendingReview && (!locked || isManager);

  const save = async (lock: boolean) => {
    if (!edit) return;
    const r = await persistChemImport({
      thang: edit.thang,
      receipts,
      actor: email,
      note,
      lock,
    });
    if (!r.ok) toast.error(r.error);
    else {
      toast.success(
        lock
          ? isManager
            ? "Đã chốt trên máy chủ. Kỳ sau chạy từ tổng nhập này."
            : "Đã gửi quản lý. Chưa vào tồn kho đến khi chốt."
          : "Đã lưu nháp. Chưa khóa kỳ.",
      );
      setEdit(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Số trên bảng là <strong className="font-medium text-fg">dự kiến</strong>. Xe có thể về 1 hoặc 2 ngày, số lệch
        kế hoạch. Ghi từng ngày → lưu nháp → chốt khi đủ hàng. Kỳ sau chỉ chạy từ số đã chốt.
      </p>

      {openCycles.length ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-3 pl-4 shadow-panel">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-warn" />
          <div className="flex items-start gap-2.5 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-warn">Chờ chốt — {openCycles.length} kỳ chưa khóa</div>
              <ul className="mt-2 space-y-1">
                {openCycles.map((c) => (
                  <li key={c.thang} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {c.thang} · KH {fmtDate(c.importIso)}
                      {c.receipts.length ? ` · đã ghi ${c.receipts.length} ngày` : ""}
                    </span>
                    {writable ? (
                      <Button className="min-h-11" size="sm" onClick={() => openEditor(c)}>
                        {c.receipts.length ? "Sửa nhập" : "Ghi nhận nhập"}
                      </Button>
                    ) : (
                      <Badge variant="warn" className="gap-1">
                        <Clock className="size-3" strokeWidth={2} />
                        Chờ nhà thầu
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {current ? (
        <article className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Kỳ đang xem · {current.thang}
            </h3>
            <StatusBadge c={current} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Kế hoạch nhập {fmtDate(current.importIso)} · Dùng {current.useRange}
          </p>
          {current.receipts.length ? (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {current.receipts.map((r) => (
                <li key={r.id}>
                  {fmtDate(r.ngay)} · mật rỉ {fmtNum(r.qty.matri)} · NaOH {fmtNum(r.qty.naoh)} · Javen{" "}
                  {fmtNum(r.qty.javen)} · NaHCO₃ {fmtNum(r.qty.nahco3)} · Micro {fmtNum(r.qty.micro, 1)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-dim">Chưa ghi ngày nhập thật — đang dùng số dự kiến.</p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Tồn đầu", current.open],
                ["Nhập", current.nhap],
                ["Sử dụng KH", current.use],
                ["Tồn cuối", current.close],
              ] as const
            ).map(([label, q]) => (
              <div key={label} className="relative overflow-hidden rounded-lg border border-border bg-bg px-3 py-2 pl-3.5">
                <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
                <dt className="kpi-label tracking-[0.12em]">{label}</dt>
                <dd className="mt-1 space-y-0.5 font-mono text-xs tabular-nums tracking-tight">
                  {CHEM_QTY_KEYS.map((k) => (
                    <div key={k}>
                      {LABEL[k]} {fmtNum(q[k], digits(k))}
                    </div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          {current.confirm ? (
            <p className="mt-3 text-xs text-muted">
              {current.confirm.locked ? "Chốt" : "Nháp"} {fmtDateTime(current.confirm.at)} · {current.confirm.actor}
              {current.confirm.note ? ` · ${current.confirm.note}` : ""}
            </p>
          ) : null}
          {writable ? (
            <Button
              className="mt-3 min-h-11"
              variant={current.status === "da-chot" ? "secondary" : "default"}
              onClick={() => openEditor(current)}
            >
              {current.status === "da-chot"
                ? isManager
                  ? "Sửa số đã chốt"
                  : "Xem phiếu nhập"
                : current.receipts.length
                  ? "Sửa ngày nhập"
                  : "Ghi nhận nhập"}
            </Button>
          ) : null}
        </article>
      ) : null}

      <div className="tbl-wrap max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
            <tr>
              {["Kỳ", "Nghiệp vụ", "Ngày", "Trạng thái", ...CHEM_QTY_KEYS.map((k) => LABEL[k])].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((c) => {
              const on = current?.thang === c.thang;
              const importRows =
                c.receipts.length > 0
                  ? c.receipts.map((r, i) => ({
                      loai: c.receipts.length > 1 ? `Nhập ${i + 1}` : "Nhập kho",
                      ngay: r.ngay,
                      q: r.qty,
                      muted: !c.confirm?.locked,
                    }))
                  : [{ loai: "Nhập KH", ngay: c.importIso, q: c.plannedNhap, muted: true }];
              const rows = [
                { loai: "Tồn đầu", ngay: "", q: c.open, muted: c.status !== "da-chot" },
                ...importRows,
                { loai: c.actualDays ? `Sử dụng (${c.actualDays} ngày thật)` : "Sử dụng KH", ngay: c.useRange, q: c.use, muted: !c.actualDays },
                { loai: "Tồn cuối", ngay: c.endIso, q: c.close, muted: c.status !== "da-chot" },
              ];
              return rows.map((r, i) => (
                <tr key={`${c.thang}-${r.loai}-${i}`} className={cn("border-t border-border hover:bg-surface2", on && "bg-accent/10")}>
                  <td className="px-3 py-2">{i === 0 ? c.thang : ""}</td>
                  <td className="px-3 py-2 font-medium">{r.loai}</td>
                  <td className="px-3 py-2 text-muted">
                    {r.ngay.includes("-") && r.ngay.length === 10 ? fmtDate(r.ngay) : r.ngay || "—"}
                  </td>
                  <td className="px-3 py-2">{i === 1 ? <StatusBadge c={c} /> : null}</td>
                  <QtyCells q={r.q} muted={r.muted} />
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={Boolean(edit)}
        onOpenChange={(o) => {
          if (!o) {
            setEdit(null);
            setConfirmLock(false);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nhập kho {edit?.thang}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted">
            Kế hoạch {edit ? fmtDate(edit.importIso) : ""}. Xe về ngày nào ghi ngày đó — tối đa 3 ngày.
          </p>
          {edit ? (
            <div className="space-y-3">
              {receipts.map((r, idx) => (
                <fieldset key={r.id} className="rounded-md border-0 bg-bg p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label>Ngày {idx + 1}</Label>
                    {canEdit && receipts.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => setReceipts(receipts.filter((x) => x.id !== r.id))}
                      >
                        <Trash2 className="size-4" />
                        Xóa ngày
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    type="date"
                    className="mb-3 h-11"
                    value={r.ngay}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setReceipts(receipts.map((x) => (x.id === r.id ? { ...x, ngay: e.target.value } : x)))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CHEM_QTY_KEYS.map((k) => (
                      <div key={k}>
                        <Label>
                          {LABEL[k]} ({UNIT[k]})
                        </Label>
                        <Input
                          className="mt-1 h-11"
                          type="number"
                          min={0}
                          step={k === "micro" ? 0.1 : 1}
                          disabled={!canEdit}
                          value={r.qty[k]}
                          onChange={(e) =>
                            setReceipts(
                              receipts.map((x) =>
                                x.id === r.id ? { ...x, qty: { ...x.qty, [k]: Number(e.target.value) } } : x,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}

              {canEdit && receipts.length < 3 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full"
                  onClick={() => setReceipts([...receipts, emptyReceipt(today, ZERO_QTY)])}
                >
                  <Plus className="size-4" />
                  Thêm ngày nhập
                </Button>
              ) : null}

              <div className="rounded-lg border border-border bg-bg p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-dim">Tổng so với kế hoạch</div>
                <ul className="mt-2 space-y-1 font-mono tabular-nums">
                  {CHEM_QTY_KEYS.map((k) => {
                    const d = total[k] - edit.plannedNhap[k];
                    return (
                      <li key={k} className="flex justify-between gap-2">
                        <span>
                          {LABEL[k]} {fmtNum(total[k], digits(k))} / {fmtNum(edit.plannedNhap[k], digits(k))}
                        </span>
                        <span className={d === 0 ? "text-muted" : d < 0 ? "text-warn" : "text-ok"}>
                          {d > 0 ? "+" : ""}
                          {fmtNum(d, digits(k))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <Label>Ghi chú biên bản</Label>
                <Textarea className="mt-1" disabled={!canEdit} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              {canEdit ? (
                confirmLock && isManager ? (
                  <div className="relative overflow-hidden rounded-lg border border-border bg-bg p-3 pl-4">
                    <span className="absolute inset-y-0 left-0 w-[3px] bg-bad" />
                    <p className="flex items-center gap-2 text-sm font-semibold text-bad">
                      <Lock className="size-4 shrink-0" strokeWidth={2} />
                      Xác nhận chốt kỳ {edit.thang}?
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Khóa số nhập. Kỳ sau chạy từ tổng này. Chỉ quản lý sửa lại được.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="destructive" className="min-h-11 flex-1" onClick={() => void save(true)}>
                        Xác nhận chốt
                      </Button>
                      <Button type="button" variant="secondary" className="min-h-11" onClick={() => setConfirmLock(false)}>
                        Quay lại
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="secondary" className="min-h-11 flex-1" onClick={() => void save(false)}>
                      Lưu nháp
                    </Button>
                    {isManager ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="min-h-11 flex-1"
                        onClick={() => setConfirmLock(true)}
                      >
                        Chốt kỳ này
                      </Button>
                    ) : (
                      <Button type="button" className="min-h-11 flex-1" onClick={() => void save(true)}>
                        Gửi quản lý
                      </Button>
                    )}
                  </div>
                )
              ) : (
                <p className="text-xs text-dim">Đã chốt. Chỉ quản lý được mở lại.</p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ c }: { c: ChemLedgerCycle }) {
  if (c.confirm?.status === "CHO_DUYET") {
    return (
      <Badge variant="warn" className="gap-1">
        <Clock className="size-3" strokeWidth={2} />
        Chờ duyệt
      </Badge>
    );
  }
  if (c.status === "da-chot") {
    return (
      <Badge variant="ok" className="gap-1">
        <Lock className="size-3" strokeWidth={2} />
        Đã chốt
      </Badge>
    );
  }
  if (c.status === "dang-nhap") return <Badge variant="accent">Đang nhập</Badge>;
  if (c.status === "cho-chot") {
    return (
      <Badge variant="warn" className="gap-1">
        <Clock className="size-3" strokeWidth={2} />
        Chờ chốt
      </Badge>
    );
  }
  return <Badge>Dự kiến</Badge>;
}
