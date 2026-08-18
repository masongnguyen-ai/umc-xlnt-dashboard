import { FileDown } from "lucide-react";

const FILES = [
  {
    href: "/umc/Code-ChemBridge.gs",
    name: "Code-ChemBridge.gs",
    file: "Code-ChemBridge.gs",
    note: "Ghi tab CHEM_NHAP / CHEM_LIEU / CHEM_TON / AUDIT_SO — không đụng sheet lưu lượng",
  },
  {
    href: "/umc/Code-Backend.gs",
    name: "Code-Backend.gs",
    file: "Code-Backend.gs",
    note: "Dán vào Code.gs của project Backend (doGet + đăng nhập + 9 module)",
  },
  {
    href: "/umc/260814_UMC_VanHanhXLNT_Shell.v3.html",
    name: "Shell v3 (index)",
    file: "260814_UMC_VanHanhXLNT_Shell.v3.html",
    note: "File HTML tên đúng index — khung 9 module",
  },
  {
    href: "/umc/Code-Dashboard.gs",
    name: "Code-Dashboard.gs",
    file: "Code-Dashboard.gs",
    note: "Dán vào Code.gs của project Dashboard (getData từ tab DASHBOARD_DATA)",
  },
  {
    href: "/umc/260814_UMC_Dashboard-NuocThai_AppsScript.v12.html",
    name: "Dashboard v12 (Index)",
    file: "260814_UMC_Dashboard-NuocThai_AppsScript.v12.html",
    note: "File HTML tên Index (I hoa) — lưu lượng, tự làm mới 10 phút",
  },
  {
    href: "/umc/umc-design-system.css",
    name: "Design system",
    file: "umc-design-system.css",
    note: "Token u- nếu cần nhúng riêng",
  },
] as const;

export function HtmlFilesCard() {
  return (
    <section className="rounded-xl border border-accent/30 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileDown className="size-4 text-accent" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold">Tải file HTML cho Apps Script</h2>
      </div>
      <p className="mb-3 text-xs text-muted">
        Mở file, rồi Lưu trang (hoặc chuột phải → Lưu liên kết) để đưa vào HtmlService. Dashboard cần chạy trong Apps
        Script mới gọi được getData() từ Sheet.
      </p>
      <ul className="space-y-2">
        {FILES.map((f) => (
          <li key={f.href} className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">{f.name}</div>
              <div className="truncate text-[11px] text-dim">{f.note}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={f.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-surface2"
              >
                Mở
              </a>
              <a
                href={f.href}
                download={f.file}
                className="inline-flex min-h-11 items-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg"
              >
                Tải về
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
