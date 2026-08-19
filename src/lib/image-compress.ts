/** Chuẩn bị ảnh chứng minh lên Drive 5 TB — nén nhẹ cho mạng ca trực, không ép 1 MB. */

export const MAX_EVIDENCE_BYTES = 8_000_000;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không đọc được ảnh."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareEvidenceImage(file: File): Promise<{ name: string; dataUrl: string; bytes: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Chỉ nhận tệp ảnh.");
  if (file.size <= 2_500_000 && file.type === "image/jpeg") {
    return { name: file.name, dataUrl: await blobToDataUrl(file), bytes: file.size };
  }

  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;
  const cap = 2560;
  if (Math.max(w, h) > cap) {
    const s = cap / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Máy không xử lý được ảnh.");
  }

  let quality = 0.88;
  let blob: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
    if (blob && blob.size <= MAX_EVIDENCE_BYTES) break;
    quality = Math.max(0.55, quality - 0.08);
    if (blob && blob.size > MAX_EVIDENCE_BYTES) {
      w = Math.round(w * 0.88);
      h = Math.round(h * 0.88);
    }
  }
  bitmap.close();
  if (!blob) throw new Error("Không xử lý được ảnh.");
  if (blob.size > MAX_EVIDENCE_BYTES) {
    throw new Error("Ảnh vẫn quá nặng cho mạng ca trực — chụp lại hoặc dán link Drive.");
  }
  return {
    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    dataUrl: await blobToDataUrl(blob),
    bytes: blob.size,
  };
}

/** @deprecated dùng prepareEvidenceImage */
export const compressImageUnder1MB = prepareEvidenceImage;

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
