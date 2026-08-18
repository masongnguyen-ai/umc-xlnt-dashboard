# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG VẬN HÀNH TRẠM XLNT UMC (GIAI ĐOẠN 2)
**Ngày lập:** 19/07/2026 · **Thay thế bản 14/07/2026 (v1)** · **Người duyệt:** Mà Song Nguyễn

Tài liệu hướng dẫn triển khai 2 web app trên Google Apps Script: **Backend + Shell** (khung 9 module, serve qua doGet) và **Dashboard nước thải** (độc lập, nhúng iframe vào module Theo dõi). Nguồn code: `shell/260714_UMC_VanHanhXLNT_Code_v1.gs`, `shell/260714_UMC_VanHanhXLNT_Shell_v3.html`, `dashboard/260714_UMC_Dashboard-Code_v5.gs`, `dashboard/260714_UMC_Dashboard-NuocThai_AppsScript_v13.html` (trong thư mục dự án umc-xlnt — KHÔNG dùng các đường dẫn scratch cũ trong bản 14/07).

## Nguyên tắc bắt buộc (đọc trước khi làm)

1. **Execute as: "User accessing the web app"** cho CẢ HAI web app. Tuyệt đối không chọn "Me": admin dùng Gmail `masongnguyen@gmail.com` ngoài domain, chọn "Me" sẽ khiến `Session.getActiveUser()` trả rỗng — không ai đăng nhập được.
2. **Who has access: "Anyone with a Google account"** — hệ thống cần biết danh tính Google để phân quyền QUAN_LY / NHA_THAU / CA_TRUC phía server.
3. **Shell PHẢI được serve qua doGet() của Backend** — dán vào file HTML tên `index` trong chính project Backend. `google.script.run` chỉ hoạt động khi HTML do Apps Script phục vụ. Mở file HTML local bằng Chrome = chế độ mock demo, KHÔNG kết nối dữ liệu thật.
4. Vì chạy dưới danh nghĩa người truy cập, **người dùng phải có quyền trên Sheet CSDL**. Hệ thống tự chia sẻ quyền Editor khi admin tạo tài khoản qua module Quản trị; nếu thất bại, chia sẻ tay (xem Xử lý sự cố).

## BƯỚC 1 — Tạo Google Sheet Cơ sở dữ liệu
1. Tạo Bảng tính trống mới, đặt tên `UMC - Cơ sở dữ liệu vận hành Trạm XLNT`.
2. Lưu lại **ID bảng tính** (chuỗi giữa `/d/` và `/edit` trên thanh địa chỉ).

## BƯỚC 2 — Tạo project Apps Script Backend + Shell
1. Tại Sheet vừa tạo: **Tiện ích mở rộng → Apps Script**. Đổi tên project: `UMC_VanHanhXLNT_Backend`.
2. File `Code.gs`: dán toàn bộ `260714_UMC_VanHanhXLNT_Code_v1.gs`.
3. Bấm **+ → HTML**, đặt tên file **chính xác là `index`** (chữ thường, Apps Script tự thêm .html): dán toàn bộ `260714_UMC_VanHanhXLNT_Shell_v3.html`. *(doGet gọi `createTemplateFromFile('index')` — sai tên file là web app trắng trang.)*
4. **Cài đặt dự án (⚙️) → Thuộc tính tập lệnh**, thêm: Key `DATABASE_SPREADSHEET_ID` = ID Sheet ở Bước 1. Lưu.

## BƯỚC 3 — Chạy setupDatabase() lần đầu
1. Trong trình soạn code, chọn hàm `setupDatabase` → **Chạy** → cấp quyền (Review Permissions → Advanced → Go to UMC_VanHanhXLNT_Backend → Allow).
2. Kiểm tra Sheet CSDL sau khi chạy — **15 tab** được tạo với dữ liệu seed THẬT (nguồn: DuLieu-HeThong_v7 + lý lịch thiết bị v2):
   - `USERS`: 1 tài khoản quản trị `masongnguyen@gmail.com` (QUAN_LY).
   - `CONFIGS`: 6 key, trong đó `CONTRACTOR_NAME` = "Công ty Đại Nam"; **2 key cần admin điền tay**: `WASTEWATER_DATA_SPREADSHEET_ID` (Bước 6) và `UPLOAD_FOLDER_ID` (Bước 4).
   - `THRESHOLDS`: **26 ngưỡng, 3 nhóm** — 6 LUU_LUONG + 10 CHAT_LUONG (dải vận hành nội bộ theo Báo cáo T04/2026, cảnh báo vàng) + 10 PHAP_LY (QCVN 28:2010 cột B, K=1, mức LOI).
   - `LOG_CHECKLIST_ITEMS`: **19 mục** công việc hàng ngày.
   - `CHEMICALS`: **5 hóa chất** (NaOH, Javen, NaHCO3, Mật rỉ đường, Vi sinh) — ngưỡng tồn để trống, admin tự đặt.
   - `EQUIPMENTS`: **34 thiết bị** (16 hệ 600 + 18 hệ 220, gồm TB-220-18 bơm hố thu khu B).
   - `EQP_INCIDENTS`: **8 sự cố** lịch sử 2025-2026; `EQP_MAINTENANCES`: **2 bảo trì** T04/2026.
   - Các tab còn lại (OP_LOGS, LOG_HISTORIES, CHEM_STOCKS, CHEM_TRANSACTIONS, REPORTS, ALERTS, ALERT_HISTORIES, ACCESS_LOGS) tạo rỗng — **cố ý không seed** tồn kho, giao dịch, báo cáo mẫu (nguyên tắc không bịa số liệu).

## BƯỚC 4 — Cấu hình thư mục Drive lưu ảnh/tài liệu
Cơ chế trong code (`uploadImageToDrive`): đọc ID thư mục từ CONFIGS key `UPLOAD_FOLDER_ID`; ảnh upload được đặt chia sẻ "ai có link – xem" để hiển thị trong app. Nếu key bỏ trống, hệ tự tạo thư mục `UMC_Wastewater_Images` — nhưng vì web app chạy dưới danh nghĩa người truy cập, thư mục fallback sẽ tạo **trong Drive của từng người upload** (phân tán, khó quản lý — không khuyến nghị).
1. Admin tạo 1 thư mục Drive, ví dụ `UMC_XLNT_Upload`.
2. Chia sẻ thư mục với quyền **Người chỉnh sửa** cho các tài khoản sẽ dùng app (danh sách email trong tab USERS).
3. Dán ID thư mục (chuỗi sau `/folders/` trên URL) vào ô Value của key `UPLOAD_FOLDER_ID` trong tab CONFIGS.

## BƯỚC 5 — Triển khai Backend Web App
1. **Triển khai → Triển khai mới → Ứng dụng web**:
   - Execute as: **User accessing the web app**
   - Who has access: **Anyone with a Google account**
2. Bấm Triển khai → lưu lại **URL Web App Backend** — đây chính là địa chỉ người dùng mở Shell.
3. Mở URL bằng tài khoản `masongnguyen@gmail.com` để xác nhận đăng nhập được với vai trò QUAN_LY.
4. Tạo các tài khoản còn lại qua module **Quản trị**: khi lưu, hệ tự chia sẻ quyền Editor Sheet CSDL (và Sheet lưu lượng nếu đã khai `WASTEWATER_DATA_SPREADSHEET_ID`) cho email mới.

## BƯỚC 6 — Triển khai Dashboard nước thải (project riêng)
1. Mở Google Sheet dữ liệu lưu lượng (`UMC - Data Lưu lượng nước thải 2026`, có tab `DASHBOARD_DATA`) → Tiện ích mở rộng → Apps Script. Đổi tên: `UMC_Wastewater_Dashboard`.
2. File `Code.gs`: dán `260714_UMC_Dashboard-Code_v5.gs`. File HTML tên **`Index`** (chữ I hoa — theo `createTemplateFromFile('Index')` của Dashboard): dán `260714_UMC_Dashboard-NuocThai_AppsScript_v13.html`.
3. Script Properties: thêm `DATABASE_SPREADSHEET_ID` = ID Sheet CSDL (Bước 1) — để Dashboard đọc **ngưỡng động** từ tab THRESHOLDS. Nếu thiếu hoặc đọc lỗi, Dashboard tự fallback về hằng số mặc định trong code (không vỡ).
4. Triển khai Web App với cùng cấu hình: **User accessing the web app** + **Anyone with a Google account**. Lưu lại **URL Dashboard**.
5. Quay lại Sheet CSDL, điền key `WASTEWATER_DATA_SPREADSHEET_ID` = ID Sheet lưu lượng (phục vụ addEditor tự động ở Bước 5.4).

## BƯỚC 7 — Nhúng Dashboard vào Shell
1. Mở file `index` trong project Backend, tìm dòng khai báo (khoảng dòng 2134):
   ```javascript
   const DASHBOARD_URL = 'https://script.google.com/macros/s/.../exec';
   ```
   Thay bằng URL Dashboard ở Bước 6. *(Tìm theo chuỗi `const DASHBOARD_URL`, đừng tin số dòng.)*
2. Cập nhật luôn key `DASHBOARD_URL` trong tab CONFIGS cho nhất quán.
3. **Triển khai → Quản lý triển khai → Sửa → Phiên bản mới** để bản sửa có hiệu lực trên URL cũ.

## BƯỚC 8 — Kiểm nghiệm (chỉ tính năng CÓ THẬT)
| # | Kiểm tra | Kết quả đúng |
|---|---|---|
| 1 | Mở URL Backend bằng email đã khai trong USERS | Vào Shell, đúng vai trò |
| 2 | Mở bằng email Google CHƯA khai | Bị chặn với thông báo chưa đăng ký (không lộ dữ liệu) |
| 3 | Module Ngưỡng | 26 ngưỡng, 3 nhóm (PHAP_LY viền đỏ ⚖️); QUAN_LY sửa được giá trị và bật/tắt, thay đổi ghi vào tab THRESHOLDS |
| 4 | Nhật ký vận hành: nhập pH đầu ra hệ 600 ngoài dải 7,2–7,6 (ví dụ 7,9) | Toast VÀNG cảnh báo mềm, bản ghi VẪN lưu thành công |
| 5 | Module AI | Trang giới thiệu tĩnh trạng thái "Kế hoạch" — KHÔNG có ô chat, không có phản hồi tự động nào |
| 6 | Module Thiết bị / Hóa chất | 34 thiết bị, 8 sự cố, 2 bảo trì; 5 danh mục hóa chất; tài khoản CA_TRUC không đọc được 2 module này |
| 7 | Module Theo dõi | Dashboard nhúng iframe hiển thị; mở URL Dashboard riêng cũng chạy |
| 8 | Upload ảnh ở Nhật ký/Sự cố | Ảnh vào thư mục Bước 4, link xem được trong app |
| 9 | Mở file Shell_v3.html local bằng Chrome | Chế độ mock offline đủ 9 module (chỉ demo, không ghi dữ liệu thật) |

## Xử lý sự cố
- **Web app báo lỗi/không ai đăng nhập được, getActiveUser rỗng**: kiểm tra lại Execute as — phải là "User accessing the web app". Sai thì tạo triển khai mới với cấu hình đúng.
- **Không tìm thấy DATABASE_SPREADSHEET_ID**: kiểm tra Script Properties của đúng project (Backend và Dashboard cấu hình riêng, cùng tên key).
- **Đăng nhập được nhưng không đọc/ghi dữ liệu**: người dùng thiếu quyền trên Sheet CSDL — kiểm tra addEditor tự động có lỗi trong log không, chia sẻ tay quyền Editor cho email đó.
- **Dashboard nhúng hiện trang đăng nhập Google (X-Frame)**: kiểm tra Who has access và dòng `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` trong doGet cả 2 app.
- **Upload ảnh thất bại**: kiểm tra `UPLOAD_FOLDER_ID` đúng ID và người dùng có quyền Editor trên thư mục.
