import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";

export function ChemSyncBar() {
  const sheet = useAppStore((s) => s.sheetSync);
  if (!sheet) return null;
  const local = sheet.mode === "local";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
      <Badge variant={sheet.ok && !local ? "ok" : "warn"}>{local ? "Máy chủ" : "Google Sheet"}</Badge>
      <span className="text-muted">
        {local
          ? "Tồn / liều / chốt đã ghi máy chủ. Tab CHEM_NHAP · CHEM_LIEU · CHEM_TON chưa gắn webhook — không đụng sheet lưu lượng."
          : sheet.ok
            ? `Đã đẩy ${sheet.tabs.join(", ")}. Sheet lưu lượng chỉ đọc.`
            : sheet.error || "Không đẩy được tab hóa chất."}
      </span>
    </div>
  );
}
