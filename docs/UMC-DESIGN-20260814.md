# UMC XLNT — Design system 14/08/2026

Font duy nhất: IBM Plex Sans, dự phòng Segoe UI / Roboto / Helvetica Neue / Arial.

## 6.1 Token màu và tương phản WCAG AA

| Token | Tối | Sáng | Dùng ở đâu | Tương phản chữ/nền |
|---|---|---|---|---|
| `--u-bg` | #0C1116 | #F4F0E8 | Nền trang | — |
| `--u-surface` | #151C23 | #FFFCF6 | Card, sidebar | — |
| `--u-raised` | #1C252E | #FFFFFF | Input, hover | — |
| `--u-txt` trên bg | #E6EDF2 | #1A2229 | Chữ chính | 16.04 / 14.16 |
| `--u-txt` trên surface | #E6EDF2 | #1A2229 | Chữ trên card | 14.53 / 15.72 |
| `--u-txt-secondary` trên bg | #A8B4C0 | #4A5560 | Nhãn, phụ đề | 8.99 / 6.70 |
| `--u-txt-tertiary` trên bg | #7C8894 | #5C6770 | Meta, giờ | 5.24 / 5.09 |
| `--u-brand` + `--u-brand-fg` | #3BA89A / #06211E | #0E6B62 / #FFFFFF | Một CTA mỗi màn | 5.83 / 6.37 |
| `--u-ok-fg` trên `--u-ok-bg` | #B8E6D4 / #163328 | #14553A / #D7EFE4 | Badge OK | 9.95 / 7.26 |
| `--u-warn-fg` trên `--u-warn-bg` | #F3DEAA / #3A2E12 | #6B4A00 / #F3E6C4 | Badge cảnh báo | 10.03 / 6.50 |
| `--u-bad-fg` trên `--u-bad-bg` | #F3C4C4 / #3A1818 | #8B2222 / #F5DCDC | Badge sự cố | 10.20 / 6.87 |
| `--u-info-fg` trên `--u-info-bg` | #C4D8E8 / #1A2C38 | #1A4A62 / #D6E6EF | Badge thông tin | 9.81 / 7.47 |

Mọi cặp chữ thường ≥ 4.5:1 cả hai theme.

## 6.2 Ánh xạ token cũ → mới

| Cũ (Shell v2) | Cũ (Dashboard v11) | Mới |
|---|---|---|
| `--bg #0b1120` | `--bg #0f172a` | `--u-bg` |
| `--surface #111a2e` | `--panel #1e293b` | `--u-surface` |
| `--surface2 #182338` | `--panel2 #273549` | `--u-raised` |
| `--line #243147` | `--line #334155` | `--u-border` |
| `--txt #e6edf7` | `--txt #e2e8f0` | `--u-txt` |
| `--muted #8b9bb4` | `--muted #94a3b8` | `--u-txt-secondary` |
| `--dim #5d6d86` | — | `--u-txt-tertiary` |
| `--accent #2dd4bf` | `--accent #38bdf8` | `--u-brand` |
| `--accent2 #0ea5e9` | — | `--u-info` |
| `--ok #34d399` | `--ok #22c55e` | `--u-ok` + bộ bg/bd/fg |
| `--warn #fbbf24` | `--warn #f59e0b` | `--u-warn` + bộ bg/bd/fg |
| `--bad #f87171` | `--bad #ef4444` | `--u-bad` + bộ bg/bd/fg |
| `--purple #a78bfa` | `--cap #a78bfa` | `--u-info` (không còn tím trang trí) |
| Plus Jakarta Sans | Segoe UI | IBM Plex Sans |

Alias `--bg --surface --txt --accent --ok --warn --bad` vẫn còn để JS cũ đọc `var(--txt)`.

## Nhật ký thay đổi

### Chỉ giao diện
- Một bảng token + một font cho cả hai file.
- Icon Lucide SVG thay emoji chrome (giữ emoji trong dữ liệu Sheet).
- Light theme thiết kế lại (nền ngà, chữ mực).
- Dashboard: 4 KPI tầng 1, 7 KPI gấp trên điện thoại, biểu đồ theo tab.
- Bảng 14 cột → thẻ ngày dưới 760px.
- Chart.js đọc token khi đổi theme; trục Y không âm.

### Có ảnh hưởng JS
- Thêm `toggleTheme`, `chartTheme`, `curChartTab`, `cardRows`, `pos` trên dashboard.
- `drawCharts` chỉ vẽ canvas tab đang mở.
- `renderView` đổi HTML, không đổi cách map cột Sheet.
- Shell: `MODULES[].name` đổi `&` → `và`; `MODULES[].ic` thành SVG; `ROLE_AV` thành chữ C/N/Q.
- `updateThemeUI` ghi chữ thay emoji. Tên hàm giữ nguyên.

### Cần sửa phía Apps Script
- Không bắt buộc. `getData()` giữ nguyên.
- Nếu iframe sandbox chặn `localStorage` theme: theme vẫn đổi trong phiên (biến DOM). Muốn nhớ theme: lưu `umc_theme` bằng PropertiesService khi có user.
- Dán `DASHBOARD_URL` như cũ.

## Rủi ro
- Dòng 13/08–14/08: ngày chưa có LL 24h bị bỏ qua như cũ.
- Cột cảnh báo Sheet nhiều `#REF!` / trống — badge dựa vào chuỗi `cb`.
- Chỉ số âm (reset đồng hồ) bị kẹp 0 trên biểu đồ, bảng vẫn hiện số thật.
- Shell còn `style=""` layout trong JS module (display/gap), không còn hex ở HTML tĩnh.
- Mở file HTML ngoài Apps Script: dashboard hiện lỗi kết nối, không bịa số.

## Tự chấm nghiệm thu

| Tiêu chí | Kết quả |
|---|---|
| Mở file, không lỗi console khi có Apps Script | Đạt trên web đang chạy. File HTML tĩnh cố ý báo thiếu `google.script.run`. |
| Không còn `style=""` chứa hex/rgb trong HTML tĩnh | Đạt (Shell HTML tĩnh = 0; Dashboard HTML tĩnh = 0). |
| Đổi theme: modal/toast/chart đổi màu | Đạt trên Dashboard (chart vẽ lại). Shell alias token đổi theo `[data-theme]`. |
| Tương phản ≥ 4.5:1 | Đạt, bảng 6.1. |
| 375px không cuộn ngang trang; nút ≥ 44px | Đạt Dashboard (thẻ ngày). Shell sidebar thành drawer. |
| 1366px thấy banner + 4 KPI không cuộn | Đạt. |
| Bàn phím + focus-visible | Đạt (outline 2px brand). |
| Không đổi tên hàm/id danh sách 6.5 | Đạt. Thêm hàm mới, không đổi tên cũ. |
| Không dùng `&` trên giao diện | Đạt ở nhãn module. Dữ liệu Sheet giữ nguyên nếu có. |
