# PHỤ LỤC DỮ LIỆU HỆ THỐNG v7 — TRẠM XLNT BỆNH VIỆN ĐẠI HỌC Y DƯỢC TP.HCM
**Thay thế DuLieu-HeThong_v6 · v7: bổ sung TB-220-18 (bơm hố thu gom hệ 220, EBARA/DW VOX-300) — xác nhận thực địa 16/07/2026, sửa FK sự cố 25/12/2025 từ hệ 600 → hệ 220. Tổng thiết bị 33→34 (16 hệ 600 + 18 hệ 220). Nguồn tổng: Báo cáo T04/2026 + E-HSMT + GPMT + xác nhận thực địa.**

> Nguồn GPMT + E-HSMT có độ tin cậy cao hơn báo cáo vận hành tháng của nhà thầu (là hồ sơ nộp cơ quan quản lý nhà nước và hợp đồng đang áp dụng). Khi lệch với DuLieu-HeThong_v2, **v3 ghi đè v2** — có ghi rõ lý do từng chỗ đổi.

---

## 0. HAI THAY ĐỔI ĐÃ CHỐT (14/07 → nay)

| Mục | v2 (cũ) | v3 (mới) | Vì sao đổi |
|---|---|---|---|
| Tần suất đo COD | 2 lần/tuần | **1 lần/tuần** | E-HSMT Chương V ghi rõ: "COD tối thiểu 1 lần/tuần dưới sự chứng kiến của nhân viên Bệnh viện" — đây là yêu cầu hợp đồng đang áp dụng |
| Máy thổi khí bể điều hòa hệ 600 | 4 kW (theo báo cáo T04) | **5,5 kW** | GPMT (dẫn nguồn "Hướng dẫn vận hành hệ thống") + lý lịch thiết bị cùng khớp 5,5kW/1700rpm/5100mmAq — 2 nguồn độc lập đồng thuận, đáng tin hơn báo cáo tháng |
| Bơm lọc hệ 220 | Q=12–42 m³/h (theo báo cáo T04) | **Q=12 m³/h, cột áp 30** | Cùng lý do — GPMT + lý lịch khớp nhau |

Amoni giữ nguyên 3 lần/tuần (không đổi, đã đúng ở v2).

---

## 1. THÔNG TIN CÔNG TRÌNH — bổ sung nguồn GPMT

Giữ nguyên các mục ở v2 (công suất 820 m³/ngày, phân vùng khu A/B, QCVN 28:2010 cột B K=1, nhà thầu hiện hành Đại Nam). Bổ sung mới:

**Kết nối thủy lực 2 hệ** (GPMT, chưa từng ghi trong v2): bể điều hòa hệ 600 tiếp nhận toàn bộ nước khu A; bể điều hòa hệ 220 tiếp nhận toàn bộ nước khu B **+ một phần từ hệ 600** qua 2 bơm trung chuyển điều khiển bằng phao — khi mực nước hệ 220 dưới 1/3 bể (~45 m³) thì bơm chuyển từ hệ 600 sang; khi đạt 3/4 bể (~100 m³) thì ngừng. Tổng thể tích 2 bể điều hòa: 287 m³ (600: 153 m³, 220: 134 m³), thời gian lưu ~8,4 giờ.

**Hiện trạng đo lưu lượng — đã xác nhận (16/07/2026)**: cam kết trong GPMT đã thực hiện đủ. Hiện có **3 đồng hồ**: hệ 600, hệ 220, và đầu ra tổng — khớp đúng cấu trúc 3 nhóm chỉ số (`ll600`, `ll220`, `llnt`/tổng chỉ số) mà Dashboard v13 đang theo dõi. Đây là tin tốt: dữ liệu `DASHBOARD_DATA` đáng tin cậy ở mức đồng hồ vật lý tương ứng đúng 1-1 với các trường đang lưu, không phải suy diễn từ 1 đồng hồ chung.

**Số liệu công suất thực tế 2 năm gần nhất** (Báo cáo xả nước thải định kỳ 2022-2023, trích trong GPMT):
| Năm | TB (m³/ngày) | Tối đa (m³/ngày) |
|---|---|---|
| 2022 | 733 | 811 |
| 2023 | 732,9 | 818 |

→ Xác nhận ngưỡng `NT_NGAY_THUONG = 810` đang dùng bám rất sát thực tế vận hành, không phải số tùy ý.

---

## 2. THÔNG SỐ THIẾT KẾ CÔNG TRÌNH (mới hoàn toàn — GPMT Bảng 4, 6)

Dùng làm tài liệu tham khảo (module AI/Báo cáo), không seed vào bảng vận hành hàng ngày.

**Thông số thiết kế cơ sở:**
| Chỉ tiêu | Hệ 600 | Hệ 220 |
|---|---|---|
| Nhu cầu oxy | 96 m³/giờ | 50 m³/giờ |
| Tỷ lệ bùn tuần hoàn | 60% | 60% |
| Tỷ lệ tuần hoàn Nitrat | 100% | 100% |
| Vận tốc lắng | 0,7 m/giờ | 0,6 m/giờ |
| Vận tốc lọc | 12 m/giờ | 6 m/giờ |

**Số bể chính**: Hệ 600 có 17 hạng mục bể (thu gom tách mỡ, 2 bể kỵ khí, điều hòa, thiếu khí, 5 bể FBBR, 2 bể lắng, 3 bể khử trùng, 4 bồn lọc áp lực, bể chứa bùn). Hệ 220 có 7 hạng mục (điều hòa, thiếu khí, hiếu khí, lắng sinh học, ngăn thu bùn, khử trùng, chứa bùn). Chi tiết kích thước/thể tích/thời gian lưu từng bể: xem nguyên văn GPMT Bảng 4 nếu cần tra cứu sâu — không chép lại toàn bộ vào đây để tránh phụ lục quá dài.

Rửa lọc: 5 m³/lần, hàng tuần, nước tuần hoàn về bể điều hòa (khớp v2, xác nhận thêm bởi GPMT).

---

## 3. SEED TAB `EQUIPMENTS` — CẬP NHẬT THEO GPMT BẢNG 5

GPMT liệt kê chi tiết hơn lý lịch thiết bị ở một số điểm (tách nhóm công suất khác nhau trong cùng loại bơm). Bảng dưới **thay thế bảng thiết bị ở DuLieu-HeThong_v2** — thông số ưu tiên theo GPMT (dẫn nguồn Hướng dẫn vận hành gốc), số lượng đối chiếu khớp lý lịch thiết bị.

### Hệ 600 (16 hạng mục — GPMT Bảng 5.I)
| ID | Tên | Thông số | SL |
|---|---|---|---|
| TB-600-01 | Bơm thu gom và điều hòa | Bơm chìm, Q=100–180 l/phút, cột áp 15,7–3,6 mH2O, P=2,2kW, inox | 3 |
| TB-600-02 | Bơm bùn bể lắng & bể nén bùn | Bơm chìm, Q=100–180 l/phút, cột áp 15,7–3,6 mH2O, P=2,2kW, inox | 5 |
| TB-600-03 | Bơm lọc | Bơm chìm, Q=100–180 l/phút, cột áp 15,7–3,6 mH2O, P=2,2kW, inox | 3 |
| TB-600-04 | Máy thổi khí bể điều hòa | Root, Q=1,28 m³/phút, cột áp 5100mmAq, **P=5,5kW**, 1700rpm | 2 |
| TB-600-05 | Máy thổi khí bể hiếu khí có giá thể | Root, Q=4,06 m³/phút, cột áp 5100mmAq, P=5,5kW, 1300rpm | 3 |
| TB-600-06 | Bơm định lượng Chlorine | Bơm màng, Q=30 l/h, cột áp 30 PSI, P=45W | 2 |
| TB-600-07 | Máy khuấy hóa chất | Chân đế, tốc độ 1/15–1/90, P=0,4kW | 1 |
| TB-600-08 | Máy khuấy chìm | Root, P=1,3kW, 1370 v/phút | 2 |
| TB-600-09 | Đĩa tán khí bể điều hòa | Mịn, Q=5-26 m³/giờ, Ø127mm | 16 |
| TB-600-10 | Đĩa phân phối khí | Mịn, Q=0-8 m³/giờ, Ø277mm | 67 |
| TB-600-11 | Thiết bị khống chế lưu lượng | Thùng inox, Q=20-30 m³/giờ | 1 |
| TB-600-12 | Tấm trợ lắng | Vách nghiêng, 62 m²/m³ | 28 m³ |
| TB-600-13 | Ống lắng trung tâm | Q=15-25 m³/h | 1 |
| TB-600-14 | Lược rác (song chắn rác) | Q=15-30 m³/h, inox | 1 |
| TB-600-15 | Bồn hóa chất | PE 4 lớp, 500L | 2 |
| TB-600-16 | Bồn lọc áp lực | Q=20-30m³/h, cát 0,4-1,2mm cao 80cm + sỏi 2-4mm cao 30cm | 4 bộ |

*Ghi chú TB-600-06: đã xác nhận với chủ hệ thống (16/07/2026) — 45W đúng (GPMT ghi "45KW" là lỗi đánh máy trong hồ sơ gốc, đơn vị thật là W, hợp lý với bơm màng định lượng 30l/h).

### Hệ 220 (15 hạng mục — GPMT Bảng 5.II)
| ID | Tên | Thông số | SL |
|---|---|---|---|
| TB-220-01 | Bơm nước thải (nhóm 1) | P=1,5kW, cột áp 6,9, Q=25m³/h | 3 |
| TB-220-02 | Bơm nước thải (nhóm 2) | P=0,55kW, cột áp 6, Q=9,2m³/h | 7 |
| TB-220-03 | Bơm lọc | P=2,2kW, cột áp 30, **Q=12m³/h** | 3 |
| TB-220-04 | Máy khuấy chìm | P=0,7kW, 380V 3 pha, Ø cánh 176mm | 2 |
| TB-220-05 | Máy thổi khí (nhóm 1) | P=2,2kW, cột áp 4, Q=1,36 m³/phút | 2 |
| TB-220-06 | Máy thổi khí (nhóm 2) | P=5,5kW, cột áp 4, Q=4,18 m³/phút | 2 |
| TB-220-07 | Đĩa thổi khí | Mịn, Q=0-16 m³/giờ | 21 |
| TB-220-08 | Thiết bị đo oxy hòa tan | Thang đo 0-20mg/l, độ phân giải 0,01 | 1 |
| TB-220-09 | Thiết bị đo pH | Thang đo 0-14, độ phân giải 0,01 | 1 |
| TB-220-10 | Phao đo mức (sóng siêu âm) | — | 1 |
| TB-220-11 | Phao đo mức nước | Chịu áp 1 bar | 6 |
| TB-220-12 | Mô tơ khuấy hóa chất | P=0,37kW, 100-150 rpm | 2 |
| TB-220-13 | Thiết bị gạt bùn | P=0,37kW, 0,1 rpm | 1 |
| TB-220-14 | Bơm định lượng | Q=25 l/h, đẩy 12 bar/hút 2 bar | 6 |
| TB-220-15 | Đồng hồ đo lưu lượng | PN16, DN50 | 1 |
| TB-220-16 | Quạt hút mùi | Q=3500 m³/giờ, áp tĩnh 3000Pa, 10HP | 1 |
| TB-220-17 | Bồn lọc áp lực | Q=9,2m³/h, cát+sỏi như hệ 600 | 2 bộ |
| TB-220-18 | Bơm hố thu gom hệ 220 | EBARA / DW VOX-300, bơm chìm, P=2,2kW. Ghi_chu lý lịch v2: Q=100–800 l/phút | 3 |

**TB-220-18 — nguồn khác các dòng trên**: không có trong GPMT Bảng 5 lẫn báo cáo T04 gốc — bổ sung theo **xác nhận thực địa 16/07/2026** (đối chiếu sự cố bơm khu B 25/12/2025, đã xác nhận đây là bơm hố thu thuộc hệ 220, không phải hệ 600 như suy đoán ban đầu khi seed EQP_INCIDENTS). Model EBARA/DW VOX-300 lấy từ lý lịch thiết bị v2 (cùng model đã dùng cho TB-600-01/02).

**Lưu ý thay đổi số lượng đáng kể**: bảng này (18 hạng mục hệ 220 — 17 gốc GPMT + 1 bổ sung thực địa, đếm tổng ~43 thiết bị) chi tiết và nhiều hơn hẳn 11 hạng mục ở DuLieu-HeThong_v2 — bảng cũ gộp một số nhóm công suất khác nhau vào 1 dòng. Dùng bảng v7 này làm chuẩn khi seed `EQUIPMENTS` (16 hệ 600 + 18 hệ 220 = 34 dòng, không phải 33).

**Giá thể vi sinh bổ sung** (chưa có ở v2): kích thước 11×11mm, diện tích tiếp xúc 1000 m²/m³, dung tích 37 m³ — dùng cho bể sinh học hệ 600.

Phần **sự cố (8 dòng)** và **bảo trì (2 dòng)** ở DuLieu-HeThong_v2 giữ nguyên, không có nguồn mới bổ sung — **trừ 1 điểm đã xác nhận thực địa 16/07/2026**: sự cố 25/12/2025 "Bơm nước thải khu B" (bơm cháy do vô nước) — v2 gốc không ghi rõ thuộc hệ nào, đã hỏi người vận hành trực tiếp và xác nhận: **thuộc hệ 220**, là thiết bị TB-220-18 (bơm hố thu gom hệ 220, mục 3). Không phải hệ 600 như suy đoán tạm thời lúc seed ban đầu.

---

## 4. LỊCH BẢO TRÌ ĐỊNH KỲ — XÁC NHẬN CHI TIẾT HƠN (E-HSMT, thay thế mục 6 của v2)

E-HSMT có bảng tần suất chính thức, chi tiết hơn 7 nhóm mô tả chung ở v2. Giữ cấu trúc 7 nhóm cũ, bổ sung tần suất chính xác từng hạng mục:

| Nhóm | Hạng mục | Tần suất |
|---|---|---|
| Bể điều hòa | Vệ sinh đo lưu lượng, cân chỉnh, đo pH, vệ sinh bể | Tuần |
| Bể sinh học | Kiểm tra nồng độ bùn, SV30, màu/tốc độ lắng | Tuần |
| | Kiểm tra đĩa phân phối khí (vật tư Bệnh viện cấp) | Tháng |
| Bể lắng | Kiểm tra lắng, vệ sinh bùn nổi, bùn tuần hoàn, khí nâng | Tuần |
| | Vệ sinh tấm lắng lamen | Tháng (hoặc khi hiệu quả giảm) |
| | Bể lắng ly tâm (thay cánh gạt bùn nếu hỏng) | Năm |
| Bể khử trùng | Pha hóa chất, kiểm tra độ đục | Tuần |
| Bồn lọc | Kiểm tra chế độ vận hành, rửa lọc | Tuần |
| Tủ điều khiển | Điện áp, thiết bị điều khiển, xiết mối nối, đo Ampe, cách điện, thay dây/cos/domino | Tháng |
| Bơm chìm (điều hòa/bùn) | Điện, phao, vệ sinh rác, lưu lượng, dòng/cách điện, mối hàn | Tháng |
| | Ổ bi, nhớt | Quý |
| Máy thổi khí | Điện, tín hiệu, lưu lượng/áp suất, độ rung, curoa, dòng/cách điện, mối hàn | Tháng |
| | Vệ sinh máy, mỡ bò, bạc đạn/phớt, lọc gió | Quý |
| Máy khuấy | Điện, rác, độ rung, dòng/cách điện | Tháng |
| | Ổ bi, nhớt | Quý |
| Bơm định lượng | Tắc nghẽn/van/đầu hút | Tuần |
| | Vệ sinh đầu hút | Tháng |
| | Ổ bi | Quý |
| Đường ống | Tắc/bể ống/ăn mòn/van/mối nối | Tuần + bất thường |
| Hệ thống phân phối khí (đường ống, đĩa) | Kiểm tra, thay khi hỏng (vật tư Bệnh viện cấp) | **Quý** |

**Ngưỡng vận hành mới** (E-HSMT, chưa có ở v2): bổ sung bùn hoạt tính khi **SV30 < 250 ml/L** — đây là một mục cần thêm vào tab `THRESHOLDS` nhóm CHAT_LUONG.

### 4.c DẢI CHẤT LƯỢNG VẬN HÀNH BÌNH THƯỜNG — SEED NHÓM CHAT_LUONG (validate mềm, cảnh báo VÀNG)
**Nguồn: Báo cáo T04/2026 mục 6 (nguyên văn, bảng theo dõi chất lượng thực tế 27/03–26/04/2026). Đây là dải kiểm soát QUÁ TRÌNH nội bộ — CHẶT HƠN nhiều so với ngưỡng QCVN pháp lý ở mục 6. TUYỆT ĐỐI KHÔNG lấy số QCVN (pH 6,5-8,5, COD≤100) seed vào đây — hai nhóm khác nhau hoàn toàn. Bảng này trước ở v2 mục 5, bị rơi khi nâng cấp, nay khôi phục.**

Mỗi chỉ tiêu seed 2 dòng (hệ 600 và hệ 220), Muc_do = NHAC_NHO, cảnh báo vàng khi NGOÀI dải, không chặn nhập:

| Ma_nguong | Chỉ tiêu | Hệ 600 | Hệ 220 |
|---|---|---|---|
| SV30_HE600 / SV30_HE220 | SV30 (ml/L) | 300 – 400 | 250 – 350 |
| PH_IN_HE600 / PH_IN_HE220 | pH đầu vào | 7,0 – 7,5 | 7,0 – 7,5 |
| PH_OUT_HE600 / PH_OUT_HE220 | pH đầu ra | 7,2 – 7,6 | 7,0 – 7,4 |
| AMONI_HE600 / AMONI_HE220 | Amoni (mg/l) | 5,0 – 8,0 | 3,0 – 6,0 |
| COD_HE600 / COD_HE220 | COD | 30 – 40 | 10 – 20 |

→ 10 dòng CHAT_LUONG (5 chỉ tiêu × 2 hệ). Toan_tu = NGOAI_KHOANG, Gia_tri_1 = cận dưới, Gia_tri_2 = cận trên. Riêng SV30 còn quy tắc E-HSMT bổ sung "< 250 báo bùn hoạt tính thấp" — có thể gộp vào cận dưới hệ 220 (250) hoặc thêm 1 dòng SV30_MIN_BUN riêng tùy cách tổ chức; **để Claude Code chọn cách gọn nhất, miễn dải trên vẫn được kiểm.**

Lưu ý màu: nhóm này VÀNG (NHAC_NHO). Nhóm PHAP_LY (QCVN, mục 6) ĐỎ (LOI). Không nhầm lẫn số liệu giữa 2 nhóm.

---

## 4.b DANH MỤC CÔNG VIỆC HÀNG NGÀY THEO CA — SEED TAB `LOG_CHECKLIST_ITEMS`
**Nguồn: Báo cáo vận hành T04/2026 mục 3.1 (nguyên văn, nhà thầu Đức Tài — danh mục công việc hằng ngày đã thực hiện thực tế). Đây là checklist ~19 mục tick chọn theo ca mà YeuCau v4 mục 7.1 tham chiếu — trước đây nằm ở DuLieu-HeThong_v2 mục 5, bị rơi khi nâng cấp lên v3/v4, nay khôi phục chính danh.**

Seed 19 mục (giữ đúng thứ tự và câu chữ gốc, mỗi mục 1 dòng tab `LOG_CHECKLIST_ITEMS`: `Item_ID`, `Noi_dung`, `Thu_tu`, `Kich_hoat`):
1. Đo pH nước đầu vào và các bể bằng máy đo pH.
2. Căn chỉnh lưu lượng khí cung cấp cho bể sục khí phù hợp để điều chỉnh nồng độ Oxy hòa tan.
3. Vệ sinh các Hố thu gom, giỏ, lưới chắn rác khu A, Khu B, bể xử lý.
4. Ghi chỉ số đồng hồ lưu lượng nước thải đầu vào, đầu ra để tính lưu lượng nước thải phát sinh trong giờ cao điểm.
5. Xử lý bùn nổi ở Bể lắng.
6. Vệ sinh thiết bị đo lưu lượng.
7. Kiểm tra bùn vi sinh trong các bể xử lý, chỉ số bùn.
8. Kiểm tra đèn tín hiệu, phao, timer, đèn sự cố.
9. Kiểm tra sự tắc nghẽn, van, và đầu hút của bơm.
10. Kiểm tra và khắc phục mùi hôi phát sinh (nếu có) từ hệ thống xử lý nước thải.
11. Kiểm tra chế độ vận hành.
12. Kiểm tra bồn lọc, rửa lọc.
13. Kiểm tra, vệ sinh Hố thu gom tại khu B.
14. Kiểm tra, vệ sinh lưới chắn rác tại hệ thống XLNT 220m³/ngày.
15. Kiểm tra, vệ sinh lưới chắn rác tại hệ thống XLNT 600m³/ngày.
16. Kiểm tra, vệ sinh lưới chắn giá thể tại các bể sinh học.
17. Vệ sinh bùn nổi Bể lắng và cân chỉnh thu bùn bề mặt Bể lắng.
18. Kiểm tra và pha hóa chất hàng ngày.
19. Kiểm tra vệ sinh tấm lắng lamen.

Kèm đo kiểm định kỳ (không phải mục tick, mà là nhắc tần suất — đã phản ánh ở cột Amoni/COD của OP_LOGS): **Amoni 3 lần/tuần, COD 1 lần/tuần** (v4 đã chốt COD 1 lần/tuần theo E-HSMT) dưới sự chứng kiến của nhân viên Bệnh viện.

## 5. HÓA CHẤT — CẬP NHẬT ĐỊNH LƯỢNG CHÍNH THỨC

### 5.1 Định mức hiện tại theo tháng (GPMT Bảng 7 — xác nhận, không đổi so với thực tế đang dùng)
| Hóa chất | Hệ 600 (kg/tháng) | Hệ 220 (kg/tháng) | Mục đích |
|---|---|---|---|
| NaOH ≥98% | 416 | 151 | Cân bằng pH |
| Javen 10% | 914 | 133 | Khử trùng |
| NaHCO3 | 132 | 48 | Ổn định pH |
| Mật rỉ đường | 550 | 200 | Tăng carbon cho vi sinh |

### 5.2 Khối lượng hợp đồng mới 2026-2027 (E-HSMT, 18 tháng — MỚI, chưa có ở v2)
| Hóa chất | Tổng 18 tháng | Quy đổi/tháng | So với 5.1 (tổng 2 hệ) |
|---|---|---|---|
| Vi sinh xử lý nước thải | 108 gallon (~409L) | 6 gallon | Hạng mục mới, chưa có trong định mức hiện tại |
| Mật rỉ đường | 13.500 kg | 750 kg | Khớp đúng (550+200=750) |
| NaOH ≥98% | 11.250 kg | 625 kg | Cao hơn hiện tại (416+151=567) |
| NaHCO3 | 3.240 kg | 180 kg | Khớp đúng (132+48=180) |
| Javen ≥10% | 22.447 kg | 1.247 kg | Cao hơn hiện tại (914+133=1.047) |

→ Dùng **5.1 làm định mức vận hành ngày thường** (theo dõi tồn kho, cảnh báo sắp hết), dùng **5.2 làm cơ sở đối chiếu khi nhà thầu Đại Nam giao hàng theo hợp đồng** — 2 vai trò khác nhau, seed cả 2 vào `CHEMICALS`/ghi chú, không gộp làm một.

Thành phần kỹ thuật vi sinh (mới, E-HSMT): Bacillus spp, Clostridium spp, Desulfovibrio spp, Pseudomonas spp, Rhodopseudomonas spp — giảm BOD/COD/TSS, giảm Nitơ, tăng MLSS/MLVSS, giảm mùi và lượng bùn thải.

---

## 6. NGƯỠNG QCVN (PHÁP LÝ) — NHÓM MỚI, TÁCH RIÊNG KHỎI CHAT_LUONG VẬN HÀNH

Đây là **giới hạn xả thải hợp pháp** (khác với dải vận hành nội bộ ở DuLieu-HeThong_v2 mục 5, vốn là mục tiêu kiểm soát quá trình, chặt hơn nhiều). Thêm nhóm `Nhom = PHAP_LY` vào THRESHOLDS, `Muc_do = LOI` (vi phạm là vi phạm pháp luật, không chỉ nhắc nhở):

| Thông số | QCVN 28:2010 cột B, K=1 |
|---|---|
| pH | 6,5 – 8,5 |
| BOD5 | ≤ 50 mg/l |
| COD | ≤ 100 mg/l |
| TSS | ≤ 100 mg/l |
| Amoni | ≤ 10 mg/l |
| Photphat | ≤ 10 mg/l |
| Nitrat | ≤ 50 mg/l |
| Dầu mỡ động thực vật | ≤ 20 mg/l |
| Sunfua | ≤ 4 mg/l |
| Tổng Coliform | ≤ 5.000 MPN/100ml |

### Hiệu suất xử lý thực tế đã quan trắc (2023, 4 đợt, tham khảo — GPMT Bảng 8)
| Thông số | TB đầu vào | TB đầu ra | Hiệu suất |
|---|---|---|---|
| BOD5 | 151 | 15 | 88,8% |
| COD | 322 | 37,5 | 87,4% |
| TSS | 140,75 | 28,25 | 81,6% |
| Amoni | 58,7 | 2,97 | 95,6% |
| Coliform | 378.525 | 680,75 | 86,1% |

Tất cả đều đạt QCVN cột B tại 4/4 đợt quan trắc 2023 — hệ thống có biên an toàn tốt so với ngưỡng pháp lý.

---

## 7. YÊU CẦU NHÂN SỰ VÀ TIÊU CHÍ NGHIỆM THU (E-HSMT — mới hoàn toàn, phục vụ module Quản trị/Báo cáo)

**Nhân sự nhà thầu** (áp dụng Đại Nam):
- Tối thiểu 1 người vận hành tại chỗ hàng ngày 7h-18h, kể cả T7/CN/lễ Tết, ≥1 năm kinh nghiệm.
- Tối thiểu 1 người quản lý/giám sát, ≥3 năm kinh nghiệm Kỹ thuật môi trường.
- Sự cố: giám sát có mặt trong 2 giờ, huy động tối thiểu 2 người đến khi ổn định.

**Thiết bị dự phòng nhà thầu bắt buộc cung cấp** (trả lại khi hết hợp đồng — không seed vào EQUIPMENTS chính, có thể thêm tab riêng nếu cần theo dõi): 1 bơm định lượng ≥30 l/h, 1 bơm chìm ≥25 m³/h, 2 phao điện dài 5m, thùng đồ nghề, 1 máy xịt áp lực cao, 1 dây nguồn 4 lõi 2,5mm ≥30m.

**Nghiệm thu chính thức** (mới — dùng cho module Báo cáo):
- Nghiệm thu hàng tháng giữa nhà thầu và nhân sự Bệnh viện phụ trách, kèm kết quả phân tích chất lượng nước.
- Hồ sơ nghiệm thu thanh toán định kỳ **3 tháng/lần**.
- Lấy mẫu phân tích độc lập (đơn vị khác nhà thầu) khi: có sự cố bất thường, HOẶC NH4/COD có xu hướng tăng/cận ngưỡng QCVN — chi phí do nhà thầu chịu.
- Vi phạm → lập biên bản, nhà thầu phải khắc phục ngay; Bệnh viện bị xử phạt thì nhà thầu chịu phạt thay.

Trong 90 ngày kể từ ngày hợp đồng 2026-2027 có hiệu lực: thay vật liệu lọc cả 2 hệ (cát thạch anh 0,8m + sỏi 0,3m mỗi bồn) — mốc thời gian cụ thể cần theo dõi trong module Nhật ký/Bảo trì.

---

## 8. ĐIỂM CẦN XÁC NHẬN VỚI CHỦ HỆ THỐNG

**Đã đóng (16/07/2026):**
- ~~TB-600-06 45KW~~ → xác nhận 45W đúng, đã sửa vào bảng thiết bị mục 3.
- ~~Đồng hồ đo lưu lượng riêng từng hệ~~ → xác nhận đã lắp đủ 3 đồng hồ (600, 220, tổng), khớp cấu trúc Dashboard đang dùng.

**Còn mở:**
1. Thiết bị dự phòng nhà thầu (mục 7) — có cần theo dõi trên web (tab riêng) hay chỉ ghi nhận khi bàn giao/thu hồi hợp đồng?
2. Ngưỡng QCVN (mục 6) — xác nhận đưa vào THRESHOLDS làm nhóm cảnh báo mức LOI riêng, hiển thị khác màu với cảnh báo vận hành thường (LUU_LUONG/CHAT_LUONG mức NHAC_NHO)?
