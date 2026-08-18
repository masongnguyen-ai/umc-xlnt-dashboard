/**
 * Đọc thử USERS (não chính) và DASHBOARD_DATA (lưu lượng).
 * Chạy: npx tsx scripts/probe-sheets.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(file: string) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.error("Không đọc được", file);
    process.exit(1);
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv(resolve(import.meta.dirname, "../.env.local"));

const { getMainSheetData, getDashboardData } = await import("../src/lib/google-sheets.ts");

function preview(label: string, rows: unknown[][]) {
  console.log(`\n=== ${label}: ${rows.length} hàng ===`);
  console.log(JSON.stringify(rows.slice(0, 8), null, 2));
}

try {
  const users = await getMainSheetData("USERS");
  preview("USERS (não chính)", users);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("\n=== USERS thất bại ===\n", msg);
}

try {
  const flow = await getDashboardData();
  preview("DASHBOARD_DATA (lưu lượng)", flow);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("\n=== DASHBOARD_DATA thất bại ===\n", msg);
}
