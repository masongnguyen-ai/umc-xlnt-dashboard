import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Droplets, Scale, Waves } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { FLOW_SHEET_HTML } from "@/lib/flow-data";
import { fmtNum, todayISO } from "@/lib/format";
import { kpiClass, annotateFlow } from "@/lib/flow";
import { syncSheet } from "@/lib/sync-sheet";
import { Kpi } from "@/components/kpi";
import { WasteMasterCard } from "@/components/waste-master-card";
import { SourceBanner } from "@/components/source-banner";
import { HtmlFilesCard } from "@/components/html-files-card";
import { InstallApp } from "@/components/install-app";
import { KeepAwake } from "@/components/keep-awake";
import { LiveSyncBar } from "@/components/live-sync-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlowDay } from "@/lib/types";

export const Route = createFileRoute("/app/theodoi")({ component: TheoDoi });

type Range = "all" | "30" | "60" | "weekday" | "alert";

type TableRow = {
  iso: string;
  ngay: string;
  thu: string;
  llnt: number | null;
  ntday: number | null;
  lldem: number | null;
  ll600: number | null;
  he600day: number | null;
  ll220: number | null;
  he220day: number | null;
  llcap: number | null;
  capday: number | null;
  thatthoatB: number | null;
  chenh: number | null;
  cb: string;
  open?: boolean;
};

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

function avg(arr: FlowDay[], f: keyof FlowDay) {
  const v = arr.map((x) => x[f]).filter((n): n is number => typeof n === "number");
  if (!v.length) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}
function maxOf(arr: FlowDay[], f: keyof FlowDay) {
  const v = arr.map((x) => x[f]).filter((n): n is number => typeof n === "number");
  return v.length ? Math.max(...v) : null;
}
function minOf(arr: FlowDay[], f: keyof FlowDay) {
  const v = arr.map((x) => x[f]).filter((n): n is number => typeof n === "number" && n >= 0);
  return v.length ? Math.min(...v) : null;
}
function fmtMin(n: number | null, digits = 0) {
  return n == null ? undefined : fmtNum(n, digits);
}

function shortNgay(ngay: string) {
  const m = ngay.match(/^(\d{1,2})\/(\d{1,2})\//);
  if (!m) return ngay;
  return `${Number(m[1])}/${Number(m[2])}`;
}

function prevDays(days: FlowDay[], field: keyof FlowDay, digits = 0) {
  const prev = days.slice(-3, -1).reverse();
  if (!prev.length) return undefined;
  return prev
    .map((d) => {
      const n = d[field];
      return `${shortNgay(d.ngay)}: ${fmtNum(typeof n === "number" ? n : null, digits)} m³`;
    })
    .join("\n");
}

function prevDayItems(days: FlowDay[], field: keyof FlowDay, digits = 0) {
  return days.slice(-3, -1).reverse().map((d) => {
    const n = d[field];
    return { label: shortNgay(d.ngay), value: fmtNum(typeof n === "number" ? n : null, digits) };
  });
}

function minSigned(arr: FlowDay[], f: keyof FlowDay) {
  const v = arr.map((x) => x[f]).filter((n): n is number => typeof n === "number");
  return v.length ? Math.min(...v) : null;
}

const axis = { stroke: "#5c6773", fontSize: 11 };
const grid = { stroke: "#24303a" };

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-panel">
      <div className="mb-1 text-muted">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 tabular-nums">
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function TheoDoi() {
  const flowDays = useAppStore((s) => s.flowDays);
  const thresholds = useAppStore((s) => s.thresholds);
  const [range, setRange] = useState<Range>("30");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"trend" | "balance" | "daynight">("trend");

  async function refreshSheet() {
    setBusy(true);
    try {
      await syncSheet({ toast: "always" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đọc được sheet.");
    } finally {
      setBusy(false);
    }
  }

  const ntMax = thresholds.find((t) => t.Ma_nguong === "NT_NGAY_THUONG")?.Gia_tri_1 ?? 810;
  const ntWe = thresholds.find((t) => t.Ma_nguong === "NT_CUOI_TUAN")?.Gia_tri_1 ?? 650;
  const he600 = thresholds.find((t) => t.Ma_nguong === "HE600_MAX")?.Gia_tri_1 ?? 600;
  const he220 = thresholds.find((t) => t.Ma_nguong === "HE220_KHOANG");

  const recs = useMemo(() => {
    if (range === "30") return flowDays.slice(-30);
    if (range === "60") return flowDays.slice(-60);
    if (range === "weekday") return flowDays.filter((d) => d.thu !== "T7" && d.thu !== "CN");
    if (range === "alert") return flowDays.filter((d) => d.cb && d.cb !== "OK");
    return flowDays;
  }, [flowDays, range]);

  const last = flowDays.length
    ? annotateFlow([flowDays[flowDays.length - 1]], thresholds)[0]
    : undefined;
  const tableRows = useMemo<TableRow[]>(() => {
    const list: TableRow[] = [...recs].reverse().map((d) => ({ ...d }));
    const iso = todayISO();
    if (!list.some((d) => d.iso === iso) && range !== "alert") {
      const d = new Date(`${iso}T00:00:00`);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      list.unshift({
        iso,
        ngay: `${dd}/${mm}/${d.getFullYear()}`,
        thu: THU[d.getDay()],
        llnt: null,
        ntday: null,
        lldem: null,
        ll600: null,
        he600day: null,
        ll220: null,
        he220day: null,
        llcap: null,
        capday: null,
        thatthoatB: null,
        chenh: null,
        cb: "",
        open: true,
      });
    }
    return list;
  }, [recs, range]);
  const lastTone = last
    ? last.cb === "OK"
      ? "ok"
      : last.cb.includes("Vượt") || last.cb.includes("Hệ 600")
        ? "bad"
        : "warn"
    : "neutral";
  const ntLimit = last && (last.thu === "T7" || last.thu === "CN") ? ntWe : ntMax;
  const tone = (v: number | null | undefined, max: number) => {
    const c = kpiClass(v, max);
    return c === "warn" || c === "bad" ? c : "neutral";
  };
  const ntTone = (v: number | null | undefined, max: number) => {
    const c = kpiClass(v, max);
    return c === "warn" || c === "bad" ? c : "ok";
  };
  const alertDays = recs.filter((d) => d.cb && d.cb !== "OK").length;
  const leakTone =
    last && Math.abs(last.thatthoatB) > 5 ? "bad" : last ? "ok" : "neutral";
  const chenhTone = last && last.chenh > 140 ? "bad" : "neutral";

  const t30 = flowDays.slice(-30).map((d) => ({
    ...d,
    llnt: d.llnt < 0 ? 0 : d.llnt,
    llcap: d.llcap < 0 ? 0 : d.llcap,
    nguongNt: ntMax,
    nguongWe: ntWe,
  }));

  const chips: { id: Range; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "30", label: "30 ngày" },
    { id: "60", label: "60 ngày" },
    { id: "weekday", label: "T2–T6" },
    { id: "alert", label: "Cảnh báo" },
  ];
  const tabs = [
    { id: "trend" as const, label: "Xu hướng" },
    { id: "balance" as const, label: "Cân bằng nước" },
    { id: "daynight" as const, label: "Ngày–đêm" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-surface shadow-panel",
          lastTone === "ok" && "bg-ok/10",
          lastTone === "warn" && "bg-warn/10",
          lastTone === "bad" && "bg-bad/10",
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-[3px]",
            lastTone === "ok" && "bg-ok",
            lastTone === "warn" && "bg-warn",
            lastTone === "bad" && "bg-bad",
            lastTone === "neutral" && "bg-accent",
          )}
        />
        <div className="flex items-center gap-2 px-3 py-1.5 pl-4">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              lastTone === "ok" && "bg-ok",
              lastTone === "warn" && "bg-warn",
              lastTone === "bad" && "bg-bad",
              lastTone === "neutral" && "bg-muted",
            )}
          />
          <p className="min-w-0 flex-1 truncate text-[13px] leading-none">
            <span className="text-muted">Ngày gần nhất</span>
            <span className="font-semibold text-fg"> {last?.ngay?.slice(0, 5) ?? "–"}</span>
            <span className="text-muted"> · {last?.thu}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 items-stretch gap-2 px-3 pb-2">
          <div className="grid grid-rows-[auto_auto_auto] overflow-hidden rounded-lg bg-mint px-2.5 py-2">
            <div className="banner-title text-[11px] tracking-[0.12em]">Nước thải</div>
            <div
              className={cn(
                "banner-value mt-1 justify-start text-[1.45rem] leading-none",
                lastTone === "ok" && "text-ok",
                lastTone === "warn" && "text-warn",
                lastTone === "bad" && "text-bad",
              )}
            >
              {fmtNum(last?.llnt)} <span className="kpi-unit">m³</span>
            </div>
            <div className="mt-1 whitespace-nowrap text-[clamp(8px,2.4vw,11px)] leading-none tabular-nums tracking-tight text-muted">
              Hệ 600: {fmtNum(last?.ll600)} m³ · Hệ 220: {fmtNum(last?.ll220)} m³
            </div>
          </div>
          <div className="grid grid-rows-[auto_auto_auto] overflow-hidden rounded-lg bg-mint px-2.5 py-2">
            <div className="banner-title text-[11px] tracking-[0.12em]">Nước cấp</div>
            <div className="banner-value mt-1 justify-start text-[1.45rem] leading-none">
              {fmtNum(last?.llcap)} <span className="kpi-unit">m³</span>
            </div>
            <div className="mt-1 whitespace-nowrap text-[clamp(8px,2.4vw,11px)] leading-none tabular-nums tracking-tight text-muted">
              Khu A: {fmtNum(last?.llcapA)} m³ · Khu B: {fmtNum(last?.llcapB)} m³
            </div>
          </div>
        </div>
        <Link
          to="/app/canhbao"
          className={cn(
            "flex items-center border-t px-3 py-1.5 text-[12px] font-semibold leading-snug",
            last?.cb && last.cb !== "OK" ? "border-bad/20 text-bad" : "border-ok/20 text-ok",
          )}
        >
          {last?.cb === "OK" || !last?.cb ? "Không có cảnh báo lưu lượng." : `Cảnh báo: ${last.cb}`}
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-nowrap items-center gap-1 overflow-x-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <Button
              key={c.id}
              size="sm"
              className="h-9 min-h-9 shrink-0 px-2.5"
              variant={range === c.id ? "default" : "secondary"}
              onClick={() => setRange(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5 border-t border-border p-1.5">
          <KeepAwake className="h-11 min-h-11 w-full" />
          <Button
            size="sm"
            className="h-11 min-h-11 w-full"
            variant="secondary"
            aria-busy={busy}
            onClick={() => void refreshSheet()}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Đang lấy…
              </>
            ) : (
              "Làm mới"
            )}
          </Button>
        </div>
        <div className="hidden border-t border-border px-3 py-1 lg:block">
          <a href={FLOW_SHEET_HTML} target="_blank" rel="noreferrer" className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
            Mở sheet gốc
          </a>
        </div>
        <div className="border-t border-border px-3 py-1">
          <LiveSyncBar />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted lg:flex">
          <Droplets className="size-3.5 text-accent" strokeWidth={1.75} />
          Nước thải
        </h2>
        <WasteMasterCard
          className="lg:hidden"
          tag={last?.thu}
          total={fmtNum(last?.llnt)}
          day={fmtNum(last?.ntday)}
          night={fmtNum(last?.lldem)}
          totalHist={prevDayItems(flowDays, "llnt")}
          totalMax={fmtNum(maxOf(recs, "llnt"))}
          totalMin={fmtMin(minOf(recs, "llnt")) ?? "–"}
          totalAvg={fmtNum(avg(recs, "llnt"))}
          he600={fmtNum(last?.ll600)}
          he600Hist={prevDayItems(flowDays, "ll600")}
          he600Max={fmtNum(maxOf(recs, "ll600"))}
          he600Min={fmtMin(minOf(recs, "ll600")) ?? "–"}
          he600Avg={fmtNum(avg(recs, "ll600"))}
          he220={fmtNum(last?.ll220)}
          he220Hist={prevDayItems(flowDays, "ll220")}
          he220Max={fmtNum(maxOf(recs, "ll220"))}
          he220Min={fmtMin(minOf(recs, "ll220")) ?? "–"}
          he220Avg={fmtNum(avg(recs, "ll220"))}
        />
        <div className="hidden grid-cols-1 gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
          <Kpi
            className="lg:row-span-2 lg:h-full"
            size="hero"
            label="Nước thải 24h"
            value={fmtNum(last?.llnt)}
            unit="m³"
            tag={last?.thu}
            clock={{
              day: last?.ntday,
              night: last?.lldem,
            }}
            prev={prevDays(flowDays, "llnt")}
            tone={ntTone(last?.llnt, ntLimit)}
            max={fmtNum(maxOf(recs, "llnt"))}
            min={fmtMin(minOf(recs, "llnt"))}
            avg={fmtNum(avg(recs, "llnt"))}
          />
          <Kpi
            label="Hệ 600"
            value={fmtNum(last?.ll600)}
            unit="m³"
            tag={last?.thu}
            prev={prevDays(flowDays, "ll600")}
            tone={tone(last?.ll600, he600)}
            max={fmtNum(maxOf(recs, "ll600"))}
            min={fmtMin(minOf(recs, "ll600"))}
            avg={fmtNum(avg(recs, "ll600"))}
          />
          <Kpi
            label="Hệ 220"
            value={fmtNum(last?.ll220)}
            unit="m³"
            tag={last?.thu}
            tone={
              last && he220 && he220.Gia_tri_2 != null
                ? last.ll220 < he220.Gia_tri_1 || last.ll220 > he220.Gia_tri_2
                  ? "warn"
                  : "neutral"
                : "neutral"
            }
            prev={prevDays(flowDays, "ll220")}
            max={fmtNum(maxOf(recs, "ll220"))}
            min={fmtMin(minOf(recs, "ll220"))}
            avg={fmtNum(avg(recs, "ll220"))}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          <Waves className="size-3.5 text-info" strokeWidth={1.75} />
          Nước cấp
        </h2>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
          <Kpi
            className="lg:row-span-2 lg:h-full"
            size="hero"
            label="Nước cấp A+B"
            value={fmtNum(last?.llcap)}
            unit="m³"
            tag={last?.thu}
            clock={{
              day: last?.capday,
              night: last?.capdem,
            }}
            prev={prevDays(flowDays, "llcap")}
            tone="neutral"
            max={fmtNum(maxOf(recs, "llcap"))}
            min={fmtMin(minOf(recs, "llcap"))}
            avg={fmtNum(avg(recs, "llcap"))}
          />
          <Kpi
            label="Nước cấp A (24h)"
            value={fmtNum(last?.llcapA)}
            unit="m³"
            tag={last?.thu}
            prev={prevDays(flowDays, "llcapA")}
            tone="neutral"
            max={fmtNum(maxOf(recs, "llcapA"))}
            min={fmtMin(minOf(recs, "llcapA"))}
            avg={fmtNum(avg(recs, "llcapA"))}
          />
          <Kpi
            label="Nước cấp B (24h)"
            value={fmtNum(last?.llcapB)}
            unit="m³"
            tag={last?.thu}
            prev={prevDays(flowDays, "llcapB")}
            tone="neutral"
            max={fmtNum(maxOf(recs, "llcapB"))}
            min={fmtMin(minOf(recs, "llcapB"))}
            avg={fmtNum(avg(recs, "llcapB"))}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          <Scale className="size-3.5 text-warn" strokeWidth={1.75} />
          Chênh lệch và cảnh báo
          <span className={cn("normal-case tracking-normal", alertDays ? "text-bad" : "text-ok")}>
            · {alertDays}/{recs.length} ngày
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Kpi
            label="Chênh lệch cấp − thải"
            value={fmtNum(last?.chenh)}
            unit="m³"
            hint="Dưới 140 m³"
            prev={prevDays(flowDays, "chenh")}
            tone={chenhTone}
            max={fmtNum(maxOf(recs, "chenh"))}
            min={fmtNum(minSigned(recs, "chenh"))}
            avg={fmtNum(avg(recs, "chenh"))}
          />
          <Kpi
            label="Thất thoát Khu B"
            value={fmtNum(last?.thatthoatB, 1)}
            unit="m³"
            hint="±5 m³"
            prev={prevDays(flowDays, "thatthoatB", 1)}
            tone={leakTone}
            max={fmtNum(maxOf(recs, "thatthoatB"))}
            min={fmtNum(minSigned(recs, "thatthoatB"))}
            avg={fmtNum(avg(recs, "thatthoatB"))}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "min-h-10 px-3 text-sm font-semibold",
              tab === t.id ? "border-b-2 border-accent text-fg" : "text-muted",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trend" ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <h2 className="mb-3 text-sm font-semibold">Xu hướng 30 ngày</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={t30}>
                <CartesianGrid strokeDasharray="3 3" {...grid} />
                <XAxis dataKey="ngay" tick={axis} interval={4} />
                <YAxis tick={axis} domain={[0, "auto"]} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="llnt" name="Nước thải" stroke="#22e3c6" fill="#22e3c6" fillOpacity={0.12} />
                <Area type="monotone" dataKey="llcap" name="Nước cấp" stroke="#5ec4e8" fill="transparent" />
                <Line type="monotone" dataKey="nguongNt" name={`Ngưỡng ${ntMax}`} stroke="#f06a6a" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {tab === "balance" ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <h2 className="mb-3 text-sm font-semibold">Hệ 600 và hệ 220</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recs.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" {...grid} />
                <XAxis dataKey="ngay" tick={axis} interval={5} />
                <YAxis tick={axis} domain={[0, "auto"]} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="ll600" name="Hệ 600" stroke="#3ee09a" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="ll220" name="Hệ 220" stroke="#f0c14a" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {tab === "daynight" ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <h2 className="mb-3 text-sm font-semibold">Ban ngày và ban đêm</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recs.slice(-21)}>
                <CartesianGrid strokeDasharray="3 3" {...grid} />
                <XAxis dataKey="thu" tick={axis} />
                <YAxis tick={axis} domain={[0, "auto"]} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="ntday" name="Ban ngày" stackId="a" fill="#f0c14a" />
                <Bar dataKey="lldem" name="Ban đêm" stackId="a" fill="#6b7884" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Bảng cảnh báo và dữ liệu · {alertDays} cảnh báo
          </h2>
          <span className="text-xs tabular-nums text-muted">
            Max {fmtNum(maxOf(recs, "llnt"))} · Min {fmtNum(minOf(recs, "llnt"))} · TB {fmtNum(avg(recs, "llnt"))}
          </span>
        </div>
        <div className="tbl-wrap -mx-1 max-w-full overflow-x-auto overscroll-x-contain">
          <table className="data-table">
            <thead>
              <tr>
                <th className="grp" colSpan={2}>Thời gian</th>
                <th className="grp" colSpan={3}>Nước thải</th>
                <th className="grp" colSpan={2}>Hệ 600</th>
                <th className="grp" colSpan={2}>Hệ 220</th>
                <th className="grp" colSpan={2}>Nước cấp</th>
                <th className="grp" colSpan={3}>Phân tích</th>
              </tr>
              <tr>
                <th className="grp">Ngày</th>
                <th>Thứ</th>
                <th className="grp">24h</th>
                <th>Ngày</th>
                <th>Đêm</th>
                <th className="grp">24h</th>
                <th>Ngày</th>
                <th className="grp">24h</th>
                <th>Ngày</th>
                <th className="grp">24h</th>
                <th>Ngày</th>
                <th className="grp">Thất thoát B</th>
                <th>Chênh</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((d) => {
                const warn = Boolean(d.cb && d.cb !== "OK");
                const open = d.open;
                return (
                  <tr
                    key={d.iso}
                    className={cn(warn && "is-warn", open && "is-open")}
                  >
                    <td className="col-date">{d.ngay}</td>
                    <td className="col-dow">{d.thu}</td>
                    <td>{fmtNum(d.llnt)}</td>
                    <td>{fmtNum(d.ntday)}</td>
                    <td>{fmtNum(d.lldem)}</td>
                    <td>{fmtNum(d.ll600)}</td>
                    <td>{fmtNum(d.he600day)}</td>
                    <td>{fmtNum(d.ll220)}</td>
                    <td>{fmtNum(d.he220day)}</td>
                    <td>{fmtNum(d.llcap)}</td>
                    <td>{fmtNum(d.capday)}</td>
                    <td>{fmtNum(d.thatthoatB, 1)}</td>
                    <td>{fmtNum(d.chenh)}</td>
                    <td className="col-status">
                      {open ? (
                        <span className="text-xs text-dim">Đang ghi</span>
                      ) : (
                        <Badge variant={warn ? "warn" : "ok"}>{warn ? "Cảnh báo" : "OK"}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <InstallApp />
      <SourceBanner />
      <HtmlFilesCard />
    </div>
  );
}
