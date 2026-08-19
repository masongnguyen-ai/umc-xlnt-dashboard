import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { can } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import type { Equipment, EqStatus, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MAINT_SCHEDULE } from "@/lib/csdl";
import { todayISO } from "@/lib/format";
import { persistIncident } from "@/lib/ops/client";
import { ApprovalInbox } from "@/components/approval-inbox";
import { APPROVAL_LABEL, pendingIncidents } from "@/lib/approval";
import { prepareEvidenceImage, fmtBytes } from "@/lib/image-compress";
import { parseDriveFileId } from "@/lib/drive-tree";

export const Route = createFileRoute("/app/thietbi")({ component: ThietBi });

const EMPTY_EQ: Equipment = {
  Equipment_ID: "",
  Ten_thiet_bi: "",
  He_thong: "He_600",
  Hang_SX: "",
  Model: "",
  So_luong: 1,
  Thong_so: "",
  Tinh_trang: "HOAT_DONG",
  Ghi_chu: "",
};

function nextEquipmentId(list: Equipment[], he: "He_600" | "He_220") {
  const prefix = he === "He_600" ? "TB-600-" : "TB-220-";
  const nums = list
    .filter((e) => e.Equipment_ID.startsWith(prefix))
    .map((e) => Number.parseInt(e.Equipment_ID.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
  return `${prefix}${String(Math.max(0, ...nums) + 1).padStart(2, "0")}`;
}

function ThietBi() {
  const user = useCurrentUser();
  const email = user?.primaryEmail ?? "";
  const users = useAppStore((s) => s.users);
  const role = (users.find((u) => u.Email.toLowerCase() === email.toLowerCase())?.Vai_tro ?? "QUAN_LY") as Role;
  const equipments = useAppStore((s) => s.equipments);
  const incidents = useAppStore((s) => s.incidents);
  const maintenances = useAppStore((s) => s.maintenances);
  const updateEquipment = useAppStore((s) => s.updateEquipment);
  const addEquipment = useAppStore((s) => s.addEquipment);
  const addMaintenance = useAppStore((s) => s.addMaintenance);
  const reviewIncident = useAppStore((s) => s.reviewIncident);
  const writable = can(role, "write_thietbi");
  const canCatalog = role === "QUAN_LY";

  const [sys, setSys] = useState<"all" | "He_600" | "He_220">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [eid, setEid] = useState("TB-220-18");
  const [abnormal, setAbnormal] = useState(false);
  const [doiTuong, setDoiTuong] = useState("");
  const [heLienQuan, setHeLienQuan] = useState<"He_600" | "He_220" | "CHUNG">("CHUNG");
  const [desc, setDesc] = useState("");
  const [fix, setFix] = useState("");
  const [photos, setPhotos] = useState<Array<{ name: string; dataUrl?: string; driveUrl?: string; bytes: number }>>([]);
  const [drivePaste, setDrivePaste] = useState("");
  const [savingInc, setSavingInc] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const [eqOpen, setEqOpen] = useState(false);
  const [eqDraft, setEqDraft] = useState<Equipment>(EMPTY_EQ);
  const [eqIsNew, setEqIsNew] = useState(false);

  const [mntOpen, setMntOpen] = useState(false);
  const [mntEid, setMntEid] = useState("TB-220-18");
  const [mntContent, setMntContent] = useState("");
  const [mntParts, setMntParts] = useState("");
  const [mntResult, setMntResult] = useState("");
  const [mntNote, setMntNote] = useState("");

  const list = useMemo(
    () =>
      equipments.filter((e) => {
        if (sys !== "all" && e.He_thong !== sys) return false;
        return `${e.Equipment_ID} ${e.Ten_thiet_bi} ${e.Hang_SX} ${e.Model}`.toLowerCase().includes(q.toLowerCase());
      }),
    [equipments, sys, q],
  );

  const n600 = equipments.filter((e) => e.He_thong === "He_600").length;
  const n220 = equipments.filter((e) => e.He_thong === "He_220").length;

  function openNewEq() {
    const he = sys === "He_220" ? "He_220" : "He_600";
    setEqIsNew(true);
    setEqDraft({ ...EMPTY_EQ, He_thong: he, Equipment_ID: nextEquipmentId(equipments, he) });
    setEqOpen(true);
  }

  function openEditEq(e: Equipment) {
    setEqIsNew(false);
    setEqDraft({ ...e });
    setEqOpen(true);
  }

  function saveEq() {
    if (!eqDraft.Ten_thiet_bi.trim()) {
      toast.error("Cần tên hạng mục.");
      return;
    }
    if (eqIsNew) {
      const r = addEquipment({
        ...eqDraft,
        Equipment_ID: eqDraft.Equipment_ID.trim() || nextEquipmentId(equipments, eqDraft.He_thong),
        Ten_thiet_bi: eqDraft.Ten_thiet_bi.trim(),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Đã thêm hạng mục.");
    } else {
      updateEquipment(eqDraft.Equipment_ID, {
        Ten_thiet_bi: eqDraft.Ten_thiet_bi.trim(),
        He_thong: eqDraft.He_thong,
        Hang_SX: eqDraft.Hang_SX.trim(),
        Model: eqDraft.Model.trim(),
        So_luong: eqDraft.So_luong,
        Thong_so: eqDraft.Thong_so.trim(),
        Tinh_trang: eqDraft.Tinh_trang,
        Ghi_chu: eqDraft.Ghi_chu.trim(),
      });
      toast.success("Đã cập nhật hạng mục.");
    }
    setEqOpen(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap gap-2 text-sm text-muted">
        <span>
          {equipments.length} hạng mục · {n600} hệ 600 + {n220} hệ 220
        </span>
        <span className="text-dim">·</span>
        <span>{incidents.length} sự cố lịch sử</span>
        <span className="text-dim">·</span>
        <span>{maintenances.length} bảo trì T04/2026</span>
      </div>

      <Tabs defaultValue="ds">
        <TabsList>
          <TabsTrigger value="ds">Danh mục</TabsTrigger>
          <TabsTrigger value="sc">Sự cố</TabsTrigger>
          <TabsTrigger value="bt">Bảo trì</TabsTrigger>
          <TabsTrigger value="lich">Lịch E-HSMT</TabsTrigger>
        </TabsList>
        <TabsContent value="ds" className="space-y-3">
          {canCatalog ? (
            <p className="text-xs text-muted">
              Tài khoản quản lý sửa tên, hãng, thông số, ghi chú — hoặc thêm hạng mục. Cột TT đổi tình trạng vận hành.
            </p>
          ) : writable ? (
            <p className="text-xs text-muted">Nhà thầu đổi tình trạng ở cột TT. Sửa nội dung danh mục: tài khoản quản lý.</p>
          ) : null}
          <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-1.5">
            <Input className="max-w-xs" placeholder="Tìm mã, tên, hãng…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={sys} onValueChange={(v) => setSys(v as typeof sys)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cả hai hệ</SelectItem>
                <SelectItem value="He_600">Hệ 600</SelectItem>
                <SelectItem value="He_220">Hệ 220</SelectItem>
              </SelectContent>
            </Select>
            {canCatalog ? (
              <Button className="ml-auto" onClick={openNewEq}>
                Thêm hạng mục
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border shadow-panel">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {["Mã", "Tên", "Hệ", "Hãng / model", "SL", "Thông số", "TT", ""].map((h) => (
                    <th key={h || "act"} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.Equipment_ID} className="border-t border-border align-top hover:bg-surface2">
                    <td className="px-3 py-2 font-mono text-xs">{e.Equipment_ID}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{e.Ten_thiet_bi}</div>
                      {e.Ghi_chu ? <div className="text-[11px] text-dim">{e.Ghi_chu}</div> : null}
                    </td>
                    <td className="px-3 py-2">{e.He_thong === "He_600" ? "600" : "220"}</td>
                    <td className="px-3 py-2 text-muted">
                      {e.Hang_SX || "—"}
                      {e.Model ? <div className="font-mono text-[11px]">{e.Model}</div> : null}
                    </td>
                    <td className="px-3 py-2 font-mono">{e.So_luong}</td>
                    <td className="max-w-xs px-3 py-2 text-xs text-muted">{e.Thong_so}</td>
                    <td className="px-3 py-2">
                      {writable ? (
                        <Select
                          value={e.Tinh_trang}
                          onValueChange={(v) => updateEquipment(e.Equipment_ID, { Tinh_trang: v as EqStatus })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HOAT_DONG">Hoạt động</SelectItem>
                            <SelectItem value="BAO_TRI">Bảo trì</SelectItem>
                            <SelectItem value="HONG">Hỏng</SelectItem>
                            <SelectItem value="NGUNG">Ngừng</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={e.Tinh_trang === "HOAT_DONG" ? "ok" : "warn"}>{e.Tinh_trang}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canCatalog ? (
                        <Button size="sm" variant="secondary" onClick={() => openEditEq(e)}>
                          Sửa
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="sc" className="space-y-3">
          <ApprovalInbox
            title="Chờ duyệt — sự cố"
            items={pendingIncidents(incidents).map((i) => ({
              id: i.Incident_ID,
              kind: "Sự cố",
              title: i.Mo_ta_su_co.slice(0, 80) || i.Incident_ID,
              detail: fmtDate(i.Ngay_phat_sinh),
            }))}
            canReview={can(role, "approve_thietbi")}
            onReview={(id, action, note) => reviewIncident(id, action, note, email)}
          />
          {writable ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAbnormal(true);
                  setOpen(true);
                }}
              >
                Sự cố bất thường
              </Button>
              <Button
                onClick={() => {
                  setAbnormal(false);
                  setOpen(true);
                }}
              >
                Ghi sự cố
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {incidents.map((i) => {
              const eq = equipments.find((e) => e.Equipment_ID === i.Equipment_ID);
              return (
                <article key={i.Incident_ID} className="rounded-lg border border-border bg-surface p-4 shadow-panel">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-dim">{i.Incident_ID}</span>
                    {i.Loai === "BAT_THUONG" || i.Equipment_ID === "KHAC" ? (
                      <Badge variant="warn">Bất thường</Badge>
                    ) : null}
                    <Badge variant={i.Trang_thai === "DA_XU_LY" ? "ok" : "warn"}>{i.Trang_thai}</Badge>
                    {i.status === "CHO_DUYET" || i.status === "TRA_LAI" || i.status === "DA_CHOT" ? (
                      <Badge variant={i.status === "DA_CHOT" ? "ok" : i.status === "CHO_DUYET" ? "warn" : "accent"}>
                        {APPROVAL_LABEL[i.status]}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted">{fmtDate(i.Ngay_phat_sinh)}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">
                    {i.Loai === "BAT_THUONG" || i.Equipment_ID === "KHAC"
                      ? i.Doi_tuong || "Ngoài danh mục thiết bị"
                      : eq?.Ten_thiet_bi}
                    {i.Loai === "BAT_THUONG" || i.Equipment_ID === "KHAC" ? (
                      <span className="ml-1 font-normal text-dim">
                        {i.He_lien_quan === "He_600" ? "Hệ 600" : i.He_lien_quan === "He_220" ? "Hệ 220" : "Chung"}
                      </span>
                    ) : (
                      <span className="ml-1 font-mono font-normal text-dim">{i.Equipment_ID}</span>
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{i.Mo_ta_su_co}</p>
                  <p className="mt-2 text-sm">Xử lý: {i.Bien_phap_xu_ly}</p>
                  {i.Anh?.length ? (
                    <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {i.Anh.map((p) => (
                        <li key={p.id}>
                          <a href={p.url} target="_blank" rel="noreferrer" className="block">
                            <img src={p.url} alt={p.name} className="h-16 w-full rounded-md object-cover" />
                          </a>
                          <div className="mt-0.5 truncate text-[10px] text-dim">{p.name}</div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="bt" className="space-y-2">
          {writable ? (
            <div className="flex justify-end">
              <Button onClick={() => setMntOpen(true)}>Ghi bảo trì</Button>
            </div>
          ) : null}
          {maintenances.map((m) => (
            <article key={m.Maint_ID} className="rounded-lg border border-border bg-surface p-4 shadow-panel">
              <div className="font-mono text-xs text-dim">{m.Maint_ID}</div>
              <h3 className="mt-1 text-sm font-semibold">{m.Noi_dung_bao_tri}</h3>
              <p className="mt-1 text-sm text-muted">
                {m.Equipment_ID} · vật tư: {m.Vat_tu_thay_the} · {m.Ket_qua}
              </p>
              <p className="mt-2 text-xs text-dim">{m.Ghi_chu}</p>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="lich">
          <p className="mb-3 text-sm text-muted">
            Tần suất chính thức E-HSMT — thay thế 7 nhóm mô tả chung ở v2. Lịch này đọc từ CSDL, không sửa tại đây.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border shadow-panel">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {["Nhóm", "Hạng mục", "Tần suất"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MAINT_SCHEDULE.map((r) => (
                  <tr key={`${r.nhom}-${r.hang}`} className="border-t border-border hover:bg-surface2">
                    <td className="px-3 py-2 font-medium">{r.nhom}</td>
                    <td className="px-3 py-2 text-muted">{r.hang}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.tan === "Tuần" ? "accent" : r.tan === "Tháng" ? "ok" : "default"}>{r.tan}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{abnormal ? "Sự cố bất thường" : "Ghi sự cố"}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={
                !abnormal
                  ? "min-h-10 flex-1 rounded-full border border-accent bg-accent px-3 text-sm text-accent-fg"
                  : "min-h-10 flex-1 rounded-full border border-border bg-surface px-3 text-sm text-muted"
              }
              onClick={() => setAbnormal(false)}
            >
              Trong danh mục
            </button>
            <button
              type="button"
              className={
                abnormal
                  ? "min-h-10 flex-1 rounded-full border border-accent bg-accent px-3 text-sm text-accent-fg"
                  : "min-h-10 flex-1 rounded-full border border-border bg-surface px-3 text-sm text-muted"
              }
              onClick={() => setAbnormal(true)}
            >
              Ngoài danh mục
            </button>
          </div>
          {abnormal ? (
            <>
              <p className="text-xs text-muted">
                Ống, van, tủ điện, tràn bể, mùi, công trình phụ — không có mã trong 34 hạng mục.
              </p>
              <div>
                <Label>Hệ liên quan</Label>
                <Select value={heLienQuan} onValueChange={(v) => setHeLienQuan(v as typeof heLienQuan)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHUNG">Chung / chưa gắn hệ</SelectItem>
                    <SelectItem value="He_600">Hệ 600</SelectItem>
                    <SelectItem value="He_220">Hệ 220</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Đối tượng / vị trí</Label>
                <Input
                  className="mt-1"
                  placeholder="VD: van xả bể điều hòa, ống DN80 khu B, tủ điện, lưới chắn rác tạm…"
                  value={doiTuong}
                  onChange={(e) => setDoiTuong(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <Label>Thiết bị</Label>
              <Select value={eid} onValueChange={setEid}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => (
                    <SelectItem key={e.Equipment_ID} value={e.Equipment_ID}>
                      {e.Equipment_ID} · {e.Ten_thiet_bi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Mô tả</Label>
            <Textarea className="mt-1" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <Label>Biện pháp</Label>
            <Textarea className="mt-1" value={fix} onChange={(e) => setFix(e.target.value)} />
          </div>
          <div>
            <Label>Ảnh chứng minh trên Drive</Label>
            <p className="mt-0.5 text-[11px] text-dim">
              Kho chính là Google Drive (5 TB). Nên chụp bằng điện thoại → lưu vào thư mục UMC_XLNT / 03_Anh_chung_minh / su_co, rồi dán link. Hoặc đính ảnh tại đây — app đẩy vào đúng thư mục tháng, không ép 1 MB.
            </p>
            <Input
              className="mt-2"
              placeholder="Dán link Google Drive (Chia sẻ → Sao chép liên kết)"
              value={drivePaste}
              onChange={(e) => setDrivePaste(e.target.value)}
              onBlur={() => {
                const id = parseDriveFileId(drivePaste);
                if (!id) return;
                setPhotos((prev) => {
                  if (prev.some((p) => p.driveUrl?.includes(id))) return prev;
                  return [...prev, { name: "Drive", driveUrl: drivePaste.trim(), bytes: 0 }].slice(0, 8);
                });
                setDrivePaste("");
                toast.success("Đã gắn link Drive.");
              }}
            />
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files;
                if (!files?.length) return;
                void Promise.all(Array.from(files).map((f) => prepareEvidenceImage(f)))
                  .then((next) => {
                    setPhotos((prev) => {
                      if (prev.length + next.length > 8) toast.message("Tối đa 8 ảnh.");
                      return [...prev, ...next].slice(0, 8);
                    });
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Không xử lý được ảnh."))
                  .finally(() => {
                    e.target.value = "";
                  });
              }}
            />
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => photoInput.current?.click()}>
              Chụp / chọn ảnh
            </Button>
            {photos.length ? (
              <ul className="mt-2 grid grid-cols-4 gap-2">
                {photos.map((p, idx) => (
                  <li key={`${p.name}-${idx}`} className="relative">
                    {p.dataUrl ? (
                      <img src={p.dataUrl} alt={p.name} className="h-16 w-full rounded-md object-cover" />
                    ) : (
                      <div className="flex h-16 items-center justify-center rounded-md border border-border bg-surface2 px-1 text-center text-[10px] text-muted">
                        Link Drive
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] text-dim">{p.bytes ? fmtBytes(p.bytes) : "Drive"}</div>
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-bg/90 px-1.5 text-[10px] text-muted"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button
            disabled={savingInc}
            onClick={() => {
              if (abnormal && !doiTuong.trim()) {
                toast.error("Cần ghi đối tượng / vị trí — không có trong danh mục thiết bị.");
                return;
              }
              if (!desc.trim()) {
                toast.error("Cần mô tả sự cố.");
                return;
              }
              const heLabel = heLienQuan === "He_600" ? "Hệ 600" : heLienQuan === "He_220" ? "Hệ 220" : "Chung";
              setSavingInc(true);
              void persistIncident(
                {
                  Equipment_ID: abnormal ? "KHAC" : eid,
                  Loai: abnormal ? "BAT_THUONG" : "THIET_BI",
                  Doi_tuong: abnormal ? doiTuong.trim() : "",
                  He_lien_quan: abnormal ? heLienQuan : undefined,
                  Ngay_phat_sinh: todayISO(),
                  Mo_ta_su_co: abnormal ? `[${heLabel} · ${doiTuong.trim()}] ${desc}` : desc,
                  Bien_phap_xu_ly: fix,
                  Trang_thai: "MOI",
                  Nguoi_khac_phuc: "",
                  Ngay_hoan_thanh: "",
                  status: role === "QUAN_LY" ? "DA_CHOT" : "CHO_DUYET",
                },
                photos.map((p) => ({ name: p.name, dataUrl: p.dataUrl, driveUrl: p.driveUrl })),
              ).then(() => {
                setOpen(false);
                setDesc("");
                setFix("");
                setPhotos([]);
                setDrivePaste("");
                setDoiTuong("");
                setHeLienQuan("CHUNG");
              }).finally(() => setSavingInc(false));
            }}
          >
            {savingInc ? "Đang lưu lên Drive…" : role === "QUAN_LY" ? "Lưu" : "Gửi quản lý"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={mntOpen} onOpenChange={setMntOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi bảo trì</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Thiết bị</Label>
            <Select value={mntEid} onValueChange={setMntEid}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {equipments.map((e) => (
                  <SelectItem key={e.Equipment_ID} value={e.Equipment_ID}>
                    {e.Equipment_ID} · {e.Ten_thiet_bi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nội dung bảo trì</Label>
            <Textarea className="mt-1" value={mntContent} onChange={(e) => setMntContent(e.target.value)} />
          </div>
          <div>
            <Label>Vật tư thay thế</Label>
            <Input className="mt-1" value={mntParts} onChange={(e) => setMntParts(e.target.value)} />
          </div>
          <div>
            <Label>Kết quả</Label>
            <Input className="mt-1" value={mntResult} onChange={(e) => setMntResult(e.target.value)} />
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea className="mt-1" value={mntNote} onChange={(e) => setMntNote(e.target.value)} />
          </div>
          <Button
            onClick={() => {
              if (!mntContent.trim()) {
                toast.error("Cần nội dung bảo trì.");
                return;
              }
              addMaintenance({
                Equipment_ID: mntEid,
                Ngay_bao_tri: todayISO(),
                Noi_dung_bao_tri: mntContent.trim(),
                Vat_tu_thay_the: mntParts.trim() || "—",
                Ket_qua: mntResult.trim() || "Đã thực hiện",
                Ghi_chu: mntNote.trim(),
              });
              toast.success("Đã ghi bảo trì.");
              setMntOpen(false);
              setMntContent("");
              setMntParts("");
              setMntResult("");
              setMntNote("");
            }}
          >
            Lưu
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={eqOpen} onOpenChange={setEqOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{eqIsNew ? "Thêm hạng mục" : "Sửa hạng mục"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Mã</Label>
            <Input className="mt-1 font-mono" value={eqDraft.Equipment_ID} disabled={!eqIsNew} onChange={(e) => setEqDraft({ ...eqDraft, Equipment_ID: e.target.value })} />
          </div>
          <div>
            <Label>Tên thiết bị</Label>
            <Input className="mt-1" value={eqDraft.Ten_thiet_bi} onChange={(e) => setEqDraft({ ...eqDraft, Ten_thiet_bi: e.target.value })} />
          </div>
          <div>
            <Label>Hệ</Label>
            <Select
              value={eqDraft.He_thong}
              onValueChange={(v) => {
                const he = v as "He_600" | "He_220";
                setEqDraft({
                  ...eqDraft,
                  He_thong: he,
                  Equipment_ID: eqIsNew ? nextEquipmentId(equipments, he) : eqDraft.Equipment_ID,
                });
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="He_600">Hệ 600</SelectItem>
                <SelectItem value="He_220">Hệ 220</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Hãng</Label>
              <Input className="mt-1" value={eqDraft.Hang_SX} onChange={(e) => setEqDraft({ ...eqDraft, Hang_SX: e.target.value })} />
            </div>
            <div>
              <Label>Model</Label>
              <Input className="mt-1" value={eqDraft.Model} onChange={(e) => setEqDraft({ ...eqDraft, Model: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Số lượng</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={eqDraft.So_luong}
              onChange={(e) => setEqDraft({ ...eqDraft, So_luong: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Thông số</Label>
            <Textarea className="mt-1" value={eqDraft.Thong_so} onChange={(e) => setEqDraft({ ...eqDraft, Thong_so: e.target.value })} />
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea className="mt-1" value={eqDraft.Ghi_chu} onChange={(e) => setEqDraft({ ...eqDraft, Ghi_chu: e.target.value })} />
          </div>
          <Button onClick={saveEq}>Lưu</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
