import { Database } from "lucide-react";
import { CSDL } from "@/lib/csdl";
import { FLOW_SHEET_META } from "@/lib/flow-data";
import { useAppStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";

export function SourceBanner({ compact = false }: { compact?: boolean }) {
  const lastSynced = useAppStore((s) => s.lastSynced);
  const sourceLabel = useAppStore((s) => s.sourceLabel);
  const days = useAppStore((s) => s.flowDays);

  if (compact) {
    return (
      <p className="text-[11px] text-dim">
        Nguồn: {sourceLabel || FLOW_SHEET_META.title}
      </p>
    );
  }

  const last = days[days.length - 1];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface2 text-accent">
        <Database className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{FLOW_SHEET_META.title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {days.length} ngày từ sheet công khai · {days[0]?.ngay} → {last?.ngay}. Số 24h đúng cột LL Nước thải / Hệ
          600 / Hệ 220. {CSDL.equipments} thiết bị và {CSDL.thresholds} ngưỡng vẫn theo CSDL v7.
        </p>
        <div className="mt-1 text-[11px] text-dim">
          Nạp {lastSynced ? fmtDateTime(lastSynced) : "—"}
        </div>
      </div>
    </div>
  );
}
