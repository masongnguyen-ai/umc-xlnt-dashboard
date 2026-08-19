import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { HANDOVER_STATUS_LABEL, LOG_STATUS_LABEL, ROLE_LABEL, SHIFT_LABEL, fmtDate, todayISO } from "@/lib/format";
import { canStaffEdit, isChot, pendingLogs } from "@/lib/approval";
import { ApprovalInbox } from "@/components/approval-inbox";
import type { OpLog, Role, Shift } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ShiftAbnormalHandover } from "@/components/shift-abnormal-handover";
import { followupForDraft, inferHandover, listOpenFollowups, normalizeLog, emptyAbnormal } from "@/lib/shift-log";
import { uid } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { persistShiftLog, persistShiftLogReview, reloadOpsLedger } from "@/lib/ops/client";

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
    Tinh_trang_he_thong: "Bình thường",
    Su_co_phat_sinh: "",
    Bien_phap_khac_phuc: "",
    Co_bat_thuong: false,
    Bat_thuong: [],
    Ban_giao_tinh_trang: "BINH_THUONG",
    Ban_giao_theo_doi: "",
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

const ST: Record<string, "ok" | "warn" | "bad" | "accent" | "default"> = {
  NHAP: "default",
  CHO_DUYET: "warn",
  DA_CHOT: "ok",
  TRA_LAI: "accent",
  DA_DUYET: "ok",
  YEU_CAU_BO_SUNG: "accent",
  KHOA: "bad",
};

function heLabel(he: OpLog["He_thong"]) {
  return he === "He_600" ? "Hệ 600" : he === "He_220" ? "Hệ 220" : "Cả hai";
}

type OpsRole = "CA_TRUC" | "NHA_THAU";

function opsRoleFromChucvu(raw: string): OpsRole | "" {
  if (raw === "Ca trực" || raw === "CA_TRUC") return "CA_TRUC";
  if (raw === "Nhà thầu" || raw === "NHA_THAU") return "NHA_THAU";
  return "";
}

function handoverVariant(s: OpLog["Ban_giao_tinh_trang"] | undefined) {
  if (s === "CO_VAN_DE") return "bad" as const;
  if (s === "CAN_THEO_DOI") return "warn" as const;
  return "ok" as const;
}

function NhatKy() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "QUAN_LY") as Role;
  const logs = useAppStore((s) => s.logs);
  const checklist = useAppStore((s) => s.checklist);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "abn" | "open" | "pending">("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OpLog | null>(null);
  const [note, setNote] = useState("");
  const [handoverLocked, setHandoverLocked] = useState(false);

  const actorName = users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Ho_ten ?? email;
  const opsStaff = users.filter(
    (u) => u.Trang_thai === "HOAT_DONG" && (u.Vai_tro === "CA_TRUC" || u.Vai_tro === "NHA_THAU"),
  );
  const named = opsStaff.find(
    (u) => u.Ho_ten === draft?.Nguoi_xacnhan_BV || u.Email === draft?.Nguoi_xacnhan_BV,
  );
  const namedKind: OpsRole | "" =
    named?.Vai_tro === "CA_TRUC" || named?.Vai_tro === "NHA_THAU" ? named.Vai_tro : "";
  const opsKind = namedKind || opsRoleFromChucvu(draft?.Chucvu_xacnhan_BV ?? "");
  const people = opsKind ? opsStaff.filter((u) => u.Vai_tro === opsKind) : [];
  const witnessId = named?.User_ID ?? "";
  const openItems = useMemo(() => listOpenFollowups(logs), [logs]);

  useEffect(() => {
    void reloadOpsLedger();
  }, []);

  const list = useMemo(() => {
    return logs.filter((l) => {
      const n = normalizeLog(l);
      const hay = `${n.Ngay} ${n.Nguoi_tao} ${n.Tinh_trang_he_thong} ${n.Su_co_phat_sinh} ${n.Ban_giao_theo_doi}`
        .toLowerCase()
        .includes(q.toLowerCase());
      if (!hay) return false;
      if (filter === "abn") return n.Co_bat_thuong;
      if (filter === "open") return n.Co_bat_thuong && n.Bat_thuong.some((a) => a.ket_qua !== "DA_KHAC_PHUC" && a.hien_tuong.trim());
      if (filter === "pending") return n.Trang_thai === "CHO_DUYET";
      return true;
    });
  }, [logs, q, filter]);

  useEffect(() => {
    if (!draft || handoverLocked) return;
    const nextNote = followupForDraft(draft, logs);
    const nextStatus = inferHandover(draft, logs);
    if (nextNote === draft.Ban_giao_theo_doi && nextStatus === draft.Ban_giao_tinh_trang) return;
    setDraft((d) => (d ? { ...d, Ban_giao_theo_doi: nextNote, Ban_giao_tinh_trang: nextStatus } : d));
  }, [
    draft?.Log_ID,
    draft?.Co_bat_thuong,
    draft?.Bat_thuong,
    draft?.Ngay,
    draft?.Ca,
    draft?.He_thong,
    logs,
    handoverLocked,
  ]);

  const set = <K extends keyof OpLog>(k: K, v: OpLog[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
  };

  const checked = new Set((draft?.Checklist_Ket_qua || "").split(",").filter(Boolean));

  const startNew = (abnormal = false) => {
    const next = emptyLog(email);
    if (abnormal) {
      next.Co_bat_thuong = true;
      next.Bat_thuong = [emptyAbnormal(actorName)];
    }
    next.Ban_giao_theo_doi = followupForDraft(next, logs);
    next.Ban_giao_tinh_trang = inferHandover(next, logs);
    setHandoverLocked(false);
    setNote("");
    setDraft(next);
    setOpen(true);
  };

  const submit = async (asDraft: boolean) => {
    if (!draft) return;
    const person = opsStaff.find(
      (u) => u.Ho_ten === draft.Nguoi_xacnhan_BV || u.Email === draft.Nguoi_xacnhan_BV,
    );
    const payload =
      person && (person.Vai_tro === "CA_TRUC" || person.Vai_tro === "NHA_THAU")
        ? { ...draft, Chucvu_xacnhan_BV: ROLE_LABEL[person.Vai_tro] }
        : draft;
    const r = await persistShiftLog(payload, asDraft);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(asDraft ? "Đã lưu nháp trên Sheet." : "Đã gửi duyệt — chờ quản lý chốt.");
    setOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ApprovalInbox
        title="Chờ duyệt — nhật ký ca"
        items={pendingLogs(logs).map((l) => ({
          id: l.Log_ID,
          kind: "Nhật ký",
          title: `${fmtDate(l.Ngay)} · ${SHIFT_LABEL[l.Ca]}`,
          detail: `${l.Nguoi_tao}${l.reviewNote ? ` · ${l.reviewNote}` : ""}`,
        }))}
        canReview={can(role, "approve_nhatky")}
        onReview={(id, action, reviewNote) => persistShiftLogReview(id, action, reviewNote)}
      />

      {openItems.length ? (
        <section className="relative overflow-hidden rounded-lg border border-border bg-surface p-4 pl-5 shadow-panel">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-warn" />
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} />
            <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-warn">Việc đang theo dõi / chưa xử lý</h3>
          <p className="mt-0.5 text-xs text-muted">Ca vào nhận việc này trước khi lập nhật ký mới — đã tự điền vào bàn giao.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {openItems.map((x) => (
              <li key={`${x.logId}-${x.line}`} className="text-fg">
                {x.line}
              </li>
            ))}
          </ul>
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-1.5">
        <Input className="max-w-xs" placeholder="Tìm ngày, người trực…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Tất cả"],
              ["pending", "Chờ duyệt"],
              ["abn", "Có bất thường"],
              ["open", "Cần bàn giao"],
            ] as const
          ).map(([id, lab]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "h-10 rounded-md border px-3 text-sm",
                filter === id ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg text-muted",
              )}
              onClick={() => setFilter(id)}
            >
              {lab}
            </button>
          ))}
        </div>
        {can(role, "write_nhatky") ? (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button variant="secondary" onClick={() => startNew(true)}>
              <TriangleAlert className="size-4" strokeWidth={2} />
              Ghi nhận bất thường
            </Button>
            <Button onClick={() => startNew(false)}>Nhật ký mới</Button>
          </div>
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <h3 className="text-sm font-semibold">Chưa có nhật ký</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Ca trực nhập chỉ số, rồi <strong className="font-medium text-fg">Ghi nhận bất thường</strong> (Có / Không) và{" "}
            <strong className="font-medium text-fg">Bàn giao ca</strong>. Việc chưa xử lý tự điền sang ca sau.
          </p>
          {can(role, "write_nhatky") ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => startNew(true)}>
                <TriangleAlert className="size-4" strokeWidth={2} />
                Ghi nhận bất thường
              </Button>
              <Button onClick={() => startNew(false)}>Nhật ký mới</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {list.map((l) => {
              const n = normalizeLog(l);
              return (
                <button
                  key={l.Log_ID}
                  type="button"
                  className="w-full rounded-lg border border-border bg-surface p-4 text-left shadow-panel"
                  onClick={() => {
                    setDraft(n);
                    setHandoverLocked(!!n.Ban_giao_theo_doi);
                    setNote("");
                    setOpen(true);
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{fmtDate(n.Ngay)}</span>
                    <span className="text-xs text-muted">
                      {SHIFT_LABEL[n.Ca]} · {heLabel(n.He_thong)}
                    </span>
                    <Badge variant={handoverVariant(n.Ban_giao_tinh_trang)}>{HANDOVER_STATUS_LABEL[n.Ban_giao_tinh_trang]}</Badge>
                    {n.Co_bat_thuong ? <Badge variant="warn">Bất thường</Badge> : null}
                    <Badge variant={ST[n.Trang_thai]}>{LOG_STATUS_LABEL[n.Trang_thai]}</Badge>
                  </div>
                  {n.Ban_giao_theo_doi ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted">{n.Ban_giao_theo_doi}</p>
                  ) : (
                    <p className="mt-2 text-xs text-dim">Không có việc bàn giao</p>
                  )}
                </button>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-border shadow-panel md:block">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {["Ngày", "Ca", "Hệ", "pH ra", "Giao ca", "Bất thường", "Trạng thái", "Người tạo", ""].map((h) => (
                    <th key={h || "act"} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((l) => {
                  const n = normalizeLog(l);
                  return (
                    <tr key={l.Log_ID} className="border-t border-border hover:bg-surface2">
                      <td className="px-3 py-2.5">{fmtDate(n.Ngay)}</td>
                      <td className="px-3 py-2.5">{SHIFT_LABEL[n.Ca]}</td>
                      <td className="px-3 py-2.5">{heLabel(n.He_thong)}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">{n.pH_dau_ra}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={handoverVariant(n.Ban_giao_tinh_trang)}>{HANDOVER_STATUS_LABEL[n.Ban_giao_tinh_trang]}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                    {n.Co_bat_thuong ? (
                      <Badge variant="warn" className="gap-1">
                        <TriangleAlert className="size-3" strokeWidth={2} />
                        Có
                      </Badge>
                    ) : (
                      <span className="text-dim">Không</span>
                    )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={ST[n.Trang_thai]}>{LOG_STATUS_LABEL[n.Trang_thai]}</Badge>
                      </td>
                      <td className="max-w-40 truncate px-3 py-2.5 text-muted">{n.Nguoi_tao}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDraft(n);
                            setHandoverLocked(!!n.Ban_giao_theo_doi);
                            setNote("");
                            setOpen(true);
                          }}
                        >
                          Mở
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && draft ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-bg">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <h2 className="min-w-0 truncate text-sm font-semibold">
              Nhật ký ca · {fmtDate(draft.Ngay)} · {SHIFT_LABEL[draft.Ca]}
              {draft.Co_bat_thuong ? " · bất thường" : ""}
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-2xl space-y-4">
              {isChot(draft.Trang_thai) ? (
                <p className="rounded-md bg-mint px-3 py-2 text-xs font-medium">
                  Đã chốt — không sửa được
                  {can(role, "approve_nhatky") ? ". Quản lý bấm Mở lại nếu cần chỉnh." : "."}
                </p>
              ) : draft.Trang_thai === "CHO_DUYET" ? (
                <p className="rounded-md bg-warn/15 px-3 py-2 text-xs font-medium text-warn">
                  Đang chờ quản lý chốt. Ca trực không tự duyệt.
                </p>
              ) : draft.Trang_thai === "TRA_LAI" || draft.Trang_thai === "YEU_CAU_BO_SUNG" ? (
                <p className="rounded-md bg-accent/10 px-3 py-2 text-xs">
                  Quản lý trả lại{draft.reviewNote ? `: ${draft.reviewNote}` : "."} Sửa rồi gửi lại.
                </p>
              ) : null}
              <fieldset
                disabled={draft.Trang_thai === "CHO_DUYET" || isChot(draft.Trang_thai)}
                className="space-y-4 disabled:opacity-70"
              >
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
                    <SelectContent className="z-[200]">
                      <SelectItem value="SANG">Ca sáng</SelectItem>
                      <SelectItem value="CHIEU">Ca chiều</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hệ</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-border bg-surface2 px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40"
                    value={draft.He_thong === "He_220" ? "He_220" : "He_600"}
                    onChange={(e) => set("He_thong", e.target.value as OpLog["He_thong"])}
                  >
                    <option value="He_600">Hệ 600</option>
                    <option value="He_220">Hệ 220</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["pH_dau_vao", "pH đầu vào"],
                    ["pH_dau_ra", "pH đầu ra"],
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
              <ShiftAbnormalHandover
                draft={draft}
                actorName={actorName}
                handoverLocked={handoverLocked}
                onDraft={setDraft}
                onHandoverTyped={() => setHandoverLocked(true)}
              />
              <div>
                <Label>Checklist ca — 19 mục</Label>
                <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
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
                  <Label>Chức vụ</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-border bg-surface2 px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40"
                    value={opsKind}
                    onChange={(e) => {
                      const kind = e.target.value as OpsRole | "";
                      setDraft({
                        ...draft,
                        Chucvu_xacnhan_BV: kind ? ROLE_LABEL[kind] : "",
                        Nguoi_xacnhan_BV: "",
                      });
                    }}
                  >
                    <option value="">Chọn ca trực hoặc nhà thầu</option>
                    <option value="CA_TRUC">Ca trực</option>
                    <option value="NHA_THAU">Nhà thầu</option>
                  </select>
                  <p className="mt-1 text-[11px] text-dim">Chọn nhóm trước — danh sách người lấy từ Nhân sự (Quản trị), không gồm quản lý.</p>
                </div>
                <div>
                  <Label>Người vận hành hoặc kiểm tra</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-border bg-surface2 px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
                    disabled={!opsKind}
                    value={witnessId}
                    onChange={(e) => {
                      const u = people.find((x) => x.User_ID === e.target.value);
                      if (!u) {
                        set("Nguoi_xacnhan_BV", "");
                        return;
                      }
                      setDraft({
                        ...draft,
                        Nguoi_xacnhan_BV: u.Ho_ten,
                        Chucvu_xacnhan_BV: ROLE_LABEL[u.Vai_tro],
                      });
                    }}
                  >
                    <option value="">{opsKind ? "Chọn nhân sự" : "Chọn chức vụ trước"}</option>
                    {people.map((u) => (
                      <option key={u.User_ID} value={u.User_ID}>
                        {u.Ho_ten}
                      </option>
                    ))}
                  </select>
                  {opsKind && people.length === 0 ? (
                    <p className="mt-1 text-[11px] text-warn">Chưa có tài khoản {ROLE_LABEL[opsKind].toLowerCase()} đang hoạt động trên Quản trị.</p>
                  ) : null}
                </div>
              </div>
              <div className="h-4" />
            </fieldset>
              {can(role, "approve_nhatky") && draft.Trang_thai === "CHO_DUYET" ? (
                <Textarea className="mt-3" placeholder="Ghi chú chốt / trả lại" value={note} onChange={(e) => setNote(e.target.value)} />
              ) : null}
            </div>
          </div>
          <footer className="border-t border-border bg-surface px-4 py-3">
            <div className="mx-auto flex max-w-2xl flex-wrap gap-2">
              {can(role, "write_nhatky") && canStaffEdit(draft.Trang_thai) ? (
                <>
                  <Button variant="secondary" onClick={() => submit(true)}>
                    Lưu nháp
                  </Button>
                  <Button onClick={() => submit(false)}>Gửi quản lý</Button>
                </>
              ) : null}
              {can(role, "approve_nhatky") && draft.Trang_thai === "CHO_DUYET" ? (
                <>
                  <Button
                    onClick={() => {
                      void persistShiftLogReview(draft.Log_ID, "CHOT", note).then((r) => {
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success("Đã chốt trên Sheet.");
                          setOpen(false);
                        }
                      });
                    }}
                  >
                    Chốt
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void persistShiftLogReview(draft.Log_ID, "TRA_LAI", note).then((r) => {
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.message("Đã trả lại trên Sheet.");
                          setOpen(false);
                        }
                      });
                    }}
                  >
                    Trả lại
                  </Button>
                </>
              ) : null}
              {can(role, "approve_nhatky") && isChot(draft.Trang_thai) ? (
                <Button
                  variant="secondary"
                    onClick={() => {
                      void persistShiftLogReview(draft.Log_ID, "MO_LAI", note).then((r) => {
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success("Đã mở lại trên Sheet — có thể sửa rồi gửi.");
                          setDraft({ ...draft, Trang_thai: "NHAP" });
                        }
                      });
                    }}
                >
                  Mở lại
                </Button>
              ) : null}
            </div>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
