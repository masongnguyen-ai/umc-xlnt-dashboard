import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { LOG_STATUS_LABEL, SHIFT_LABEL, fmtDate, todayISO } from "@/lib/format";
import type { OpLog, Role, Shift } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/kpi";
import { uid } from "@/lib/utils";

export const Route = createFileRoute("/app/nhatky")({ component: NhatKy });

function emptyLog(email: string): OpLog {
  return {
    Log_ID: uid("LOG"),
    Ngay: todayISO(),
    Ca: "SANG",
    He_thong: "He_600",
    Nhiet_do: 29,
    pH_dau_vao: 7.2,
    pH_dau_ra: 7.4,
    DO: 2.6,
    SV30: 330,
    Luu_luong_nt: 0,
    Amoni: null,
    COD: null,
    Tinh_trang_he_thong: "Ổn định",
    Su_co_phat_sinh: "",
    Bien_phap_khac_phuc: "",
    Trang_thai: "NHAP",
    Nguoi_tao: email,
    Nguoi_sua: email,
    Ngay_tao: new Date().toISOString(),
    Ngay_sua: new Date().toISOString(),
    Checklist_Ket_qua: "",
    Nguoi_xacnhan_BV: "",
    Chucvu_xacnhan_BV: "",
    Da_xacnhan_BV: false,
  };
}

const ST: Record<string, "ok" | "warn" | "bad" | "accent"> = {
  NHAP: "default" as never,
  CHO_DUYET: "warn",
  DA_DUYET: "ok",
  YEU_CAU_BO_SUNG: "accent",
  KHOA: "bad",
};

function NhatKy() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "QUAN_LY") as Role;
  const logs = useAppStore((s) => s.logs);
  const checklist = useAppStore((s) => s.checklist);
  const saveLog = useAppStore((s) => s.saveLog);
  const approveLog = useAppStore((s) => s.approveLog);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OpLog | null>(null);
  const [note, setNote] = useState("");

  const list = useMemo(
    () =>
      logs.filter((l) =>
        `${l.Ngay} ${l.Nguoi_tao} ${l.Tinh_trang_he_thong}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [logs, q],
  );

  const set = <K extends keyof OpLog>(k: K, v: OpLog[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
  };

  const checked = new Set((draft?.Checklist_Ket_qua || "").split(",").filter(Boolean));

  const submit = (asDraft: boolean) => {
    if (!draft) return;
    const r = saveLog(draft, email, asDraft);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (r.warnings.length) {
      toast.warning(r.warnings.map((w) => w.message).join(" · "), { duration: 7000 });
    } else {
      toast.success(asDraft ? "Đã lưu nháp." : "Đã gửi duyệt.");
    }
    setOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Tìm ngày, người trực…" value={q} onChange={(e) => setQ(e.target.value)} />
        {can(role, "write_nhatky") ? (
          <Button
            className="ml-auto"
            onClick={() => {
              setDraft(emptyLog(email));
              setOpen(true);
            }}
          >
            Nhật ký mới
          </Button>
        ) : null}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Chưa có nhật ký" hint="Ca trực nhập checklist và chỉ số từng hệ theo ca." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {["Ngày", "Ca", "Hệ", "pH ra", "SV30", "Thải", "Trạng thái", "Người tạo", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.Log_ID} className="border-t border-border hover:bg-surface2/40">
                  <td className="px-3 py-2.5">{fmtDate(l.Ngay)}</td>
                  <td className="px-3 py-2.5">{SHIFT_LABEL[l.Ca]}</td>
                  <td className="px-3 py-2.5">{l.He_thong === "He_600" ? "600" : l.He_thong === "He_220" ? "220" : "Cả hai"}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{l.pH_dau_ra}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{l.SV30}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{l.Luu_luong_nt || "–"}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={ST[l.Trang_thai] ?? "default"}>{LOG_STATUS_LABEL[l.Trang_thai]}</Badge>
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5 text-muted">{l.Nguoi_tao}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDraft({ ...l });
                        setNote("");
                        setOpen(true);
                      }}
                    >
                      Mở
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
          {draft ? (
            <>
              <DialogHeader>
                <DialogTitle>{draft.Log_ID.startsWith("LOG-") ? "Nhật ký ca" : "Nhật ký"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Ngày</Label>
                  <Input className="mt-1" type="date" value={draft.Ngay} onChange={(e) => set("Ngay", e.target.value)} />
                </div>
                <div>
                  <Label>Ca</Label>
                  <Select value={draft.Ca} onValueChange={(v) => set("Ca", v as Shift)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SANG">Ca sáng</SelectItem>
                      <SelectItem value="CHIEU">Ca chiều</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hệ</Label>
                  <Select value={draft.He_thong} onValueChange={(v) => set("He_thong", v as OpLog["He_thong"])}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="He_600">Hệ 600</SelectItem>
                      <SelectItem value="He_220">Hệ 220</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["Nhiet_do", "Nhiệt độ °C"],
                    ["pH_dau_vao", "pH đầu vào"],
                    ["pH_dau_ra", "pH đầu ra"],
                    ["DO", "DO mg/L"],
                    ["SV30", "SV30 ml/L"],
                    ["Luu_luong_nt", "Lưu lượng m³"],
                  ] as const
                ).map(([k, lab]) => (
                  <div key={k}>
                    <Label>{lab}</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      step="0.1"
                      value={draft[k]}
                      onChange={(e) => set(k, Number(e.target.value))}
                    />
                  </div>
                ))}
                <div>
                  <Label>Amoni (3 lần/tuần)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.1"
                    value={draft.Amoni ?? ""}
                    onChange={(e) => set("Amoni", e.target.value === "" ? null : Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>COD (1 lần/tuần)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.1"
                    value={draft.COD ?? ""}
                    onChange={(e) => set("COD", e.target.value === "" ? null : Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label>Tình trạng hệ thống</Label>
                <Input className="mt-1" value={draft.Tinh_trang_he_thong} onChange={(e) => set("Tinh_trang_he_thong", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Sự cố phát sinh</Label>
                  <Textarea className="mt-1" value={draft.Su_co_phat_sinh} onChange={(e) => set("Su_co_phat_sinh", e.target.value)} />
                </div>
                <div>
                  <Label>Biện pháp khắc phục</Label>
                  <Textarea className="mt-1" value={draft.Bien_phap_khac_phuc} onChange={(e) => set("Bien_phap_khac_phuc", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Checklist ca — 19 mục</Label>
                <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
                  {checklist.map((c) => (
                    <li key={c.Item_ID} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={checked.has(c.Item_ID)}
                        onCheckedChange={(v) => {
                          const next = new Set(checked);
                          if (v) next.add(c.Item_ID);
                          else next.delete(c.Item_ID);
                          set("Checklist_Ket_qua", [...next].join(","));
                        }}
                      />
                      <span className="text-muted">{c.Noi_dung}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Người xác nhận BV</Label>
                  <Input className="mt-1" value={draft.Nguoi_xacnhan_BV} onChange={(e) => set("Nguoi_xacnhan_BV", e.target.value)} />
                </div>
                <div>
                  <Label>Chức vụ</Label>
                  <Input className="mt-1" value={draft.Chucvu_xacnhan_BV} onChange={(e) => set("Chucvu_xacnhan_BV", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {can(role, "write_nhatky") && (draft.Trang_thai === "NHAP" || draft.Trang_thai === "YEU_CAU_BO_SUNG") ? (
                  <>
                    <Button variant="secondary" onClick={() => submit(true)}>
                      Lưu nháp
                    </Button>
                    <Button onClick={() => submit(false)}>Gửi duyệt</Button>
                  </>
                ) : null}
                {can(role, "approve_nhatky") && draft.Trang_thai === "CHO_DUYET" ? (
                  <div className="flex w-full flex-col gap-2">
                    <Textarea placeholder="Ghi chú duyệt" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          approveLog(draft.Log_ID, "DUYET", note, email);
                          toast.success("Đã duyệt.");
                          setOpen(false);
                        }}
                      >
                        Duyệt
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          approveLog(draft.Log_ID, "BO_SUNG", note, email);
                          toast.message("Yêu cầu bổ sung.");
                          setOpen(false);
                        }}
                      >
                        Bổ sung
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
