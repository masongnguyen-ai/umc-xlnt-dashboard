import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled, signInGoogle } from "@/lib/auth/client";
import { getLoginFlagsFn } from "@/lib/auth/login-flags";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function loginErrorVi(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid origin")) {
    return "Trình duyệt gửi sai origin. Tải lại trang rồi thử lại.";
  }
  if (m.includes("redirect_uri") || m.includes("redirect uri")) {
    return "Google Cloud chưa khai redirect: http://localhost:8080/api/auth/callback/google";
  }
  if (m.includes("invalid_client") || m.includes("client id") || m.includes("client_id")) {
    return "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET chưa đúng. Tạo OAuth Client loại Web trên Google Cloud (không dùng service account).";
  }
  if (
    m.includes("provider") &&
    (m.includes("not found") || m.includes("not configured") || m.includes("disabled"))
  ) {
    return "Chưa gắn Google OAuth. Thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET vào môi trường máy chủ, rồi restart.";
  }
  if (
    m.includes("invalid email") ||
    m.includes("invalid password") ||
    m.includes("invalid_email_or_password") ||
    m.includes("invalid credentials")
  ) {
    return "Sai email hoặc mật khẩu. Email Gmail bệnh viện dùng nút Google phía trên — không gõ mật khẩu Gmail vào đây. Tài khoản mật khẩu phải bấm «Đăng ký» lần đầu (tối thiểu 8 ký tự).";
  }
  if (m.includes("already exists") || m.includes("user already")) {
    return "Email này đã có tài khoản. Bấm Đăng nhập, hoặc «Tiếp tục với Google» nếu đã từng vào bằng Google.";
  }
  if (m.includes("too short") || (m.includes("password") && m.includes("8"))) {
    return "Mật khẩu tối thiểu 8 ký tự.";
  }
  return raw.trim() || "Không đăng nhập được.";
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);

  useEffect(() => {
    void getLoginFlagsFn()
      .then((f) => setGoogleReady(f.google))
      .catch(() => setGoogleReady(false));
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "google") {
      setErr("Google từ chối đăng nhập. Kiểm tra OAuth Web client và redirect URI.");
    }
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
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({
          email: trimmed,
          password,
          rememberMe: true,
        });
        if (error) throw new Error(error.message);
      }
      window.location.href = "/app/theodoi";
    } catch (ex) {
      setErr(loginErrorVi(ex instanceof Error ? ex.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setErr("");
    setBusy(true);
    try {
      if (googleReady === false) {
        throw new Error(
          "Chưa gắn Google OAuth. Tạo Client ID loại Ứng dụng web trên Google Cloud, khai redirect http://localhost:8080/api/auth/callback/google, rồi đặt GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.",
        );
      }
      await signInGoogle({ callbackURL: "/app/theodoi" });
    } catch (ex) {
      setErr(loginErrorVi(ex instanceof Error ? ex.message : ""));
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-dvh overflow-hidden lg:block">
        <img src="/plant-dusk.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-bg/75" />
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
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-sm bg-accent text-accent-fg shadow-panel">
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

          <h2 className="text-2xl font-medium tracking-tight">Đăng nhập</h2>
          <p className="mt-2 text-sm text-muted">
            Nhân sự bệnh viện: Google (cần OAuth Web client). Hoặc đăng ký email nội bộ bên dưới — không dùng mật khẩu
            Gmail.
          </p>

          <div className="mt-8 space-y-3">
            {authEnabled ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full justify-center"
                  disabled={busy}
                  onClick={() => void onGoogle()}
                >
                  {busy ? "Đang chuyển tới Google…" : "Tiếp tục với Google"}
                </Button>
                {googleReady === false ? (
                  <p className="text-xs text-warn">
                    Google chưa cấu hình trên máy này. Dùng Đăng ký email, hoặc thêm GOOGLE_CLIENT_ID +
                    GOOGLE_CLIENT_SECRET (OAuth Web, không phải service account Sheet).
                  </p>
                ) : null}
              </>
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
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-dim">Tối thiểu 8 ký tự. Lần đầu dùng form này: bấm Đăng ký.</p>
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
