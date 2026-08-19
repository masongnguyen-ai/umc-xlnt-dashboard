/**
 * Kết nối Google Sheets (server-only) — hai spreadsheet riêng.
 *
 * 1. Não chính (CSDL vận hành): USERS, CHEMICALS, CHEM_STOCKS, …
 * 2. Lưu lượng: chỉ ĐỌC tab DASHBOARD_DATA — không ghi đè 3 đồng hồ.
 *
 * Import từ createServerFn / loader / *.server.ts. Không import từ client.
 */
import { createPrivateKey } from "node:crypto";
import { google, type sheets_v4 } from "googleapis";

/** Não chính — CSDL vận hành trạm XLNT. */
export const MAIN_SHEET_ID = "19AjFW1cBD5JdfMexo83bTV4LQV_0QlDEj_TUNMTze4k";

/** Sheet lưu lượng 3 đồng hồ (tab DASHBOARD_DATA). */
export const FLOW_SHEET_ID = "1ZP0vWoIz_hDdUrbnVqCn06zRdKwXqpKnpwtU9V0aT1o";

export const FLOW_TAB = "DASHBOARD_DATA";

/** Tab thường dùng trên não chính (không bắt buộc đủ so với file thật). */
export const MAIN_TABS = [
  "USERS",
  "CONFIGS",
  "THRESHOLDS",
  "OP_LOGS",
  "CHEMICALS",
  "CHEM_STOCKS",
  "CHEM_TRANSACTIONS",
  "CHEM_NHAP",
  "CHEM_LIEU",
  "CHEM_TON",
  "AUDIT_SO",
  "NHAT_KY",
  "HOA_CHAT_LIEU",
  "HOA_CHAT_NHAP",
  "HOA_CHAT_DIEU_DONG",
  "SU_CO_TB",
  "BAO_TRI_TB",
  "LOGIN_LOG",
  "EQUIPMENTS",
  "EQP_MAINTENANCES",
  "EQP_INCIDENTS",
  "REPORTS",
  "ALERTS",
  "ACCESS_LOGS",
] as const;

/** Ô trên sheet: chuỗi, số, boolean hoặc trống. */
export type SheetCell = string | number | boolean | null;

export class GoogleSheetsError extends Error {
  readonly status = 500;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GoogleSheetsError";
  }
}

let cachedClient: sheets_v4.Sheets | null = null;

function env(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new GoogleSheetsError(`Thiếu biến môi trường ${name}.`);
  return v;
}

/**
 * PEM trên Vercel hay bị dán một dòng, `\\n` thoát đôi, hoặc mất xuống dòng.
 * OpenSSL 3 (Node 22) khi đó báo `DECODER routines::unsupported`.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim().replace(/^\uFEFF/, "");
  if (key.startsWith('"') && key.endsWith('"')) {
    try {
      key = JSON.parse(key) as string;
    } catch {
      key = key.slice(1, -1);
    }
  } else if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  for (let i = 0; i < 4 && key.includes("\\n"); i++) key = key.replace(/\\n/g, "\n");
  key = key.replace(/\\r/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const begin = key.match(/-----BEGIN ([A-Z0-9 ]+KEY)-----/);
  const end = key.match(/-----END ([A-Z0-9 ]+KEY)-----/);
  if (!begin?.[1] || !end?.[1] || begin[1] !== end[1]) return key;

  const start = key.indexOf(begin[0]) + begin[0].length;
  const stop = key.lastIndexOf(end[0]);
  if (stop <= start) return key;
  const body = key.slice(start, stop).replace(/[^A-Za-z0-9+/=]/g, "");
  if (!body) return key;
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `${begin[0]}\n${wrapped}\n${end[0]}\n`;
}

function assertId(spreadsheetId: string): string {
  const id = spreadsheetId.trim();
  if (!id) throw new GoogleSheetsError("Thiếu spreadsheetId.");
  return id;
}

function assertTab(sheetName: string): string {
  const name = sheetName.trim();
  if (!name) throw new GoogleSheetsError("Thiếu tên tab.");
  return name;
}

function isFlowSpreadsheet(id: string): boolean {
  return assertId(id) === FLOW_SHEET_ID;
}

/** Ghi (append/update/clear) không được đụng sheet lưu lượng. */
function assertWritable(spreadsheetId: string) {
  if (isFlowSpreadsheet(spreadsheetId)) {
    throw new GoogleSheetsError(
      "Sheet lưu lượng chỉ đọc. Dùng getDashboardData() cho DASHBOARD_DATA; ghi số vận hành trên não chính.",
    );
  }
}

function assertRow(values: SheetCell[]) {
  if (!Array.isArray(values)) throw new GoogleSheetsError("values phải là mảng.");
}

/** A1: 'USERS'!A:ZZ — escape dấu nháy trong tên tab. */
function tabRange(sheetName: string, cells = "A:ZZ"): string {
  const name = assertTab(sheetName);
  return `'${name.replace(/'/g, "''")}'!${cells}`;
}

/**
 * Range đầy đủ: `USERS!A2:F2` hoặc `'CHEM TON'!A2`.
 * Nếu chưa có `!` thì báo lỗi (cần tên tab).
 */
function fullRange(range: string): string {
  const trimmed = range.trim();
  if (!trimmed) throw new GoogleSheetsError("Thiếu range A1.");
  const bang = trimmed.indexOf("!");
  if (bang === -1) {
    throw new GoogleSheetsError('range phải kèm tên tab, ví dụ "USERS!A2:F2".');
  }
  const sheet = trimmed.slice(0, bang).replace(/^'+|'+$/g, "");
  const cells = trimmed.slice(bang + 1).trim();
  if (!cells) throw new GoogleSheetsError("Range thiếu phần ô (A2:F2).");
  return tabRange(sheet, cells);
}

function getAuth() {
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = normalizePrivateKey(env("GOOGLE_PRIVATE_KEY"));
  if (!/BEGIN [A-Z0-9 ]+KEY/.test(key) || !/END [A-Z0-9 ]+KEY/.test(key)) {
    throw new GoogleSheetsError("GOOGLE_PRIVATE_KEY không phải PEM đầy đủ (thiếu BEGIN/END PRIVATE KEY).");
  }
  try {
    createPrivateKey(key);
  } catch (err) {
    throw new GoogleSheetsError(
      "GOOGLE_PRIVATE_KEY không đọc được (PEM). Dán lại PKCS#8, xuống dòng ghi \\n.",
      { cause: err },
    );
  }
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

/** Auth Service Account — Sheets + Drive (ảnh chứng minh). */
export function getGoogleAuth() {
  return getAuth();
}

function getSheets(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  cachedClient = google.sheets({ version: "v4", auth: getAuth() });
  return cachedClient;
}

function logErr(action: string, err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[google-sheets] ${action}: ${detail}`);
}

function isQuotaErr(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return /Quota exceeded|rateLimitExceeded|RESOURCE_EXHAUSTED/i.test(detail);
}

function wrap(err: unknown, action: string): never {
  logErr(action, err);
  if (err instanceof GoogleSheetsError) throw err;
  const detail = err instanceof Error ? err.message : String(err);
  if (/DECODER routines::unsupported|error:1E08010C/i.test(detail)) {
    throw new GoogleSheetsError(
      `${action}: khóa GOOGLE_PRIVATE_KEY trên máy chủ không đọc được (PEM). Dán lại PKCS#8, xuống dòng ghi \\n.`,
      { cause: err },
    );
  }
  if (isQuotaErr(err)) {
    throw new GoogleSheetsError(
      `${action}: Google Sheets tạm quá lượt đọc (60/phút). Đợi khoảng 1 phút rồi bấm Làm mới.`,
      { cause: err },
    );
  }
  throw new GoogleSheetsError(`${action}: ${detail}`, { cause: err });
}

async function sheetsCall<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isQuotaErr(err)) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        return await fn();
      } catch (err2) {
        wrap(err2, action);
      }
    }
    wrap(err, action);
  }
}

/** Đọc toàn bộ ô có dữ liệu của một tab (kèm hàng tiêu đề). */
export async function getSheetData(spreadsheetId: string, sheetName: string): Promise<SheetCell[][]> {
  const id = assertId(spreadsheetId);
  const tab = assertTab(sheetName);
  return sheetsCall(`Không đọc được ${id.slice(0, 8)}… / ${tab}`, async () => {
    const res = await getSheets().spreadsheets.values.get({
      spreadsheetId: id,
      range: tabRange(tab),
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    return (res.data.values ?? []) as SheetCell[][];
  });
}

/** Thêm một dòng mới vào cuối tab (não chính). */
export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: SheetCell[],
): Promise<{ updatedRange: string; updatedRows: number }> {
  const id = assertId(spreadsheetId);
  const tab = assertTab(sheetName);
  try {
    assertWritable(id);
    assertRow(values);
    const res = await getSheets().spreadsheets.values.append({
      spreadsheetId: id,
      range: tabRange(tab, "A:ZZ"),
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
    const u = res.data.updates;
    return {
      updatedRange: u?.updatedRange ?? "",
      updatedRows: Number(u?.updatedRows ?? 0),
    };
  } catch (err) {
    wrap(err, `Không thêm dòng ${tab}`);
  }
}

/**
 * Cập nhật theo range A1 kèm tên tab, ví dụ `USERS!A2:F2`.
 * Không ghi sheet lưu lượng.
 */
export async function updateRow(
  spreadsheetId: string,
  range: string,
  values: SheetCell[],
): Promise<{ updatedRange: string; updatedRows: number }> {
  const id = assertId(spreadsheetId);
  try {
    assertWritable(id);
    assertRow(values);
    const a1 = fullRange(range);
    const res = await getSheets().spreadsheets.values.update({
      spreadsheetId: id,
      range: a1,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
    return {
      updatedRange: res.data.updatedRange ?? "",
      updatedRows: Number(res.data.updatedRows ?? 0),
    };
  } catch (err) {
    wrap(err, `Không cập nhật ${range}`);
  }
}

/** Xóa dữ liệu từ hàng 2, giữ header — chỉ não chính. */
export async function clearSheet(spreadsheetId: string, sheetName: string): Promise<void> {
  const id = assertId(spreadsheetId);
  const tab = assertTab(sheetName);
  try {
    assertWritable(id);
    await getSheets().spreadsheets.values.clear({
      spreadsheetId: id,
      range: tabRange(tab, "A2:ZZ"),
    });
  } catch (err) {
    wrap(err, `Không xóa dữ liệu tab ${tab}`);
  }
}

/** Đọc tab DASHBOARD_DATA trên sheet lưu lượng (chỉ đọc). */
export async function getDashboardData(): Promise<SheetCell[][]> {
  return getSheetData(FLOW_SHEET_ID, FLOW_TAB);
}

/** Đọc một tab trên não chính. */
export async function getMainSheetData(sheetName: string): Promise<SheetCell[][]> {
  return getSheetData(MAIN_SHEET_ID, sheetName);
}

/** Thêm dòng trên não chính. */
export async function appendMainRow(sheetName: string, values: SheetCell[]) {
  return appendRow(MAIN_SHEET_ID, sheetName, values);
}

export async function appendMainRows(sheetName: string, rows: SheetCell[][]) {
  const id = MAIN_SHEET_ID;
  const tab = assertTab(sheetName);
  try {
    assertWritable(id);
    if (!rows.length) return { updatedRange: "", updatedRows: 0 };
    const res = await getSheets().spreadsheets.values.append({
      spreadsheetId: id,
      range: tabRange(tab, "A:ZZ"),
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
    const u = res.data.updates;
    return {
      updatedRange: u?.updatedRange ?? "",
      updatedRows: Number(u?.updatedRows ?? 0),
    };
  } catch (err) {
    wrap(err, `Không thêm dòng ${tab}`);
  }
}

let titlesCache: { at: number; titles: string[] } | null = null;
let titlesInflight: Promise<string[]> | null = null;
const TITLES_TTL_MS = 5 * 60 * 1000;

function rememberTitles(titles: string[]) {
  titlesCache = { at: Date.now(), titles };
}

export async function listMainTabTitles(force = false): Promise<string[]> {
  if (!force && titlesCache && Date.now() - titlesCache.at < TITLES_TTL_MS) {
    return titlesCache.titles;
  }
  if (titlesInflight) return titlesInflight;
  titlesInflight = sheetsCall("Không liệt kê tab não chính", async () => {
    const res = await getSheets().spreadsheets.get({
      spreadsheetId: MAIN_SHEET_ID,
      fields: "sheets.properties.title",
    });
    const titles = (res.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
    rememberTitles(titles);
    return titles;
  }).finally(() => {
    titlesInflight = null;
  });
  return titlesInflight;
}

/** Đọc nhiều tab não chính trong một request (tránh hết hạn mức 60 đọc/phút). */
export async function getMainSheetsData(sheetNames: string[]): Promise<Record<string, SheetCell[][]>> {
  const tabs = sheetNames.map(assertTab);
  if (!tabs.length) return {};
  return sheetsCall("Không đọc được tab não chính", async () => {
    const res = await getSheets().spreadsheets.values.batchGet({
      spreadsheetId: MAIN_SHEET_ID,
      ranges: tabs.map((tab) => tabRange(tab)),
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const out: Record<string, SheetCell[][]> = {};
    for (let i = 0; i < tabs.length; i++) {
      out[tabs[i]!] = (res.data.valueRanges?.[i]?.values ?? []) as SheetCell[][];
    }
    return out;
  });
}

/** Tạo tab + header nếu chưa có. Không xóa dữ liệu cũ. Tab đã có thì không đọc lại. */
export async function ensureMainTab(title: string, headers: string[]): Promise<void> {
  const tab = assertTab(title);
  assertWritable(MAIN_SHEET_ID);
  const titles = await listMainTabTitles();
  if (titles.includes(tab)) return;
  try {
    await sheetsCall(`Không tạo tab ${tab}`, async () => {
      await getSheets().spreadsheets.batchUpdate({
        spreadsheetId: MAIN_SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
    });
    rememberTitles([...titles, tab]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate/i.test(detail)) throw err;
    titlesCache = null;
    return;
  }
  await appendMainRow(tab, headers);
}
