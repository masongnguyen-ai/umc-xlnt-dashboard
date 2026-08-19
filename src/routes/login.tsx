import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Droplets, Eye, EyeOff } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { getLoginFlagsFn } from "@/lib/auth/login-flags";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

function grokSandboxHost() {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".grok-sandbox.com");
}

function vercelHost() {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");
}

function authErrorText(error: unknown): string {
  const rec = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const status = rec.status ?? rec.statusCode;
  const code = typeof rec.code === "string" ? rec.code : "";
  const message = String(rec.message ?? (error instanceof Error ? error.message : "")).trim();
  const raw = [status, code, message].filter((p) => p !== undefined && p !== "").join(" · ");
  const m = message.toLowerCase();
  const codeL = code.toLowerCase();

  if (m.includes("invalid origin") || codeL === "invalid_origin") {
    return `${raw || "403 · INVALID_ORIGIN"}\nOrigin chưa được tin. Đặt BETTER_AUTH_URL=https://umc-xlnt-dashboard02.vercel.app`;
  }
  if (m.includes("already exists") || m.includes("user already") || codeL.includes("user_already")) {
    return `${raw}\nEmail này đã có tài khoản. Bấm Đăng nhập.`;
  }
  if (m.includes("too short") || (m.includes("password") && m.includes("8")) || codeL.includes("password")) {
    return `${raw || "Mật khẩu tối thiểu 8 ký tự."}\nMật khẩu tối thiểu 8 ký tự.`;
  }
  if (
    m.includes("invalid email") ||
    m.includes("invalid password") ||
    m.includes("invalid_email_or_password") ||
    m.includes("invalid credentials")
  ) {
    return `${raw}\nSai email hoặc mật khẩu. Lần đầu: bấm Đăng ký (email có dấu chấm miền, ví dụ msn@admin.local).`;
  }
  if (m.includes("database") || m.includes("econnrefused") || m.includes("connect")) {
    return `${raw}\nLỗi cơ sở dữ liệu. Kiểm tra DATABASE_URL (Postgres) trên Vercel.`;
  }
  return raw || "Không đăng nhập được.";
}

function PasswordField({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        className="mt-1 pr-12"
        type={show ? "text" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="absolute right-0 top-1 grid size-11 min-h-11 min-w-11 place-items-center text-muted hover:text-accent"
        aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [database, setDatabase] = useState<boolean | null>(null);
  const showBroker = grokSandboxHost();
  const showDbWarn = vercelHost() && database === false;

  useEffect(() => {
    void getLoginFlagsFn()
      .then((f) => setDatabase(f.database))
      .catch(() => setDatabase(false));
  }, []);

  if (!isPending && user) return <Navigate to="/app/theodoi" />;

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const trimmed = email.trim().toLowerCase();
      if (mode === "up") {
        const { error } = await authClient.signUp.email({
          email: trimmed,
          password,
          name: name.trim() || trimmed.split("@")[0] || "Ca trực",
        });
        if (error) throw error;
      } else {
        const { error } = await authClient.signIn.email({
          email: trimmed,
          password,
          rememberMe: true,
        });
        if (error) throw error;
      }
      window.location.href = "/app/theodoi";
    } catch (ex) {
      setErr(authErrorText(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-dvh overflow-hidden bg-mint lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div className="mb-auto flex items-center gap-3 pt-2">
          <span className="icon-mint size-12 text-accent">
            <Droplets className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">UMC · XLNT</div>
            <div className="text-xs text-muted">Hệ thống vận hành trạm</div>
          </div>
        </div>
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
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-panel sm:p-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="icon-mint size-12">
                <Droplets className="size-5" strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-sm font-semibold tracking-tight">UMC · XLNT</div>
                <div className="text-xs text-muted">Hệ thống vận hành trạm</div>
              </div>
            </div>
            <div className="mt-5 lg:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                820 m³/ngày · QCVN 28
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">Trạm xử lý nước thải</h1>
              <p className="mt-0.5 text-sm text-muted">Bệnh viện Đại học Y Dược TP.HCM</p>
            </div>
          </div>

          <h2 className="text-2xl font-medium tracking-tight">{mode === "up" ? "Đăng ký" : "Đăng nhập"}</h2>
          <p className="mt-2 text-sm text-muted">
            Email nội bộ có dấu chấm miền (ví dụ msn@admin.local). Không dùng mật khẩu Gmail.
          </p>

          {showDbWarn ? (
            <p className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              Chưa cấu hình DATABASE_URL — đăng ký / đăng nhập email trên Vercel cần Postgres (Neon).
            </p>
          ) : null}

          {authEnabled && showBroker ? (
            <p className="mt-4 text-xs text-dim">Google / X chỉ dùng trên máy xem trước Grok.</p>
          ) : null}

          {!authEnabled ? <p className="mt-4 text-sm text-muted">Đăng nhập đang tắt.</p> : null}

          <form className="mt-8 space-y-3" onSubmit={onEmail}>
            {mode === "up" ? (
              <div>
                <Label>Họ tên</Label>
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            ) : null}
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1"
                type="email"
                autoComplete="username"
                required
                placeholder="msn@admin.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-dim">Cần dấu chấm miền — msn@admin bị trình duyệt chặn.</p>
            </div>
            <div>
              <Label>Mật khẩu</Label>
              <PasswordField
                value={password}
                onChange={setPassword}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
              />
              <p className="mt-1 text-[11px] text-dim">Tối thiểu 8 ký tự. Lần đầu: bấm Đăng ký.</p>
            </div>
            {err ? <p className="whitespace-pre-line text-sm text-bad">{err}</p> : null}
            <Button type="submit" className="w-full" disabled={busy || !authEnabled}>
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
