import { createFileRoute } from "@tanstack/react-router";
import { CSDL, DESIGN_SPECS, GPMT_FLOW, PERF_2023, PLANT_HYDRAULICS } from "@/lib/csdl";

export const Route = createFileRoute("/app/ai")({ component: AiPage });

const ITEMS = [
  `Thiết kế: hệ 600 oxy ${DESIGN_SPECS[0].he600}, hệ 220 ${DESIGN_SPECS[0].he220}. Bùn tuần hoàn 60%, nitrat 100%.`,
  `Thủy lực: ĐH 600 = ${PLANT_HYDRAULICS.eq600} m³, ĐH 220 = ${PLANT_HYDRAULICS.eq220} m³, lưu ${PLANT_HYDRAULICS.retentionHours} giờ. Bơm trung chuyển bật ${PLANT_HYDRAULICS.transferOn}.`,
  `Xả thải thực tế GPMT: 2022 TB ${GPMT_FLOW.y2022.avg} / max ${GPMT_FLOW.y2022.max}; 2023 TB ${GPMT_FLOW.y2023.avg} / max ${GPMT_FLOW.y2023.max} m³/ngày.`,
  "Tần suất đo: Amoni 3 lần/tuần, COD 1 lần/tuần — chứng kiến nhân viên Bệnh viện (E-HSMT).",
  "SV30 < 250 ml/L: bổ sung bùn hoạt tính (E-HSMT).",
  `Hiệu suất 2023: COD ${PERF_2023[1].hs}%, Amoni ${PERF_2023[3].hs}% — 4/4 đợt đạt QCVN cột B.`,
];

function AiPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="inline-block rounded-full border border-border bg-surface2 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          Hồ sơ nguồn
        </p>
        <h2 className="mt-4 text-2xl font-medium tracking-tight">Trợ lý hồ sơ vận hành</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Không sinh câu trả lời tự do. Chỉ nêu số đã chốt trong {CSDL.name} ({CSDL.version}, {CSDL.dated}).
        </p>
        <ul className="mt-6 space-y-3">
          {ITEMS.map((t) => (
            <li key={t} className="flex gap-3 text-sm text-muted">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <aside className="overflow-hidden rounded-xl border border-border bg-surface">
        <img src="/lab-still.jpg" alt="" className="aspect-[4/3] w-full object-cover" />
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-dim">Nguồn đang dùng</p>
          <p className="mt-1 text-sm text-muted">
            {CSDL.name} · {CSDL.version} · {CSDL.equipments} thiết bị · {CSDL.thresholds} ngưỡng
          </p>
        </div>
      </aside>
    </div>
  );
}
