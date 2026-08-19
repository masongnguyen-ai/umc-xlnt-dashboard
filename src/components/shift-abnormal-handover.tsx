import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ABNORMAL_RESULT_LABEL, HANDOVER_STATUS_LABEL } from "@/lib/format";
import { emptyAbnormal } from "@/lib/shift-log";
import type { AbnormalResult, HandoverStatus, LogAbnormal, LogPhoto, OpLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { uid } from "@/lib/utils";

function Pills<T extends string>({
  value,
  onChange,
  options,
  wrap,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  wrap?: boolean;
}) {
  return (
    <div role="radiogroup" className={cn("mt-1.5 flex gap-1.5", wrap ? "flex-wrap" : "flex-wrap sm:flex-nowrap")}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={cn(
              "min-h-10 flex-1 rounded-full border px-3 text-sm transition-colors",
              on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
            )}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function fileToPhoto(file: File): Promise<LogPhoto | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      let w = img.width;
      let h = img.height;
      if (Math.max(w, h) > max) {
        const s = max / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ id: uid("PIC"), name: file.name.replace(/\.[^.]+$/, "") + ".jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.72) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function readPhotos(files: FileList | null): Promise<LogPhoto[]> {
  if (!files?.length) return Promise.resolve([]);
  return Promise.all(Array.from(files).filter((f) => f.type.startsWith("image/")).map(fileToPhoto)).then((xs) =>
    xs.filter((x): x is LogPhoto => !!x),
  );
}

export function ShiftAbnormalHandover({
  draft,
  actorName,
  handoverLocked,
  onDraft,
  onHandoverTyped,
}: {
  draft: OpLog;
  actorName: string;
  handoverLocked: boolean;
  onDraft: (next: OpLog) => void;
  onHandoverTyped: () => void;
}) {
  const fileRef = useRef<Record<string, HTMLInputElement | null>>({});

  const patchAbn = (id: string, patch: Partial<LogAbnormal>) => {
    onDraft({
      ...draft,
      Bat_thuong: draft.Bat_thuong.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-lg border border-border bg-surface p-3 pl-4 shadow-panel sm:p-4 sm:pl-5">
        <span className="absolute inset-y-0 left-0 w-[3px] bg-warn" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ghi nhận bất thường</h3>
        <p className="mt-0.5 text-xs text-muted">
          Sự cố ca này: bơm kêu, tràn bể, pH/DO/SV30 lệch, tắc rác, mất khí, hết hóa chất…
        </p>
        <Label className="mt-3 block">Có bất thường không?</Label>
        <Pills
          value={draft.Co_bat_thuong ? "CO" : "KHONG"}
          onChange={(v) => {
            const co = v === "CO";
            onDraft({
              ...draft,
              Co_bat_thuong: co,
              Bat_thuong: co && draft.Bat_thuong.length === 0 ? [emptyAbnormal(actorName)] : draft.Bat_thuong,
            });
          }}
          options={[
            { value: "KHONG", label: "Không" },
            { value: "CO", label: "Có" },
          ]}
        />

        {draft.Co_bat_thuong
          ? draft.Bat_thuong.map((a, i) => (
              <article key={a.id} className="mt-4 space-y-3 rounded-lg border border-border bg-bg/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-dim">Trường hợp {i + 1}</div>
                  {draft.Bat_thuong.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDraft({ ...draft, Bat_thuong: draft.Bat_thuong.filter((x) => x.id !== a.id) })}
                    >
                      Xóa
                    </Button>
                  ) : null}
                </div>
                <div>
                  <Label>Thời điểm phát hiện</Label>
                  <Input
                    className="mt-1"
                    type="time"
                    value={a.gio_phat_hien}
                    onChange={(e) => patchAbn(a.id, { gio_phat_hien: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hiện tượng</Label>
                  <Textarea
                    className="mt-1 min-h-20"
                    placeholder="VD: bơm P-01 kêu to, nước tràn bể điều hòa, pH đầu vào tụt 5,2, SV30 aerotank 450 mL/L…"
                    value={a.hien_tuong}
                    onChange={(e) => patchAbn(a.id, { hien_tuong: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nguyên nhân nghi ngờ (không bắt buộc)</Label>
                  <Textarea
                    className="mt-1 min-h-16"
                    placeholder="VD: kẹt rác đầu hút, hết NaOH, đĩa thổi khí tắc — để trống nếu chưa rõ"
                    value={a.nguyen_nhan}
                    onChange={(e) => patchAbn(a.id, { nguyen_nhan: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Đã xử lý</Label>
                  <Textarea
                    className="mt-1 min-h-16"
                    placeholder='VD: vệ sinh đầu hút, tăng liều NaOH, chạy bơm dự phòng — hoặc ghi "chưa xử lý"'
                    value={a.da_xu_ly}
                    onChange={(e) => patchAbn(a.id, { da_xu_ly: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Người xử lý</Label>
                  <Input
                    className="mt-1"
                    placeholder="Họ tên ca trực / nhà thầu"
                    value={a.nguoi_xu_ly}
                    onChange={(e) => patchAbn(a.id, { nguoi_xu_ly: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Kết quả</Label>
                  <Pills
                    wrap
                    value={a.ket_qua}
                    onChange={(v) => patchAbn(a.id, { ket_qua: v as AbnormalResult })}
                    options={[
                      { value: "DA_KHAC_PHUC", label: ABNORMAL_RESULT_LABEL.DA_KHAC_PHUC },
                      { value: "DANG_THEO_DOI", label: ABNORMAL_RESULT_LABEL.DANG_THEO_DOI },
                      { value: "CHUA_XU_LY", label: ABNORMAL_RESULT_LABEL.CHUA_XU_LY },
                    ]}
                  />
                </div>
                <div>
                  <Label>Ảnh đính kèm (không bắt buộc)</Label>
                  <input
                    ref={(el) => {
                      fileRef.current[a.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const input = e.target;
                      void readPhotos(input.files).then((pics) => {
                        const next = [...a.anh, ...pics].slice(0, 4);
                        if (a.anh.length + pics.length > 4) toast.message("Tối đa 4 ảnh / trường hợp.");
                        patchAbn(a.id, { anh: next });
                        input.value = "";
                      });
                    }}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current[a.id]?.click()}>
                      Thêm ảnh
                    </Button>
                    <span className="text-[11px] text-dim">Tối đa 4 ảnh — ảnh điện thoại được nén tự động</span>
                  </div>
                  {a.anh.length ? (
                    <ul className="mt-2 grid grid-cols-4 gap-2">
                      {a.anh.map((p) => (
                        <li key={p.id} className="relative">
                          <img src={p.dataUrl} alt={p.name} className="h-16 w-full rounded-md object-cover" />
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-bg/90 px-1.5 text-[10px] text-muted"
                            onClick={() => patchAbn(a.id, { anh: a.anh.filter((x) => x.id !== p.id) })}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))
          : (
            <p className="mt-3 text-xs text-muted">Ca ổn — không có sự cố cần ghi. Bàn giao ca vẫn điền bên dưới.</p>
          )}

        {draft.Co_bat_thuong ? (
          <Button
            className="mt-3"
            variant="secondary"
            type="button"
            onClick={() => onDraft({ ...draft, Bat_thuong: [...draft.Bat_thuong, emptyAbnormal(actorName)] })}
          >
            Thêm trường hợp
          </Button>
        ) : null}
      </section>

      <section className="relative overflow-hidden rounded-lg border border-border bg-surface p-3 pl-4 shadow-panel sm:p-4 sm:pl-5">
        <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Bàn giao ca</h3>
        <p className="mt-0.5 text-xs text-muted">Luôn ghi — ca sau biết hệ 600 / 220 đang ổn hay còn việc phải canh.</p>
        <Label className="mt-3 block">Tình trạng chung khi giao ca</Label>
        <Pills
          wrap
          value={draft.Ban_giao_tinh_trang}
          onChange={(v) => {
            onHandoverTyped();
            onDraft({ ...draft, Ban_giao_tinh_trang: v as HandoverStatus });
          }}
          options={[
            { value: "BINH_THUONG", label: HANDOVER_STATUS_LABEL.BINH_THUONG },
            { value: "CAN_THEO_DOI", label: HANDOVER_STATUS_LABEL.CAN_THEO_DOI },
            { value: "CO_VAN_DE", label: HANDOVER_STATUS_LABEL.CO_VAN_DE },
          ]}
        />
        <div className="mt-3">
          <Label>Việc cần theo dõi tiếp</Label>
          <Textarea
            className="mt-1 min-h-24"
            placeholder="Tự điền các việc Đang theo dõi / Chưa xử lý. Sửa thêm nếu cần (liều hóa chất, bùn nổi, chờ bảo trì…)."
            value={draft.Ban_giao_theo_doi}
            onChange={(e) => {
              onHandoverTyped();
              onDraft({ ...draft, Ban_giao_theo_doi: e.target.value });
            }}
          />
          {!handoverLocked ? (
            <p className="mt-1 text-[11px] text-dim">Đang tự điền từ bất thường chưa xong — gõ vào ô là giữ nguyên lời ca trực.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
