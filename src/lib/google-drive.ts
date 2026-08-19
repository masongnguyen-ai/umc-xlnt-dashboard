/**
 * Ảnh chứng minh → cây Drive UMC_XLNT/03_Anh_chung_minh/…
 * Server-only. Cùng Service Account với Sheets.
 */
import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleAuth, getMainSheetData, GoogleSheetsError, MAIN_SHEET_ID, appendMainRow } from "@/lib/google-sheets";
import { driveViewUrl, evidenceSubpath, type EvidenceKind } from "@/lib/drive-tree";
import { uid } from "@/lib/utils";

const FOLDER_PLACEHOLDER = "[Dán ID Thư mục Drive lưu ảnh vào đây]";
const MAX_BYTES = 8_000_000;
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DrivePhoto = {
  id: string;
  name: string;
  url: string;
  driveId: string;
  bytes: number;
};

function dataUrlToBuffer(dataUrl: string): { mime: string; buf: Buffer } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new GoogleSheetsError("Ảnh không đúng định dạng.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_BYTES) throw new GoogleSheetsError("Ảnh vượt 8 MB.");
  return { mime: m[1] || "image/jpeg", buf };
}

async function folderFromConfigs(): Promise<string> {
  const envId = (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "").trim();
  if (envId) return envId;
  try {
    const rows = await getMainSheetData("CONFIGS");
    for (const row of rows.slice(1)) {
      const key = String(row[0] ?? "").trim();
      if (key === "DRIVE_ROOT_ID" || key === "UPLOAD_FOLDER_ID") {
        const v = String(row[1] ?? "").trim();
        if (v && v !== FOLDER_PLACEHOLDER) return v;
      }
    }
  } catch {
    /* CONFIGS chưa đọc được */
  }
  return "";
}

function driveClient() {
  return google.drive({ version: "v3", auth: getGoogleAuth() });
}

async function childFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string,
): Promise<string> {
  const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const found = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = found.data.files?.[0]?.id;
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id;
  if (!id) throw new GoogleSheetsError(`Không tạo được thư mục ${name}.`);
  return id;
}

async function ensureRoot(drive: ReturnType<typeof google.drive>) {
  let folderId = await folderFromConfigs();
  if (folderId) return folderId;
  const found = await drive.files.list({
    q: "name = 'UMC_XLNT' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (found.data.files?.[0]?.id) return found.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: "UMC_XLNT", mimeType: FOLDER_MIME },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id;
  if (!id) throw new GoogleSheetsError("Không tạo được thư mục gốc UMC_XLNT trên Drive.");
  return id;
}

async function evidenceFolder(kind: EvidenceKind) {
  const drive = driveClient();
  const root = await ensureRoot(drive);
  const anh = await childFolder(drive, root, "03_Anh_chung_minh");
  const type = await childFolder(drive, anh, evidenceSubpath(kind));
  const month = new Date().toISOString().slice(0, 7);
  return childFolder(drive, type, month);
}

export async function uploadEvidencePhoto(input: {
  name: string;
  dataUrl: string;
  kind?: EvidenceKind;
}): Promise<DrivePhoto> {
  const { mime, buf } = dataUrlToBuffer(input.dataUrl);
  const drive = driveClient();
  const folderId = await evidenceFolder(input.kind ?? "su_co");
  const safeName = (input.name || "anh-chung-minh.jpg").replace(/[^\w.\-À-ỹ ]+/g, "_");
  const created = await drive.files.create({
    requestBody: {
      name: `${new Date().toISOString().slice(0, 10)}_${safeName}`,
      parents: [folderId],
    },
    media: {
      mimeType: mime.startsWith("image/") ? mime : "image/jpeg",
      body: Readable.from(buf),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const driveId = created.data.id;
  if (!driveId) throw new GoogleSheetsError("Drive không trả ID tệp.");
  try {
    await drive.permissions.create({
      fileId: driveId,
      requestBody: { type: "anyone", role: "reader" },
      supportsAllDrives: true,
    });
  } catch {
    /* Shared Drive có thể không cho anyone */
  }
  return {
    id: uid("PIC"),
    name: safeName,
    driveId,
    bytes: buf.length,
    url: driveViewUrl(driveId),
  };
}

export async function appendIncidentRow(input: {
  Incident_ID: string;
  Equipment_ID: string;
  Ngay_phat_sinh: string;
  Mo_ta_su_co: string;
  Bien_phap_xu_ly: string;
  Trang_thai: string;
  Nguoi_khac_phuc: string;
  Ngay_hoan_thanh: string;
  Hinh_anh_links: string;
  Nguoi_tao: string;
}) {
  await appendMainRow("EQP_INCIDENTS", [
    input.Incident_ID,
    input.Equipment_ID,
    input.Ngay_phat_sinh,
    input.Mo_ta_su_co,
    input.Bien_phap_xu_ly,
    input.Trang_thai,
    input.Nguoi_khac_phuc,
    input.Ngay_hoan_thanh,
    input.Hinh_anh_links,
    "",
    input.Nguoi_tao,
    new Date().toISOString(),
  ]);
  return MAIN_SHEET_ID;
}
