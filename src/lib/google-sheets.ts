/**
 * Kết nối Google Sheets (server-only) — hai spreadsheet riêng.
 *
 * 1. Não chính (CSDL vận hành): USERS, CHEMICALS, CHEM_STOCKS, …
 * 2. Lưu lượng: chỉ ĐỌC tab DASHBOARD_DATA — không ghi đè 3 đồng hồ.
 *
 * Import từ createServerFn / loader / *.server.ts. Không import từ client.
 */
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

/** PEM trong .env thường ghi \\n — đổi thành xuống dòng thật. */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
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
  if (!key.includes("BEGIN PRIVATE KEY") || !key.includes("END PRIVATE KEY")) {
    throw new GoogleSheetsError("GOOGLE_PRIVATE_KEY không phải PEM đầy đủ (thiếu BEGIN/END PRIVATE KEY).");
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

function wrap(err: unknown, action: string): never {
  logErr(action, err);
  if (err instanceof GoogleSheetsError) throw err;
  const detail = err instanceof Error ? err.message : String(err);
  throw new GoogleSheetsError(`${action}: ${detail}`, { cause: err });
}

/** Đọc toàn bộ ô có dữ liệu của một tab (kèm hàng tiêu đề). */
export async function getSheetData(spreadsheetId: string, sheetName: string): Promise<SheetCell[][]> {
  const id = assertId(spreadsheetId);
  const tab = assertTab(sheetName);
  try {
    const res = await getSheets().spreadsheets.values.get({
      spreadsheetId: id,
      range: tabRange(tab),
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    return (res.data.values ?? []) as SheetCell[][];
  } catch (err) {
    wrap(err, `Không đọc được ${id.slice(0, 8)}… / ${tab}`);
  }
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

export async function listMainTabTitles(): Promise<string[]> {
  try {
    const res = await getSheets().spreadsheets.get({
      spreadsheetId: MAIN_SHEET_ID,
      fields: "sheets.properties.title",
    });
    return (res.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
  } catch (err) {
    wrap(err, "Không liệt kê tab não chính");
  }
}

/** Tạo tab + header nếu chưa có. Không xóa dữ liệu cũ. */
export async function ensureMainTab(title: string, headers: string[]): Promise<void> {
  const tab = assertTab(title);
  assertWritable(MAIN_SHEET_ID);
  const titles = await listMainTabTitles();
  if (!titles.includes(tab)) {
    try {
      await getSheets().spreadsheets.batchUpdate({
        spreadsheetId: MAIN_SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
    } catch (err) {
      wrap(err, `Không tạo tab ${tab}`);
    }
    await appendMainRow(tab, headers);
    return;
  }
  const rows = await getMainSheetData(tab);
  if (!rows.length) await appendMainRow(tab, headers);
}
