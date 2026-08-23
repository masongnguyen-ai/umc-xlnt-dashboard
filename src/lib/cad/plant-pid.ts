import { DxfBuilder, writeDxf } from "./dxf";
import type { CadPin, DxfDoc } from "./types";

export const PLANT_DXF_NAME = "UMC_XLNT_SoDoCongNghe.dxf";

type Unit = {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  he: "HE-600" | "HE-220";
  tags: { id: string; dx: number; dy: number }[];
};

const U600: Unit[] = [
  {
    id: "S600",
    title: "Lược rác",
    x: 18,
    y: 198,
    w: 32,
    h: 40,
    he: "HE-600",
    tags: [{ id: "TB-600-14", dx: 16, dy: 12 }],
  },
  {
    id: "EQ600",
    title: "Bể điều hòa",
    x: 62,
    y: 188,
    w: 52,
    h: 54,
    he: "HE-600",
    tags: [
      { id: "TB-600-01", dx: 14, dy: 14 },
      { id: "TB-600-04", dx: 38, dy: 14 },
      { id: "TB-600-09", dx: 26, dy: 32 },
    ],
  },
  {
    id: "AX600",
    title: "Khuấy chìm",
    x: 126,
    y: 194,
    w: 36,
    h: 44,
    he: "HE-600",
    tags: [{ id: "TB-600-08", dx: 18, dy: 14 }],
  },
  {
    id: "AE600",
    title: "Hiếu khí giá thể",
    x: 174,
    y: 188,
    w: 52,
    h: 54,
    he: "HE-600",
    tags: [
      { id: "TB-600-05", dx: 14, dy: 14 },
      { id: "TB-600-10", dx: 38, dy: 32 },
    ],
  },
  {
    id: "CL600",
    title: "Bể lắng",
    x: 238,
    y: 188,
    w: 46,
    h: 54,
    he: "HE-600",
    tags: [
      { id: "TB-600-12", dx: 14, dy: 14 },
      { id: "TB-600-13", dx: 32, dy: 32 },
      { id: "TB-600-02", dx: 14, dy: 38 },
    ],
  },
  {
    id: "FC600",
    title: "Khống chế LL",
    x: 296,
    y: 198,
    w: 30,
    h: 40,
    he: "HE-600",
    tags: [{ id: "TB-600-11", dx: 15, dy: 12 }],
  },
  {
    id: "FL600",
    title: "Lọc áp lực",
    x: 338,
    y: 192,
    w: 40,
    h: 48,
    he: "HE-600",
    tags: [
      { id: "TB-600-16", dx: 12, dy: 14 },
      { id: "TB-600-03", dx: 28, dy: 30 },
    ],
  },
  {
    id: "DS600",
    title: "Khử trùng",
    x: 390,
    y: 192,
    w: 40,
    h: 48,
    he: "HE-600",
    tags: [
      { id: "TB-600-06", dx: 12, dy: 12 },
      { id: "TB-600-07", dx: 28, dy: 12 },
      { id: "TB-600-15", dx: 20, dy: 30 },
    ],
  },
];

const U220: Unit[] = [
  {
    id: "P220",
    title: "Hố thu gom",
    x: 18,
    y: 78,
    w: 34,
    h: 42,
    he: "HE-220",
    tags: [{ id: "TB-220-18", dx: 17, dy: 14 }],
  },
  {
    id: "PW220",
    title: "Bơm nước thải",
    x: 64,
    y: 78,
    w: 42,
    h: 42,
    he: "HE-220",
    tags: [
      { id: "TB-220-01", dx: 12, dy: 12 },
      { id: "TB-220-02", dx: 30, dy: 26 },
    ],
  },
  {
    id: "BIO220",
    title: "Bể sinh học 220",
    x: 118,
    y: 62,
    w: 72,
    h: 72,
    he: "HE-220",
    tags: [
      { id: "TB-220-04", dx: 14, dy: 14 },
      { id: "TB-220-05", dx: 40, dy: 14 },
      { id: "TB-220-06", dx: 58, dy: 14 },
      { id: "TB-220-07", dx: 36, dy: 32 },
      { id: "TB-220-08", dx: 14, dy: 50 },
      { id: "TB-220-09", dx: 36, dy: 50 },
      { id: "TB-220-10", dx: 58, dy: 50 },
      { id: "TB-220-11", dx: 14, dy: 62 },
    ],
  },
  {
    id: "CL220",
    title: "Bể lắng",
    x: 202,
    y: 70,
    w: 44,
    h: 56,
    he: "HE-220",
    tags: [{ id: "TB-220-13", dx: 22, dy: 20 }],
  },
  {
    id: "FL220",
    title: "Lọc áp lực",
    x: 258,
    y: 74,
    w: 40,
    h: 48,
    he: "HE-220",
    tags: [
      { id: "TB-220-03", dx: 12, dy: 14 },
      { id: "TB-220-17", dx: 28, dy: 30 },
    ],
  },
  {
    id: "DS220",
    title: "Định lượng",
    x: 310,
    y: 74,
    w: 42,
    h: 48,
    he: "HE-220",
    tags: [
      { id: "TB-220-12", dx: 12, dy: 14 },
      { id: "TB-220-14", dx: 30, dy: 30 },
    ],
  },
  {
    id: "FM220",
    title: "Đồng hồ LL",
    x: 364,
    y: 82,
    w: 32,
    h: 36,
    he: "HE-220",
    tags: [{ id: "TB-220-15", dx: 16, dy: 12 }],
  },
  {
    id: "OD220",
    title: "Hút mùi",
    x: 18,
    y: 132,
    w: 34,
    h: 28,
    he: "HE-220",
    tags: [{ id: "TB-220-16", dx: 17, dy: 10 }],
  },
];

function pumpSymbol(b: DxfBuilder, layer: string, x: number, y: number, r = 3.4) {
  b.circle(layer, x, y, r);
  b.line(layer, x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7);
  b.line(layer, x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7);
}

function connect(b: DxfBuilder, a: Unit, bUnit: Unit) {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = bUnit.x;
  const y2 = bUnit.y + bUnit.h / 2;
  const mid = (x1 + x2) / 2;
  b.poly("ONG", [
    { x: x1, y: y1 },
    { x: mid, y: y1 },
    { x: mid, y: y2 },
    { x: x2, y: y2 },
  ]);
  b.arrow("ONG", x2 - 8, y2, x2, y2, 2);
}

export function plantPins(): CadPin[] {
  const pins: CadPin[] = [];
  for (const u of [...U600, ...U220]) {
    for (const t of u.tags) {
      pins.push({ equipmentId: t.id, x: u.x + t.dx, y: u.y + t.dy });
    }
  }
  return pins;
}

export function buildPlantPid(): DxfDoc {
  const b = new DxfBuilder();
  const W = 448;
  const H = 297;

  b.rect("KHUNG", 4, 4, W, H);
  b.rect("KHUNG", 8, 8, W - 8, 28);
  b.text("TEXT", 14, 26, 5.2, "TRAM XLNT UMC  —  SO DO CONG NGHE  (P&ID)");
  b.text("GHICHU", 14, 16, 2.6, "Benh vien Dai hoc Y Duoc TP.HCM  |  Q = 820 m3/ngay  |  QCVN 28:2010 cot B, K=1  |  Xuat DXF de mo bang AutoCAD");
  b.text("GHICHU", 330, 16, 2.4, "Don vi: mm giay A3");

  b.text("HE-600", 18, 258, 4.2, "HE 600  —  600 m3/ngay");
  b.line("HE-600", 18, 254, 140, 254);
  for (const u of U600) {
    b.rect(u.he, u.x, u.y, u.w, u.h);
    b.text("TEXT", u.x + 2.2, u.y + u.h - 6.5, 2.4, u.title);
    for (const t of u.tags) {
      const px = u.x + t.dx;
      const py = u.y + t.dy;
      pumpSymbol(b, "THIET-BI", px, py, 3.1);
      b.text("THIET-BI", px + 4.2, py - 1.2, 2.15, t.id);
    }
  }
  for (let i = 0; i < U600.length - 1; i++) connect(b, U600[i]!, U600[i + 1]!);
  b.arrow("ONG", U600[7]!.x + U600[7]!.w, U600[7]!.y + U600[7]!.h / 2, U600[7]!.x + U600[7]!.w + 14, U600[7]!.y + U600[7]!.h / 2, 2.4);
  b.text("GHICHU", U600[7]!.x + U600[7]!.w + 2, U600[7]!.y + U600[7]!.h / 2 + 5, 2.2, "Ra nguon");

  b.text("HE-220", 18, 168, 4.2, "HE 220  —  220 m3/ngay");
  b.line("HE-220", 18, 164, 140, 164);
  for (const u of U220) {
    b.rect(u.he, u.x, u.y, u.w, u.h);
    b.text("TEXT", u.x + 2.2, u.y + u.h - 6.5, 2.4, u.title);
    for (const t of u.tags) {
      const px = u.x + t.dx;
      const py = u.y + t.dy;
      pumpSymbol(b, "THIET-BI", px, py, 3.1);
      b.text("THIET-BI", px + 4.2, py - 1.2, 2.15, t.id);
    }
  }
  const train220 = U220.filter((u) => u.id !== "OD220");
  for (let i = 0; i < train220.length - 1; i++) connect(b, train220[i]!, train220[i + 1]!);
  const last = train220[train220.length - 1]!;
  b.arrow("ONG", last.x + last.w, last.y + last.h / 2, last.x + last.w + 14, last.y + last.h / 2, 2.4);
  b.text("GHICHU", last.x + last.w + 2, last.y + last.h / 2 + 5, 2.2, "Ra nguon");

  b.poly("ONG", [
    { x: U220[0]!.x + U220[0]!.w / 2, y: U220[7]!.y },
    { x: U220[0]!.x + U220[0]!.w / 2, y: U220[0]!.y + U220[0]!.h },
  ]);

  b.text("GHICHU", 14, 10.5, 2.0, "X = bom/may  |  cyan = He 600  |  xanh la = He 220  |  34 ma TB-xxx khop module Thiet bi  |  OPEN trong AutoCAD");

  return b.doc();
}

export function plantDxfText(): string {
  return writeDxf(buildPlantPid());
}
