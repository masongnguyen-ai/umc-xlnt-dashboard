import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Beaker,
  BookOpen,
  ClipboardList,
  Droplets,
  FileDown,
  Gauge,
  History,
  LayoutDashboard,
  Menu,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAppStore } from "@/lib/store";
import { can, NAV_ITEMS, type Action } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/format";
import type { Role } from "@/lib/types";
import { openAlerts7d, pendingChemCount, pendingLogs } from "@/lib/approval";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getTheme, toggleTheme } from "@/lib/theme";
import { useSheetSync } from "@/hooks/use-sheet-sync";
import { InstallApp } from "@/components/install-app";
import { hydrateOpsFromServer } from "@/lib/ops/client";

const ICONS: Record<string, typeof LayoutDashboard> = {
  "/app/theodoi": Activity,
  "/app/canhbao": AlertTriangle,
  "/app/nhatky": ClipboardList,
  "/app/nguong": SlidersHorizontal,
  "/app/hoachat": Beaker,
  "/app/thietbi": Wrench,
  "/app/baocao": BookOpen,
  "/app/ai": Sparkles,
  "/app/quantri": Settings2,
  "/app/nhatky-so": History,
  "/app/trienkhai": FileDown,
};

const TITLES: Record<string, string> = {
  "/app/theodoi": "Theo dõi lưu lượng",
  "/app/canhbao": "Cảnh báo",
  "/app/nhatky": "Nhật ký vận hành",
  "/app/nguong": "Ngưỡng",
  "/app/hoachat": "Hóa chất",
  "/app/thietbi": "Thiết bị",
  "/app/baocao": "Báo cáo",
  "/app/ai": "Trợ lý",
  "/app/quantri": "Quản trị",
  "/app/nhatky-so": "Nhật ký sửa số",
  "/app/trienkhai": "Triển khai thực tế",
};

function ShellClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const date = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return (
    <div className="font-mono text-[12px] tabular-nums tracking-tight">
      <span className="text-fg">{time}</span>
      <span className="ml-2 hidden text-dim sm:inline">{date}</span>
    </div>
  );
}

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const users = useAppStore((s) => s.users);
  const alerts = useAppStore((s) => s.alerts);
  const logs = useAppStore((s) => s.logs);
  const chemDoses = useAppStore((s) => s.chemDoses) ?? [];
  const chemConfirms = useAppStore((s) => s.chemConfirms) ?? [];
  const chemRestocks = useAppStore((s) => s.chemRestocks) ?? [];
  const staffBlocked = useAppStore((s) => s.staffBlocked);
  const opsReady = useAppStore((s) => s.opsReady);
  useSheetSync(ready);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useAppStore.persist.rehydrate();
      if (cancelled) return;
      setReady(true);
      setTheme(getTheme());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    void hydrateOpsFromServer()
      .then((me) => {
        if (me && !me.ok) {
          useAppStore.setState({ opsReady: true, staffBlocked: me.blocked });
        }
      })
      .catch((err) => {
        useAppStore.setState({
          opsReady: true,
          staffBlocked: err instanceof Error && err.message !== "Unauthorized" ? err.message : null,
        });
      });
  }, [ready, user]);

  const profile = useMemo(() => {
    if (!user?.primaryEmail) return null;
    return users.find((u) => u.Email.toLowerCase() === user.primaryEmail!.toLowerCase()) ?? null;
  }, [users, user]);

  if (isPending || !ready || (user && !opsReady && !staffBlocked)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  if (staffBlocked) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold">Chưa được cấp quyền</h1>
          <p className="mt-2 text-sm text-muted">{staffBlocked}</p>
          <Button className="mt-6" variant="secondary" onClick={() => void signOut()}>
            Đăng xuất
          </Button>
        </div>
      </main>
    );
  }

  if (profile && profile.Trang_thai !== "HOAT_DONG") {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold">Tài khoản không hoạt động</h1>
          <p className="mt-2 text-sm text-muted">
            {profile.Trang_thai === "TAM_KHOA"
              ? "Tài khoản đang tạm khóa. Liên hệ quản lý."
              : "Tài khoản đã ngừng trên hệ thống này."}
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => void signOut()}>
            Đăng xuất
          </Button>
        </div>
      </main>
    );
  }

  const role: Role = profile?.Vai_tro ?? "CA_TRUC";
  const alertOpen7d = openAlerts7d(alerts);
  const pendingNhatky = pendingLogs(logs).length;
  const pendingHoachat = pendingChemCount(chemDoses, chemConfirms, chemRestocks);

  const QUICK: { to: string; action: Action; label: string; badge?: number; badgeText?: string; warn?: boolean }[] = [
    { to: "/app/theodoi", action: "theodoi", label: "Theo dõi" },
    {
      to: "/app/canhbao",
      action: "canhbao",
      label: "Cảnh báo",
      badge: alertOpen7d,
      badgeText: alertOpen7d ? `${alertOpen7d} mở` : undefined,
      warn: true,
    },
    { to: "/app/nhatky", action: "nhatky", label: "Nhật ký", badge: pendingNhatky, badgeText: pendingNhatky ? `Chờ duyệt (${pendingNhatky})` : undefined, warn: true },
    { to: "/app/hoachat", action: "hoachat", label: "Hóa chất", badge: pendingHoachat, badgeText: pendingHoachat ? `Chờ duyệt (${pendingHoachat})` : undefined, warn: true },
  ];

  const nav = (
    <nav className="flex flex-1 flex-col gap-px px-2 py-2">
      <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-dim">
        Vận hành
      </p>
      {NAV_ITEMS.map((item) => {
        const allowed = can(role, item.action as Action);
        const Icon = ICONS[item.to] ?? Gauge;
        const active = pathname === item.to;
        if (!allowed) {
          return (
            <div
              key={item.to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-dim/50"
              title="Không có quyền"
            >
              <span className="icon-mint size-7 opacity-40">
                <Icon className="size-3.5" strokeWidth={1.75} />
              </span>
              <span className="flex-1">{item.label}</span>
            </div>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg py-1.5 pl-3 pr-2.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-mint text-fg before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
                : "text-muted hover:bg-mint/70 hover:text-fg",
            )}
          >
            <span className="icon-mint size-7">
              <Icon className="size-3.5" strokeWidth={1.75} />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.to === "/app/canhbao" && alertOpen7d > 0 ? (
              <span className="rounded bg-bad/15 px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums leading-none text-bad">
                {alertOpen7d} mở
              </span>
            ) : item.to === "/app/nhatky" && pendingNhatky > 0 ? (
              <span className="rounded bg-warn/20 px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums leading-none text-warn">
                Chờ duyệt ({pendingNhatky})
              </span>
            ) : item.to === "/app/hoachat" && pendingHoachat > 0 ? (
              <span className="rounded bg-warn/20 px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums leading-none text-warn">
                Chờ duyệt ({pendingHoachat})
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <aside className="flex h-full w-[248px] flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-3">
        <span className="icon-mint size-10">
          <Droplets className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight">UMC · XLNT</div>
          <div className="truncate text-[11px] text-muted">ĐH Y Dược TP.HCM</div>
        </div>
      </div>
      {nav}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="icon-mint size-8 text-xs font-medium">
              {(profile?.Ho_ten || user.displayName || "?").charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{profile?.Ho_ten || user.displayName}</div>
            <div className="truncate text-[11px] text-accent">{ROLE_LABEL[role]}</div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void signOut()}>
            Thoát
          </Button>
        </div>
      </div>
    </aside>
  );

  const allowedHere = NAV_ITEMS.find((i) => i.to === pathname);
  const locked = allowedHere ? !can(role, allowedHere.action) : false;

  return (
    <div className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-[248px_1fr]">
      <div className="hidden lg:block">{sidebar}</div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[248px] p-0">
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 shadow-panel">
          <Button variant="ghost" size="icon" className="size-9 min-h-9 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-4" />
            <span className="sr-only">Mở menu</span>
          </Button>
          <div className="min-w-0 truncate text-sm font-semibold tracking-tight">
            {TITLES[pathname] ?? "UMC"}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ShellClock />
            <div className="hidden items-center gap-2 text-[11px] text-muted sm:flex">
              <span className="size-1.5 rounded-full bg-ok" />
              Hệ 600 + 220
            </div>
            <InstallApp compact />
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setTheme(toggleTheme())}
            >
              {theme === "dark" ? "Nền sáng" : "Nền tối"}
            </Button>
          </div>
        </header>
        <div className="grid grid-cols-2 items-stretch gap-3 px-4 pt-4 lg:hidden">
          {QUICK.map((item) => {
            const allowed = can(role, item.action);
            const Icon = ICONS[item.to] ?? Gauge;
            const active = pathname === item.to;
            const badge = item.badge ?? 0;
            if (!allowed) {
              return (
                <div
                  key={item.to}
                  className="flex h-full min-h-[5.75rem] flex-col justify-between rounded-lg border border-border bg-surface p-3 opacity-40 shadow-panel"
                >
                  <span className="icon-mint size-10">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex h-full min-h-[5.75rem] flex-col justify-between rounded-lg border p-3 shadow-panel transition-colors",
                  active ? "border-accent bg-mint" : "border-border bg-surface hover:bg-mint/60",
                )}
              >
                <span className="icon-mint size-10">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                {badge > 0 && item.badgeText ? (
                  <span
                    className={cn(
                      "absolute right-2 top-2 max-w-[4.75rem] rounded px-1 py-0.5 text-center text-[9px] font-semibold leading-tight tabular-nums",
                      item.warn ? "bg-bad/15 text-bad" : "bg-accent/15 text-accent",
                    )}
                  >
                    {item.badgeText}
                  </span>
                ) : null}
                <span className="text-sm font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <main className="flex-1 px-4 py-5 sm:px-6">
          {locked ? (
            <div className="mx-auto max-w-md py-20 text-center">
              <h2 className="text-lg font-semibold">Không có quyền</h2>
              <p className="mt-2 text-sm text-muted">
                Vai trò {ROLE_LABEL[role]} không mở module này. Liên hệ quản lý nếu cần truy cập.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
