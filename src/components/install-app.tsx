import { useEffect, useState } from "react";
import { Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallApp({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem("umc_hide_install") === "1") return;
    } catch {
      /* ignore */
    }
    setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  function dismiss() {
    setOpen(false);
    setHidden(true);
    try {
      localStorage.setItem("umc_hide_install", "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") dismiss();
      return;
    }
    setOpen(true);
  }

  const ios = isIos();

  if (compact) {
    return (
      <Button variant="secondary" size="sm" className="h-8 px-2 text-xs" onClick={() => void install()}>
        <Smartphone className="size-3.5" strokeWidth={1.75} />
        Cài app
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-surface p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-fg">
          <Smartphone className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Cài ra màn hình chính</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {ios
              ? "Mở trang này bằng Safari (không mở trong Zalo hay Grok), rồi bấm Chia sẻ → Thêm vào MH chính."
              : "Máy trực: Chrome → Cài đặt ứng dụng → ghim thanh tác vụ. Điện thoại: Cài ra màn hình."}
          </p>
          {open && ios ? (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted">
              <li>Góc dưới Safari: nút <Share className="inline size-3" /> Chia sẻ</li>
              <li>Kéo danh sách → Thêm vào MH chính</li>
              <li>Đặt tên UMC XLNT → Thêm</li>
            </ol>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void install()}>
              {deferred ? "Cài đặt" : ios ? "Xem hướng dẫn" : "Cài ra màn hình"}
            </Button>
            <Button size="sm" variant="secondary" onClick={dismiss}>
              Để sau
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
