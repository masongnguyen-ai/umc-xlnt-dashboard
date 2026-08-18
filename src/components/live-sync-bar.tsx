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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dim">
      <span className="inline-flex items-center gap-1.5 font-medium text-ok">
        <span className={cn("size-1.5 rounded-full bg-ok", live.running && "animate-pulse")} />
        Tự cập nhật mỗi 10 phút
      </span>
      <span>Vừa nạp {fmtClock(live.lastCheck)}</span>
      <span>Lần sau {live.running ? "đang lấy…" : fmtRemain(remain)}</span>
      {live.error ? <span className="text-bad">{live.error}</span> : null}
    </div>
  );
}
