import { useEffect } from "react";
import {
  applySheetDays,
  hydrateFromSwCache,
  isIosClient,
  isSheetStale,
  SHEET_POLL_MS,
  syncSheet,
} from "@/lib/sync-sheet";
import type { FlowDay } from "@/lib/types";

function wakeEvents(): { target: EventTarget; type: string }[] {
  const list: { target: EventTarget; type: string }[] = [
    { target: document, type: "visibilitychange" },
    { target: window, type: "focus" },
    { target: window, type: "pageshow" },
    { target: window, type: "online" },
    { target: window, type: "resume" },
  ];
  if ("onfreeze" in document) list.push({ target: document, type: "resume" });
  return list;
}

export function useSheetSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer = 0;
    let worker: Worker | null = null;
    const ios = isIosClient();

    async function pull(mode: "change" | "never", force = false) {
      if (cancelled) return;
      try {
        await syncSheet({ toast: mode, force });
      } catch {
        /* giữ số đã có */
      }
    }

    function scheduleNext() {
      window.clearTimeout(timer);
      const due = SHEET_POLL_MS;
      timer = window.setTimeout(() => {
        void pull(document.visibilityState === "visible" ? "change" : "never");
        scheduleNext();
      }, due);
    }

    function onWake() {
      if (document.visibilityState === "hidden") return;
      void pull(isSheetStale() ? "change" : "never");
      scheduleNext();
      navigator.serviceWorker?.controller?.postMessage({ type: "wake" });
    }

    void (async () => {
      await hydrateFromSwCache();
      if (cancelled) return;
      await pull("never", true);
      scheduleNext();
    })();

    const events = wakeEvents();
    for (const e of events) e.target.addEventListener(e.type, onWake);

    const onMessage = (event: MessageEvent) => {
      if (cancelled) return;
      const data = event.data as { type?: string; days?: FlowDay[] };
      if (data?.type === "sheet-update" && data.days?.length) {
        applySheetDays(data.days);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    void (async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: "start-poll", interval: SHEET_POLL_MS, ios });
        if (ios && navigator.storage?.persist) await navigator.storage.persist();
        const periodic = (reg as ServiceWorkerRegistration & {
          periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
        }).periodicSync;
        if (!ios) await periodic?.register("umc-sheet", { minInterval: SHEET_POLL_MS });
      } catch {
        /* SW / persist không bắt buộc */
      }
    })();

    try {
      worker = new Worker("/poll-worker.js");
      worker.onmessage = () => {
        void pull(document.visibilityState === "visible" ? "change" : "never");
      };
    } catch {
      worker = null;
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      worker?.terminate();
      for (const e of events) e.target.removeEventListener(e.type, onWake);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [enabled]);
}
