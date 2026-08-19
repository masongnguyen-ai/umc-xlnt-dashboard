/**
 * Ghi 1 nhật ký + 1 liều CHO_DUYET, đọc lại, rồi chốt DA_CHOT.
 * Chạy: npx tsx scripts/ops-sheet-selftest.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(file: string) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv(resolve(import.meta.dirname, "../.env.local"));
loadDotEnv(resolve(import.meta.dirname, "../.env"));

const sa = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
if (!sa || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error("FAIL: thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY.");
  process.exit(1);
}

const { appendMainRow, appendMainRows, ensureMainTab, getMainSheetData } = await import("../src/lib/google-sheets.ts");

const NHAT_KY = [
  "Log_ID",
  "Iso",
  "Ca",
  "Nguoi_nhap",
  "Email",
  "Chuc_vu",
  "Noi_dung",
  "Checklist_JSON",
  "Trang_thai",
  "Nguoi_duyet",
  "Luc_duyet",
  "Ghi_chu_duyet",
];
const HOA_CHAT_LIEU = [
  "Dose_ID",
  "Iso",
  "Chat",
  "Lieu_ke_hoach",
  "Lieu_thuc_te",
  "Don_vi",
  "Nguoi_cham",
  "Email",
  "Trang_thai",
  "Nguoi_duyet",
  "Luc_duyet",
];

const CHEMS = [
  { key: "matri", label: "Mật rỉ đường", unit: "kg" },
  { key: "naoh", label: "NaOH ≥98%", unit: "kg" },
  { key: "javen", label: "Javen 10%", unit: "kg" },
  { key: "nahco3", label: "NaHCO₃", unit: "kg" },
  { key: "micro", label: "Microbelift", unit: "gallon" },
];

function lastStatus(rows: unknown[][], id: string, idCol: number, statusCol: number) {
  let found: string | null = null;
  for (const row of rows.slice(1)) {
    if (String(row[idCol] ?? "").trim() === id) found = String(row[statusCol] ?? "");
  }
  return found;
}

function lastDoseStatus(rows: unknown[][], iso: string) {
  let found: string | null = null;
  for (const row of rows.slice(1)) {
    if (String(row[1] ?? "").trim() === iso) found = String(row[8] ?? "");
  }
  return found;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const logId = `LOG-SELFTEST-${stamp}`;
const iso = "2099-12-31";
const now = new Date().toISOString();

try {
  await ensureMainTab("NHAT_KY", NHAT_KY);
  await ensureMainTab("HOA_CHAT_LIEU", HOA_CHAT_LIEU);

  await appendMainRow("NHAT_KY", [
    logId,
    iso,
    "SANG",
    "SELFTEST",
    sa,
    "CA_TRUC",
    JSON.stringify({ Tinh_trang_he_thong: "SELFTEST" }),
    "",
    "CHO_DUYET",
    "",
    "",
    "",
  ]);
  await appendMainRows(
    "HOA_CHAT_LIEU",
    CHEMS.map((c) => [
      `${iso}__${c.key}`,
      iso,
      c.label,
      0,
      c.key === "matri" ? 0.01 : 0,
      c.unit,
      "SELFTEST",
      sa,
      "CHO_DUYET",
      "",
      "",
    ]),
  );

  const pendingLog = lastStatus(await getMainSheetData("NHAT_KY"), logId, 0, 8);
  const pendingDose = lastDoseStatus(await getMainSheetData("HOA_CHAT_LIEU"), iso);
  if (pendingLog !== "CHO_DUYET") throw new Error(`Nhật ký test không thấy CHO_DUYET (found=${pendingLog ?? "missing"})`);
  if (pendingDose !== "CHO_DUYET") throw new Error(`Liều test không thấy CHO_DUYET (found=${pendingDose ?? "missing"})`);
  console.log("PASS pending", { logId, iso, logStatus: pendingLog, doseStatus: pendingDose });

  await appendMainRow("NHAT_KY", [
    logId,
    iso,
    "SANG",
    "SELFTEST",
    sa,
    "QUAN_LY",
    JSON.stringify({ Tinh_trang_he_thong: "SELFTEST" }),
    "",
    "DA_CHOT",
    sa,
    now,
    "selftest chot",
  ]);
  await appendMainRows(
    "HOA_CHAT_LIEU",
    CHEMS.map((c) => [
      `${iso}__${c.key}`,
      iso,
      c.label,
      0,
      c.key === "matri" ? 0.01 : 0,
      c.unit,
      "SELFTEST",
      sa,
      "DA_CHOT",
      sa,
      now,
    ]),
  );

  const closedLog = lastStatus(await getMainSheetData("NHAT_KY"), logId, 0, 8);
  const closedDose = lastDoseStatus(await getMainSheetData("HOA_CHAT_LIEU"), iso);
  if (closedLog !== "DA_CHOT") throw new Error(`Nhật ký test chưa DA_CHOT (found=${closedLog ?? "missing"})`);
  if (closedDose !== "DA_CHOT") throw new Error(`Liều test chưa DA_CHOT (found=${closedDose ?? "missing"})`);
  console.log("PASS closed", { logId, iso, logStatus: closedLog, doseStatus: closedDose });
  console.log("OK — Sheet có dòng test CHO_DUYET rồi DA_CHOT.");
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("FAIL:", msg);
  if (msg.includes("403") || msg.toLowerCase().includes("permission")) {
    console.error(`Share Editor spreadsheet cho ${sa}`);
  }
  process.exit(1);
}
