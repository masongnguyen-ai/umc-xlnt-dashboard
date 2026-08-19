import { cn } from "@/lib/utils";
import { DayNightClock } from "@/components/day-night-clock";

function PrevBlock({ prev }: { prev?: string }) {
  if (!prev) return null;
  return (
    <div className="kpi-prev mt-3 rounded-lg bg-mint px-2.5 py-2 opacity-80">
      {prev.split("\n").map((line) => (
        <div key={line} className="tabular-nums tracking-tight">
          {line}
        </div>
      ))}
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  tag,
  hint,
  prev,
  parts,
  clock,
  size = "md",
  tone = "neutral",
  max,
  min,
  avg,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  tag?: string;
  hint?: string;
  prev?: string;
  parts?: { label: string; value: string; unit?: string; note?: string }[];
  clock?: {
    day: number | null | undefined;
    night: number | null | undefined;
    dayNote?: string;
    nightNote?: string;
  };
  size?: "md" | "hero";
  tone?: "neutral" | "ok" | "warn" | "bad";
  max?: string;
  min?: string;
  avg?: string;
  className?: string;
}) {
  const valueTone =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-fg";

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-panel",
        size === "hero" ? "p-4 pl-5 sm:p-5 sm:pl-6" : "p-3 pl-4 sm:p-3.5 sm:pl-5",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          tone === "ok" && "bg-ok",
          tone === "warn" && "bg-warn",
          tone === "bad" && "bg-bad",
          tone === "neutral" && "bg-accent",
        )}
      />
      <div
        className={cn(
          "kpi-label tracking-[0.14em]",
          size === "hero" && "kpi-label--hero tracking-[0.16em]",
        )}
      >
        {label}
      </div>
      <div className="mt-2 min-w-0">
        <div
          className={cn(
            "kpi-value inline-flex w-full min-w-0 items-baseline gap-[0.2em]",
            size === "hero" && "kpi-value--hero text-[2.05rem] leading-none sm:text-[2.45rem]",
            valueTone,
          )}
        >
          {value}
          {unit ? <span className="kpi-unit">{unit}</span> : null}
          {tag ? <span className="kpi-tag">- {tag}</span> : null}
        </div>
        {hint ? <div className="kpi-hint mt-1">{hint}</div> : null}
      </div>
      {clock ? <DayNightClock day={clock.day} night={clock.night} prev={prev} /> : null}
      {!clock && parts?.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {parts.map((p) => (
            <div key={p.label} className="rounded-lg bg-mint px-2 py-1.5">
              <div className={cn(size === "hero" ? "kpi-label--part" : "kpi-label kpi-label--sm")}>{p.label}</div>
              <div className={cn("kpi-value kpi-value--sm mt-0.5", valueTone)}>
                {p.value}
                {p.unit ? <span className="kpi-unit">{p.unit}</span> : null}
              </div>
              {p.note ? <div className="kpi-prev mt-0.5">{p.note}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {!clock ? <PrevBlock prev={prev} /> : null}
      {max != null || min != null || avg != null ? (
        <div className="kpi-stat-row mt-auto border-t border-border pt-2">
          {max != null ? (
            <span>
              <span className="kpi-stat-label">Max</span>
              <span className="kpi-stat-num">{max}</span>
            </span>
          ) : null}
          {min != null ? (
            <span>
              <span className="kpi-stat-label">Min</span>
              <span className="kpi-stat-num">{min}</span>
            </span>
          ) : null}
          {avg != null ? (
            <span>
              <span className="kpi-stat-label">TB</span>
              <span className="kpi-stat-num">{avg}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{hint}</p>
    </div>
  );
}
