import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Lock = {
  release: () => Promise<void>;
  addEventListener: (type: "release", fn: () => void) => void;
};

export function KeepAwake({ className }: { className?: string }) {
  const [on, setOn] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setOk(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  useEffect(() => {
    if (!on || !ok) return;
    let lock: Lock | null = null;
    let stopped = false;

    async function acquire() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        lock = await (
          navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<Lock> } }
        ).wakeLock.request("screen");
        lock.addEventListener("release", () => {
          if (!stopped) void acquire();
        });
      } catch {
        setOn(false);
      }
    }

    void acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [on, ok]);

  if (!ok) return null;

  return (
    <Button size="sm" className={className} variant={on ? "default" : "secondary"} onClick={() => setOn((v) => !v)}>
      <Smartphone className="size-3.5" strokeWidth={1.75} />
      {on ? "Đang giữ màn hình" : "Giữ màn hình"}
    </Button>
  );
}
