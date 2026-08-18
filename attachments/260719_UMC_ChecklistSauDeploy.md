# CHECKLIST KIỂM TRA SAU KHI DEPLOY THẬT — TRẠM XLNT UMC
**Ngày lập:** 19/07/2026 · **Nguồn:** Nghiệm thu Bước 8 (13 tiêu chí YeuCau v4 mục 9) — các mục dưới đây ĐẠT mức code nhưng CHỈ xác nhận cuối được trên môi trường Apps Script thật. Deploy theo `260719_UMC_VanHanhXLNT_HuongDan-Deploy_v02.md` xong thì kiểm lần lượt, tick từng ô.

## 6 mục bắt buộc

- [ ] **(TC2) addEditor tự động khi tạo tài khoản**
  Đăng nhập QUAN_LY → module Quản trị → thêm 1 người dùng mới (email Google thật) → người đó mở URL web app **ngay lập tức** phải đăng nhập được, KHÔNG cần admin chia sẻ Sheet thủ công. Kiểm chéo: mở Sheet CSDL → Share → thấy email mới ở quyền Editor.

- [ ] **(TC3) CA_TRUC bị chặn hàm ghi hóa chất/thiết bị qua console**
  Đăng nhập tài khoản CA_TRUC → F12 mở DevTools Console → chạy:
  ```javascript
  google.script.run.withSuccessHandler(console.log).withFailureHandler(console.error)
    .saveChemicalTransaction('{}');
  google.script.run.withSuccessHandler(console.log).withFailureHandler(console.error)
    .getChemicalsData();
  ```
  Cả hai phải trả về lỗi/success=false với thông báo không có quyền (server chặn, không chỉ ẩn nút). Kiểm thêm ACCESS_LOGS có dòng DENIED.
  *(Đã test trước bằng harness Node trên chính hàm server 19/07/2026: CA_TRUC bị chặn write_hoachat và approve_nhatky — mục này chỉ còn xác nhận qua đúng kênh google.script.run.)*

- [ ] **(TC5) Giao dịch XUAT vượt tồn kho bị từ chối**
  Nhập kho 10 kg NAOH → thử xuất 15 kg → phải bị từ chối với thông báo "Chặn tồn kho âm", tồn kho giữ nguyên 10.

- [ ] **(TC7) compileReportData khớp Sheet gốc**
  Sau khi có ≥ 3 ngày nhật ký thật: tạo báo cáo 1 khoảng ngày → đối chiếu TAY từng số tổng hợp với dữ liệu gốc trên Sheet (≥ 3 ngày). Số phải khớp tuyệt đối.

- [ ] **(TC8) LockService — 2 tab cùng lưu không mất dòng**
  Mở 2 tab trình duyệt cùng tài khoản → cùng lúc lưu 2 nhật ký (2 ca khác nhau) → cả 2 dòng đều vào OP_LOGS, không dòng nào đè dòng nào. Lặp với 2 giao dịch hóa chất.

- [ ] **(TC9+TC10) Ngưỡng động 810→800 lan tới cảnh báo và Dashboard**
  Module Ngưỡng: sửa NT_NGAY_THUONG 810 → 800 → vào Phân tích & Cảnh báo bấm quét → cảnh báo MỚI sinh ra phải so với 800; bản ghi ALERTS cũ giữ nguyên. Refresh Dashboard → KPI và biểu đồ tô cảnh báo theo 800. Sau đó tạm bỏ quyền đọc Sheet CSDL của tài khoản xem Dashboard → Dashboard vẫn hiển thị bằng ngưỡng fallback, không trắng trang. (Trả lại quyền sau khi test.)

## 3 mục xác nhận nhanh (đã ĐẠT một phần ở môi trường local)

- [ ] **(TC1) Đăng nhập OAuth thật 3 trạng thái**: email trong USERS → vào đúng vai trò; email lạ → màn "Truy cập bị từ chối" (đã thấy đúng ở mock); đặt 1 tài khoản TAM_KHOA/NGUNG → thông báo đúng loại.
- [ ] **(TC6) Link ảnh Drive mở được ở tab ẩn danh**: upload 1 ảnh từ nhật ký → copy link → mở cửa sổ ẩn danh → ảnh hiển thị.
- [ ] **(TC11) Toast vàng trên bản deploy**: nhập nhật ký pH đầu ra 7,9 → toast vàng liệt kê đúng dải 7,2–7,6 (hệ 600) / 7,0–7,4 (hệ 220) từ tab THRESHOLDS, bản ghi vẫn lưu. (Cơ chế + dải đã test động 19/07/2026 trên mock local; mục này xác nhận đường softWarnings từ server thật.)

## Ghi chú
- TC4 (tạo–sửa–duyệt) và TC13 (ACCESS_LOGS) đã sửa lỗi và test động bằng harness Node + browser local ngày 19/07/2026 — khi deploy chỉ cần lướt lại: duyệt 1 nhật ký thấy DA_DUYET trên Sheet, và mỗi thao tác ghi để lại 1 dòng ACCESS_LOGS.
- Nếu mục nào FAIL: ghi lại thông báo lỗi + chụp màn hình, đối chiếu mục Xử lý sự cố trong HuongDan-Deploy_v02.
