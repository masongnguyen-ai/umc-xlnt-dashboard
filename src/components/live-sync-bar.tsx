import { useEffect, useState } from "react";
import { getLiveSync, subscribeLiveSync, type LiveSyncState } from "@/lib/sync-sheet";
import { cn } from "@/lib/utils";

function fmtClock(ts: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtRemain(ms: number) {
  if (ms <= 0) return "đang lấy…";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function LiveSyncBar() {
  const [live, setLive] = useState<LiveSyncState>(getLiveSync);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const unsub = subscribeLiveSync(setLive);
    return () => {
      unsub();
    };
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remain = live.nextAt ? live.nextAt - now : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-dim">
      <span className="inline-flex items-center gap-1.5 font-sans font-medium text-ok">
        <span
          className={cn(
            "size-1.5 rounded-full bg-ok",
            live.running && "animate-pulse ring-2 ring-ok/40",
          )}
        />
        Tự cập nhật mỗi 10 phút
      </span>
      <span>Vừa nạp {fmtClock(live.lastCheck)}</span>
      <span className={cn(live.running && "text-accent")}>
        Lần sau {live.running ? "đang lấy…" : fmtRemain(remain)}
      </span>
      {live.error ? <span className="font-sans text-bad">{live.error}</span> : null}
    </div>
  );
}
