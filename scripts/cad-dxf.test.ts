import assert from "node:assert/strict";
import test from "node:test";
import { detectCadFile, parseDxf, writeDxf, DxfError } from "../src/lib/cad/dxf.ts";
import { buildPlantPid, plantDxfText, plantPins } from "../src/lib/cad/plant-pid.ts";
import { pinsFromDxf } from "../src/lib/cad/pins.ts";

const SAMPLE = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
0
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
CIRCLE
8
THIET-BI
10
4
20
2
40
3
0
ENDSEC
0
EOF
`;

test("detects DWG vs DXF", () => {
  assert.equal(detectCadFile(SAMPLE), "DXF");
  assert.equal(detectCadFile("AC1027\0binary"), "DWG");
});

test("parseDxf reads LINE CIRCLE TEXT", () => {
  const doc = parseDxf(SAMPLE);
  assert.equal(doc.entities.length, 3);
  const line = doc.entities.find((e) => e.type === "LINE");
  assert.ok(line && line.type === "LINE");
  if (line?.type === "LINE") {
    assert.equal(line.x2, 10);
    assert.equal(line.y2, 5);
  }
  const pins = pinsFromDxf(doc);
  assert.equal(pins.length, 1);
  assert.equal(pins[0]?.equipmentId, "TB-600-01");
});

test("parseDxf rejects DWG with a Vietnamese hint", () => {
  assert.throws(() => parseDxf("AC1024...."), (err: unknown) => err instanceof DxfError && /DWG/.test((err as Error).message));
});

test("writeDxf round-trips a LINE", () => {
  const text = writeDxf({
    version: "AC1015",
    layers: [{ name: "0", color: 7, frozen: false }],
    entities: [{ type: "LINE", layer: "0", color: 256, x1: 1, y1: 2, x2: 3, y2: 4 }],
    extMin: { x: 1, y: 2 },
    extMax: { x: 3, y: 4 },
  });
  const again = parseDxf(text);
  assert.equal(again.entities[0]?.type, "LINE");
});

test("plant P&ID exports every equipment tag and re-parses", () => {
  const pins = plantPins();
  assert.equal(pins.length, 34);
  const ids = new Set(pins.map((p) => p.equipmentId));
  assert.ok(ids.has("TB-600-01"));
  assert.ok(ids.has("TB-220-18"));
  const text = plantDxfText();
  assert.match(text, /AC1015/);
  assert.match(text, /TB-600-14/);
  assert.match(text, /TB-220-18/);
  const doc = parseDxf(text);
  assert.ok(doc.entities.length > 50);
  const fromText = pinsFromDxf(doc);
  assert.equal(fromText.length, 34);
  assert.equal(buildPlantPid().layers.some((l) => l.name === "HE-600"), true);
});
