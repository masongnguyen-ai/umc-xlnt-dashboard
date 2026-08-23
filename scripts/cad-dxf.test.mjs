import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SAMPLE = `0
SECTION
2
ENTITIES
0
LINE
8
ONG
10
0
20
0
11
10
21
5
0
TEXT
8
THIET-BI
10
4
20
2
40
2.5
1
TB-600-01
0
ENDSEC
0
EOF
`;

function detectCadFile(raw) {
  if (raw.startsWith("AC10")) return "DWG";
  if (/^\s*0\s*\r?\nSECTION/m.test(raw) || raw.includes("ENTITIES")) return "DXF";
  return "UNKNOWN";
}

function parseEntities(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const ents = [];
  let cur = null;
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    const value = lines[i + 1] ?? "";
    if (code === 0) {
      if (cur) ents.push(cur);
      cur = { type: value.trim(), map: {} };
      continue;
    }
    if (!cur) continue;
    (cur.map[code] ??= []).push(value);
  }
  if (cur) ents.push(cur);
  return ents.filter((e) => ["LINE", "TEXT", "CIRCLE"].includes(e.type));
}

test("detects DWG vs DXF", () => {
  assert.equal(detectCadFile(SAMPLE), "DXF");
  assert.equal(detectCadFile("AC1027binary"), "DWG");
});

test("sample DXF exposes LINE and TB-600-01 text", () => {
  const ents = parseEntities(SAMPLE);
  assert.equal(ents.some((e) => e.type === "LINE" && e.map[11]?.[0] === "10"), true);
  assert.equal(ents.some((e) => e.type === "TEXT" && e.map[1]?.[0] === "TB-600-01"), true);
});

test("plant P&ID source pins all 34 equipment IDs", () => {
  const src = readFileSync(new URL("../src/lib/cad/plant-pid.ts", import.meta.url), "utf8");
  const ids = [...new Set([...src.matchAll(/TB-(?:600|220)-\d{2}/g)].map((m) => m[0]))];
  assert.equal(ids.length, 34, ids.join(","));
  assert.ok(ids.includes("TB-600-01"));
  assert.ok(ids.includes("TB-220-18"));
});

test("DXF writer emits AutoCAD R2000 ASCII", () => {
  const src = readFileSync(new URL("../src/lib/cad/dxf.ts", import.meta.url), "utf8");
  assert.match(src, /AC1015/);
  assert.match(src, /LWPOLYLINE/);
  assert.match(src, /pair\(0, "EOF"\)/);
  assert.match(src, /DWG/);
});
