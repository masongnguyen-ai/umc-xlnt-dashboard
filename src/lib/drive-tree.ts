/** Cây Drive một gốc — gom CSDL, lưu lượng, ảnh, tài liệu. */

export const DRIVE_ROOT_NAME = "UMC_XLNT";

export const DRIVE_TREE = [
  { folder: "01_CSDL", note: "Kéo vào đây bảng tính CSDL vận hành (USERS, hóa chất, thiết bị…)." },
  { folder: "02_Luu_luong", note: "Kéo vào đây sheet 3 đồng hồ — tab DASHBOARD_DATA, chỉ đọc." },
  { folder: "03_Anh_chung_minh/su_co", note: "Ảnh sự cố. App tự tạo thêm thư mục theo tháng." },
  { folder: "03_Anh_chung_minh/nhat_ky", note: "Ảnh nhật ký ca / bất thường." },
  { folder: "03_Anh_chung_minh/bao_tri", note: "Ảnh bảo trì, thay phụ tùng." },
  { folder: "04_Tai_lieu", note: "GPMT, lý lịch thiết bị, biên bản, hướng dẫn." },
  { folder: "06_Ban_ve_CAD", note: "DWG/DXF AutoCAD (P&ID, mặt bằng). App đọc DXF ASCII; DWG mở bằng AutoCAD / Drive." },
  { folder: "05_Apps_Script", note: "Ghi URL Backend, Dashboard, ChemBridge vào một Google Doc." },
] as const;

export type EvidenceKind = "su_co" | "nhat_ky" | "bao_tri";

export function evidenceSubpath(kind: EvidenceKind) {
  const map: Record<EvidenceKind, string> = {
    su_co: "su_co",
    nhat_ky: "nhat_ky",
    bao_tri: "bao_tri",
  };
  return map[kind];
}

/** Lấy file ID từ URL Drive (điện thoại chia sẻ / mở file). */
export function parseDriveFileId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s) && !s.includes("/")) return s;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /uc\?export=view&id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function driveViewUrl(fileId: string) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function driveOpenUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
