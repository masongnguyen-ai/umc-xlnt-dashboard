import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileDown, FolderTree, ShieldAlert, Smartphone } from "lucide-react";
import { HtmlFilesCard } from "@/components/html-files-card";
import { InstallApp } from "@/components/install-app";
import { DRIVE_TREE } from "@/lib/drive-tree";

export const Route = createFileRoute("/app/trienkhai")({ component: TrienKhai });

const WEB_STEPS = [
  {
    n: "1",
    title: "Máy chủ bệnh viện (LAN) hoặc Cloudflare Tunnel",
    body: "Chạy web này trên máy nội bộ trạm / phòng kỹ thuật. Cloudflare Tunnel (cloudflared) đưa HTTPS ra ngoài mà không mở port tường lửa. Không ghi vào sheet lưu lượng — dashboard lưu lượng vẫn đọc CSV công khai như cũ.",
  },
  {
    n: "2",
    title: "Đăng nhập Google + khai nhân sự",
    body: "Ca trực / nhà thầu / quản lý đăng nhập Google. Email chưa có trong Quản trị bị chặn phía máy chủ. Quản lý thêm email và chọn vai trò: ca trực ghi liều; nhà thầu chốt nhập; quản lý sửa số đã khóa, khôi phục bản sao lưu.",
  },
  {
    n: "3",
    title: "Gắn tab hóa chất (ChemBridge)",
    body: "Trên sheet CSDL (không phải sheet lưu lượng): dán Code-ChemBridge.gs, chạy setupChemTabs, triển khai web app Thực thi bằng Tôi. Đặt CHEM_SHEET_WEBHOOK_URL và CHEM_SHEET_SECRET trùng secret trên máy chủ. Tab mới: CHEM_NHAP, CHEM_LIEU, CHEM_TON, AUDIT_SO.",
  },
  {
    n: "4",
    title: "Cài PWA máy trực",
    body: "Chrome trên máy ca trực → Cài đặt app / Thêm vào màn hình chính → ghim taskbar. Bật Giữ màn hình ở Theo dõi. App chạy cả khi máy ngủ mạng LAN nội bộ.",
  },
] as const;

const LEGACY = [
  {
    n: "A",
    title: "Sheet CSDL",
    body: "UMC - Cơ sở dữ liệu vận hành Trạm XLNT. Sao ID giữa /d/ và /edit.",
  },
  {
    n: "B",
    title: "Backend Apps Script (tùy chọn song song)",
    body: "Dán Code-Backend.gs + Shell v3 nếu vẫn cần bản HtmlService cũ. Không thay ChemBridge.",
  },
  {
    n: "C",
    title: "Dashboard lưu lượng",
    body: "Sheet lưu lượng tab DASHBOARD_DATA — chỉ đọc. Code-Dashboard.gs. Không cho ChemBridge ID của sheet này.",
  },
] as const;

function TrienKhai() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-xl border border-accent/30 bg-surface p-4">
        <h1 className="text-sm font-semibold">Web vận hành + Google Sheet hóa chất riêng</h1>
        <p className="mt-1 text-sm text-muted">
          Tồn, liều đã châm và chốt nhập ghi máy chủ, rồi đẩy bốn tab trên spreadsheet CSDL. Sheet lưu lượng 3 đồng hồ
          vẫn chỉ đọc, poll 10 phút — không bị ghi đè.
        </p>
      </section>

      <InstallApp />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FolderTree className="size-4 text-accent" strokeWidth={1.75} />
          Gom về một thư mục Drive — UMC_XLNT
        </h2>
        <p className="text-sm text-muted">
          Không để file rải trên máy, Gmail, Drive riêng từng người. Tạo <strong className="text-fg">một thư mục gốc</strong> trên Drive 5 TB, kéo hết vào đó. Điện thoại mở Drive là đủ — không cần bật máy tính.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Drive → Mới → Thư mục → tên <strong className="text-fg">UMC_XLNT</strong>.</li>
          <li>Tạo 5 thư mục con đúng tên dưới đây (hoặc để app tự tạo nhánh ảnh khi ghi sự cố).</li>
          <li>
            Kéo 2 bảng tính vào đúng chỗ: CSDL vận hành → <strong className="text-fg">01_CSDL</strong>; sheet 3 đồng hồ →{" "}
            <strong className="text-fg">02_Luu_luong</strong> (kéo file, không copy).
          </li>
          <li>
            Chia sẻ thư mục gốc quyền <strong className="text-fg">Người chỉnh sửa</strong> cho ca trực / nhà thầu cần đưa ảnh, và cho tài khoản máy chủ Google của web.
          </li>
          <li>
            Tab CONFIGS: dán ID thư mục gốc (sau <span className="font-mono text-xs">/folders/</span>) vào{" "}
            <strong className="text-fg">DRIVE_ROOT_ID</strong> hoặc <strong className="text-fg">UPLOAD_FOLDER_ID</strong>.
          </li>
        </ol>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Thư mục</th>
                <th className="px-3 py-2 text-left font-medium">Để gì vào đây</th>
              </tr>
            </thead>
            <tbody>
              {DRIVE_TREE.map((r) => (
                <tr key={r.folder} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{r.folder}</td>
                  <td className="px-3 py-2 text-muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-dim">
          Ảnh sự cố vào <span className="font-mono">03_Anh_chung_minh/su_co/2026-08</span>. Chụp bằng điện thoại: lưu vào thư mục đó trên app Drive, rồi dán link khi ghi sự cố — không nén 1 MB, Drive chứa thoải mái.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-4 text-accent" strokeWidth={1.75} />
          Bốn bước cho máy trực
        </h2>
        <ol className="space-y-2">
          {WEB_STEPS.map((s) => (
            <li key={s.n} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <HtmlFilesCard />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileDown className="size-4 text-accent" strokeWidth={1.75} />
          Bản Apps Script cũ (nếu còn dùng)
        </h2>
        <ol className="space-y-2">
          {LEGACY.map((s) => (
            <li key={s.n} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface2 text-xs font-bold">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="size-4 text-ok" strokeWidth={1.75} />
          Cloudflare / nội bộ
        </h2>
        <ul className="space-y-1 text-sm text-muted">
          <li>
            <strong className="text-fg">Nội bộ:</strong> máy Windows/Linux trong mạng bệnh viện chạy web; ca trực mở
            địa chỉ LAN.
          </li>
          <li>
            <strong className="text-fg">Cloudflare Tunnel:</strong> cloudflared trên cùng máy, hostname bệnh viện trỏ
            vào tunnel — không publish sheet lưu lượng thành chỗ ghi.
          </li>
          <li>
            <strong className="text-fg">ChemBridge:</strong> Thực thi bằng Tôi · quyền Bất kỳ ai (máy chủ POST secret).
            Sai ID sheet lưu lượng thì script từ chối.
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-warn/40 bg-warn/10 p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={1.75} />
          <p className="text-sm text-muted">
            Xem trước trên web này đã ghi số vào máy chủ kèm nhật ký. Muốn thấy trên Google Sheet: dán ChemBridge và
            khai webhook. Chưa gắn webhook thì số vẫn còn trên máy chủ và bản sao lưu.
          </p>
        </div>
      </section>
    </div>
  );
}
