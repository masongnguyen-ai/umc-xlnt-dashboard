import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ApprovalItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
};

export function ApprovalInbox({
  title,
  items,
  canReview,
  onReview,
}: {
  title: string;
  items: ApprovalItem[];
  canReview: boolean;
  onReview: (id: string, action: "CHOT" | "TRA_LAI", note: string) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length) return null;

  const run = async (id: string, action: "CHOT" | "TRA_LAI") => {
    setBusy(id);
    try {
      const r = await onReview(id, action, note);
      if (!r.ok) toast.error(r.error ?? "Không duyệt được.");
      else {
        toast.success(action === "CHOT" ? "Đã chốt." : "Đã trả lại.");
        setNote("");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-surface p-4 pl-5 shadow-panel">
      <span className="absolute inset-y-0 left-0 w-[3px] bg-warn" />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-warn">{title}</h3>
        <Badge variant="warn">Chờ duyệt ({items.length})</Badge>
      </div>
      {canReview ? (
        <Textarea
          className="mt-3"
          placeholder="Ghi chú chốt / trả lại"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : (
        <p className="mt-2 text-xs text-muted">Đã gửi quản lý. Số này chưa vào tồn kho / báo cáo.</p>
      )}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-md bg-bg px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-muted">{item.kind} · {item.detail}</div>
            </div>
            {canReview ? (
              <div className="flex gap-2">
                <Button className="min-h-11" disabled={busy === item.id} onClick={() => void run(item.id, "CHOT")}>
                  Chốt
                </Button>
                <Button
                  className="min-h-11"
                  variant="secondary"
                  disabled={busy === item.id}
                  onClick={() => void run(item.id, "TRA_LAI")}
                >
                  Trả lại
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
