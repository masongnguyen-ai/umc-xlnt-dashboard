# UMC — Vận hành trạm XLNT

Web quản lý vận hành trạm xử lý nước thải Bệnh viện Đại học Y Dược TP.HCM.

Stack: React, TanStack Start/Router, Zustand, Vite, Tailwind, Postgres (PGLite khi xem trước).

## Chạy trên máy

Cần Node 20+.

```bash
npm install
npm run dev
```

Mở http://localhost:8080

```bash
npm run typecheck
npm run build
```

## Dữ liệu

- **Lưu lượng:** chỉ đọc sheet Google đã publish (CSV), poll 10 phút. Web không ghi ngược sheet này.
- **Hóa chất (tồn / liều / chốt nhập):** ghi máy chủ. Khi gắn ChemBridge, đẩy sang tab `CHEM_NHAP`, `CHEM_LIEU`, `CHEM_TON`, `AUDIT_SO` trên spreadsheet CSDL.
- **Phân quyền:** ca trực / nhà thầu / quản lý do máy chủ quyết định theo email Google trong Quản trị. Email chưa khai (khi đã triển khai) bị chặn.
- **Backup:** mỗi lần sửa số, máy chủ giữ bản JSON; quản lý khôi phục trong Nhật ký số.

## PWA máy trực

Chrome → Cài đặt ứng dụng → ghim thanh tác vụ. Bật Giữ màn hình lúc ca trực.

## ChemBridge (Google Sheet)

1. Dán `public/umc/Code-ChemBridge.gs` vào Apps Script của spreadsheet **CSDL** (không phải file lưu lượng).
2. Script properties: `DATABASE_SPREADSHEET_ID`, `CHEM_BRIDGE_SECRET`.
3. Triển khai web app: thực thi bằng Tôi, quyền Bất kỳ ai.
4. Trên máy chủ web đặt `CHEM_SHEET_WEBHOOK_URL` (URL `/exec`) và `CHEM_SHEET_SECRET` (khớp secret).

## Tài liệu gốc

- `attachments/` — sheet, Apps Script, hướng dẫn deploy cũ
- `docs/UMC-DESIGN-20260814.md`
- `AGENTS.md` — quy ước sandbox Grok (tham khảo)
