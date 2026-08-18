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

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const users = useAppStore((s) => s.users);
  const alerts = useAppStore((s) => s.alerts);
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
  const openAlerts = alerts.filter((a) => a.Trang_thai === "MOI" || a.Trang_thai === "DA_XEM").length;

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
      <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
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
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-dim/50"
              title="Không có quyền"
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
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
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
              active ? "bg-surface2 text-fg" : "text-muted hover:bg-surface2/70 hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="flex-1">{item.label}</span>
            {item.to === "/app/canhbao" && openAlerts > 0 ? (
              <span className="rounded-full bg-bad/15 px-1.5 text-[10px] font-medium tabular-nums text-bad">
                {openAlerts}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <aside className="flex h-full w-[248px] flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-fg">
          <Droplets className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">UMC · XLNT</div>
          <div className="truncate text-[11px] text-muted">ĐH Y Dược TP.HCM</div>
        </div>
      </div>
      {nav}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="size-8 rounded-md object-cover" />
          ) : (
            <span className="grid size-8 place-items-center rounded-md bg-surface2 text-xs font-medium">
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
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-4" />
            <span className="sr-only">Mở menu</span>
          </Button>
          <div className="min-w-0 truncate text-sm font-semibold">
            {TITLES[pathname] ?? "UMC"}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <InstallApp compact />
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-3 text-xs"
              onClick={() => setTheme(toggleTheme())}
            >
              {theme === "dark" ? "Nền sáng" : "Nền tối"}
            </Button>
            <div className="hidden items-center gap-2 text-xs text-muted sm:flex">
              <span className="size-1.5 rounded-full bg-ok" />
              Hệ 600 + 220
            </div>
          </div>
        </header>
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
