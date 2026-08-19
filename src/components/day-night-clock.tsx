import { useEffect, useId, useState } from "react";
import { fmtNum } from "@/lib/format";

const CX = 100;
const CY = 100;

function deg(hour12: number) {
  return (hour12 / 12) * 2 * Math.PI - Math.PI / 2;
}

function pt(hour12: number, r: number) {
  const a = deg(hour12);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function wedge(fromH: number, toH: number, r: number) {
  const start = pt(fromH % 12, r);
  const end = pt(toH % 12, r);
  let span = (toH % 12) - (fromH % 12);
  if (span <= 0) span += 12;
  const large = span > 6 ? 1 : 0;
  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

function rim(fromH: number, toH: number, r: number) {
  const start = pt(fromH % 12, r);
  const end = pt(toH % 12, r);
  let span = (toH % 12) - (fromH % 12);
  if (span <= 0) span += 12;
  const large = span > 6 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

export function DayNightClock({
  day,
  night,
}: {
  day: number | null | undefined;
  night: number | null | undefined;
  dayNote?: string;
  nightNote?: string;
}) {
  const faceId = useId();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const h = (now.getHours() % 12) + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const m = now.getMinutes() + now.getSeconds() / 60;
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const hourPt = pt(h, 48);
  const minPt = pt(m / 5, 68);
  const secPt = pt(s / 5, 72);

  return (
    <div className="dn-clock shrink-0">
      <svg viewBox="0 0 200 200" className="dn-clock-svg shrink-0" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <radialGradient id={faceId} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="var(--color-surface2)" />
            <stop offset="100%" stopColor="var(--color-surface)" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r="96" className="dn-bezel" />
        <circle cx={CX} cy={CY} r="88" fill={`url(#${faceId})`} className="dn-face" />
        <path d={wedge(7.5, 5.5, 78)} className="dn-wedge-day" />
        <path d={rim(7.5, 5.5, 82)} className="dn-rim-day" />
        <path d={rim(5.5, 7.5, 82)} className="dn-rim-night" />
        {Array.from({ length: 60 }, (_, i) => {
          const hour = i / 5;
          const major = i % 5 === 0;
          const a = pt(hour, major ? 74 : 78);
          const b = pt(hour, 84);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={major ? "dn-tick-h" : "dn-tick-m"}
            />
          );
        })}
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => {
          const p = pt(n === 12 ? 0 : n, 62);
          return (
            <text key={n} x={p.x} y={p.y} className="dn-num">
              {n}
            </text>
          );
        })}
        <line x1={CX} y1={CY} x2={hourPt.x} y2={hourPt.y} className="dn-hand-h" />
        <line x1={CX} y1={CY} x2={minPt.x} y2={minPt.y} className="dn-hand-m" />
        <line x1={CX} y1={CY} x2={secPt.x} y2={secPt.y} className="dn-hand-s" />
        <circle cx={CX} cy={CY} r="3.5" className="dn-cap" />
      </svg>
      <div className="dn-clock-legend">
        <div>
          <div className="dn-clock-leg-label">
            <span className="dn-clock-swatch dn-clock-swatch-day" />
            Ban ngày
          </div>
          <div className="dn-clock-leg-val">
            {fmtNum(day)} <span>m³</span>
          </div>
        </div>
        <div>
          <div className="dn-clock-leg-label">
            <span className="dn-clock-swatch dn-clock-swatch-night" />
            Ban đêm
          </div>
          <div className="dn-clock-leg-val">
            {fmtNum(night)} <span>m³</span>
          </div>
        </div>
      </div>
    </div>
  );
}
