import assert from "node:assert/strict";
import test from "node:test";

const FLOW_MARKERS = [
  "2PACX-1vTVjo2dh9Qd0mleS94_5LYzM-ju1wuJunMZohkLavn03i6W78IKwWOIUEsa6FEEH2UTpB8ee8XHWeoo",
  "gid=1963700720",
  "DASHBOARD_DATA",
];

function assertNotFlowSheet(url) {
  const lower = url.toLowerCase();
  for (const m of FLOW_MARKERS) {
    if (lower.includes(m.toLowerCase())) {
      throw new Error("Từ chối: webhook trỏ nhầm sheet lưu lượng.");
    }
  }
}

test("ChemBridge rejects the published flow sheet URL", () => {
  assert.throws(() => {
    assertNotFlowSheet(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTVjo2dh9Qd0mleS94_5LYzM-ju1wuJunMZohkLavn03i6W78IKwWOIUEsa6FEEH2UTpB8ee8XHWeoo/pub?output=csv&gid=1963700720",
    );
  });
  assert.doesNotThrow(() => {
    assertNotFlowSheet("https://script.google.com/macros/s/AKfycbxChemBridgeOnly/exec");
  });
});
