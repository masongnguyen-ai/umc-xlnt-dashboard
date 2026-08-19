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
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Hồ sơ nguồn</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Trợ lý hồ sơ vận hành</h2>
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
      <aside className="relative overflow-hidden rounded-lg border border-border bg-surface p-5 pl-6 shadow-panel">
        <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Hồ sơ trạm</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">Trạm XLNT UMC</h3>
        <p className="mt-1 text-sm text-muted">Bệnh viện Đại học Y Dược TP.HCM</p>
        <dl className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <dt className="kpi-label tracking-[0.14em]">Công suất</dt>
            <dd className="kpi-value mt-1">
              {CSDL.capacity}
              <span className="kpi-unit">m³/ngày</span>
            </dd>
          </div>
          <div>
            <dt className="kpi-label tracking-[0.14em]">Quy chuẩn</dt>
            <dd className="mt-1 text-sm font-semibold tracking-tight">{CSDL.qcvn}</dd>
          </div>
          <div>
            <dt className="kpi-label tracking-[0.14em]">Thiết bị</dt>
            <dd className="kpi-value mt-1">
              {CSDL.equipments}
              <span className="kpi-unit">hạng mục</span>
            </dd>
          </div>
          <div>
            <dt className="kpi-label tracking-[0.14em]">Ngưỡng</dt>
            <dd className="kpi-value mt-1">
              {CSDL.thresholds}
              <span className="kpi-unit">quy tắc</span>
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-dim">
          {CSDL.name} · {CSDL.version} · {CSDL.dated}
          <span className="mt-1 block">Nhà thầu {CSDL.contractor} · hai hệ 600 + 220</span>
        </p>
      </aside>
    </div>
  );
}
