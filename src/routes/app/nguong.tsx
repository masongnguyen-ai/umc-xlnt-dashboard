import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { GROUP_LABEL } from "@/lib/format";
import type { Role, ThresholdGroup } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/nguong")({ component: Nguong });

const GROUPS: ThresholdGroup[] = ["LUU_LUONG", "CHAT_LUONG", "PHAP_LY"];

function Nguong() {
  const user = useCurrentUser();
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === (user?.primaryEmail ?? "").toLowerCase())?.Vai_tro ??
    "QUAN_LY") as Role;
  const thresholds = useAppStore((s) => s.thresholds);
  const saveThreshold = useAppStore((s) => s.saveThreshold);
  const writable = can(role, "write_nguong");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <p className="max-w-2xl text-sm text-muted">
        Ba nhóm tách bạch: lưu lượng vận hành, dải chất lượng nội bộ (vàng — không chặn nhập), và giới hạn pháp lý QCVN
        28:2010 cột B (đỏ). Sửa giá trị ở đây sẽ lan sang Dashboard và lần quét cảnh báo tiếp theo.
      </p>
      {GROUPS.map((g) => (
        <section key={g}>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{GROUP_LABEL[g]}</h2>
            <Badge variant={g === "PHAP_LY" ? "legal" : g === "CHAT_LUONG" ? "warn" : "accent"}>
              {thresholds.filter((t) => t.Nhom === g).length} ngưỡng
            </Badge>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border shadow-panel">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {["Mã", "Tên", "Toán tử", "Giá trị 1", "Giá trị 2", "Mức", "Bật"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {thresholds
                  .filter((t) => t.Nhom === g)
                  .map((t) => (
                    <tr key={t.Threshold_ID} className="border-t border-border hover:bg-surface2">
                      <td className="px-3 py-2 font-mono text-xs">{t.Ma_nguong}</td>
                      <td className="px-3 py-2">
                        <div>{t.Ten_nguong}</div>
                        <div className="text-[11px] text-dim">{t.Ghi_chu}</div>
                      </td>
                      <td className="px-3 py-2 text-muted">{t.Toan_tu === "OUT_OF_RANGE" ? "Ngoài khoảng" : t.Toan_tu}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.1"
                          className="h-8 w-24"
                          disabled={!writable}
                          defaultValue={t.Gia_tri_1}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v !== t.Gia_tri_1) {
                              saveThreshold(t.Threshold_ID, { Gia_tri_1: v });
                              toast.success(`Đã cập nhật ${t.Ma_nguong}`);
                            }
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {t.Toan_tu === "OUT_OF_RANGE" ? (
                          <Input
                            type="number"
                            step="0.1"
                            className="h-8 w-24"
                            disabled={!writable}
                            defaultValue={t.Gia_tri_2 ?? ""}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v) && v !== t.Gia_tri_2) {
                                saveThreshold(t.Threshold_ID, { Gia_tri_2: v });
                                toast.success(`Đã cập nhật ${t.Ma_nguong}`);
                              }
                            }}
                          />
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={g === "PHAP_LY" ? "legal" : g === "CHAT_LUONG" ? "warn" : "accent"}>
                          {t.Muc_do}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Switch
                          checked={t.Kich_hoat}
                          disabled={!writable}
                          onCheckedChange={(v) => saveThreshold(t.Threshold_ID, { Kich_hoat: v })}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
