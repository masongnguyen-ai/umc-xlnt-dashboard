import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isPending && user) return <Navigate to="/app/theodoi" />;

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await authClient.signUp.email({ email, password, name: name || email.split("@")[0] });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
      }
      window.location.href = "/app/theodoi";
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Không đăng nhập được.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-dvh overflow-hidden lg:block">
        <img src="/plant-dusk.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-bg/20" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            820 m³/ngày · QCVN 28:2010 cột B
          </p>
          <h1 className="mt-3 max-w-md text-3xl font-medium tracking-tight text-fg">
            Trạm xử lý nước thải
            <span className="mt-1 block text-muted">Bệnh viện Đại học Y Dược TP.HCM</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm text-muted">
            Hai hệ 600 và 220 · nhà thầu Đại Nam · vận hành 7h–18h kể cả lễ Tết.
          </p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-fg">
              <Droplets className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">UMC · XLNT</div>
              <div className="text-xs text-muted">Hệ thống vận hành trạm</div>
            </div>
          </div>

          <h2 className="text-2xl font-medium tracking-tight">Đăng nhập</h2>
          <p className="mt-2 text-sm text-muted">
            Tài khoản Google bệnh viện / nhà thầu, hoặc email nội bộ.
          </p>

          <div className="mt-8 space-y-3">
            {authEnabled ? (
              GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="secondary"
                  className="h-11 w-full justify-center"
                  onClick={() => signIn(p.providerId, { callbackURL: "/app/theodoi" })}
                >
                  Tiếp tục với {p.label}
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted">Đăng nhập đang tắt.</p>
            )}
          </div>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wide text-dim">
            <span className="h-px flex-1 bg-border" />
            hoặc email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={onEmail}>
            {mode === "up" ? (
              <div>
                <Label>Họ tên</Label>
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            ) : null}
            <div>
              <Label>Email</Label>
              <Input className="mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Mật khẩu</Label>
              <Input
                className="mt-1"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {err ? <p className="text-sm text-bad">{err}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Đang xử lý…" : mode === "up" ? "Tạo tài khoản" : "Đăng nhập email"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted hover:text-fg"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
            </button>
          </form>

          <ul className="mt-10 space-y-2 text-xs text-dim">
            <li>Quản lý — ngưỡng, duyệt nhật ký, tài khoản</li>
            <li>Nhà thầu — hóa chất, thiết bị, báo cáo</li>
            <li>Ca trực — nhật ký ca và theo dõi lưu lượng</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
