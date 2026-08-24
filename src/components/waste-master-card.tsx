import { cn } from "@/lib/utils";

export type HistPoint = { label: string; value: string };

function HistLine({ items, max, min, avg }: { items: HistPoint[]; max: string; min: string; avg: string }) {
  return (
    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-snug tabular-nums text-muted">
      {items.map((h, i) => (
        <span key={h.label}>
          {i > 0 ? <span className="text-dim">• </span> : null}
          {h.label}: {h.value} m³
        </span>
      ))}
      {items.length ? <span className="text-dim">•</span> : null}
      <span>
        (Max: {max} <span className="text-dim">|</span> Min: {min} <span className="text-dim">|</span> TB: {avg})
      </span>
    </p>
  );
}

function SystemCol({
  title,
  value,
  hist,
  max,
  min,
  avg,
  valueClass,
}: {
  title: string;
  value: string;
  hist: HistPoint[];
  max: string;
  min: string;
  avg: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0 leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{title}:</span>
        <span className={cn("text-lg font-bold tabular-nums", valueClass)}>{value}</span>
        <span className="text-[10px] font-medium text-muted">m³</span>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-1.5 text-[11px] leading-snug tabular-nums text-muted">
        {hist.map((h, i) => (
          <span key={h.label}>
            {i > 0 ? <span className="text-dim">| </span> : null}
            {h.label}: {h.value} m³
          </span>
        ))}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug tabular-nums text-muted">
        Max {max} <span className="text-dim">•</span> Min {min} <span className="text-dim">•</span> TB {avg}
      </p>
    </div>
  );
}

export function WasteMasterCard({
  tag,
  total,
  day,
  night,
  totalHist,
  totalMax,
  totalMin,
  totalAvg,
  he600,
  he600Hist,
  he600Max,
  he600Min,
  he600Avg,
  he220,
  he220Hist,
  he220Max,
  he220Min,
  he220Avg,
  className,
}: {
  tag?: string;
  total: string;
  day: string;
  night: string;
  totalHist: HistPoint[];
  totalMax: string;
  totalMin: string;
  totalAvg: string;
  he600: string;
  he600Hist: HistPoint[];
  he600Max: string;
  he600Min: string;
  he600Avg: string;
  he220: string;
  he220Hist: HistPoint[];
  he220Max: string;
  he220Min: string;
  he220Avg: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-surface p-3 shadow-panel",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Nước thải 24h</h3>
        <p className="min-w-0 text-xl font-bold leading-none tabular-nums text-ok">
          {total} <span className="text-sm font-semibold">m³</span>
          {tag ? <span className="text-xs font-semibold"> - {tag}</span> : null}
        </p>
      </div>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-xs tabular-nums text-fg">
        <span>
          <span aria-hidden>☀️</span> Ngày: {day} m³
        </span>
        <span className="text-dim">|</span>
        <span>
          <span aria-hidden>🌙</span> Đêm: {night} m³
        </span>
      </p>
      <HistLine items={totalHist} max={totalMax} min={totalMin} avg={totalAvg} />

      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2">
        <SystemCol
          title="Hệ 600"
          value={he600}
          hist={he600Hist}
          max={he600Max}
          min={he600Min}
          avg={he600Avg}
        />
        <SystemCol
          title="Hệ 220"
          value={he220}
          hist={he220Hist}
          max={he220Max}
          min={he220Min}
          avg={he220Avg}
          valueClass="text-warn"
        />
      </div>
    </article>
  );
}
