/**
 * DASHBOARD NƯỚC THẢI UMC — Google Apps Script Web App (v5)
 *
 * CÁCH DEPLOY:
 * 1. Mở Google Sheet "UMC - Data Lưu lượng nước thải 2026"
 * 2. Menu Tiện ích mở rộng (Extensions) → Apps Script
 * 3. Thêm/cập nhật 2 file:
 *    - File "Code.gs": dán nội dung file này
 *    - File "Index.html": dán nội dung file 260714_UMC_Dashboard-NuocThai_AppsScript_v13.html
 * 4. Điền DATABASE_SPREADSHEET_ID vào Script Properties nếu muốn liên kết ngưỡng từ Database chung.
 * 5. Bấm Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)
 * 6. Chọn loại: Ứng dụng web (Web app)
 *    - Thực thi bằng: Người dùng đang truy cập (User accessing the web app)
 *    - Ai có quyền truy cập: Mọi người có tài khoản Google
 *    KHÔNG chọn "Tôi / Me" — Session.getActiveUser() sẽ rỗng.
 */

var SHEET_NAME = "DASHBOARD_DATA";

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('UMC · Giám sát nước thải')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Trả về dữ liệu từ tab DASHBOARD_DATA dạng mảng JSON cùng các quy tắc ngưỡng động.
 */
function getData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { error: "Không tìm thấy tab " + SHEET_NAME };

  var values = sheet.getDataRange().getValues();
  var tz = ss.getSpreadsheetTimeZone();
  var dowNames = ['CN','T2','T3','T4','T5','T6','T7']; // getDay(): 0=CN

  var rows = values.map(function(row, idx) {
    if (idx === 0) return row.concat(['_iso']); // header thêm cột phụ
    var r = row.slice();
    var iso = '';
    var cell = r[0];
    if (cell instanceof Date) {
      iso = Utilities.formatDate(cell, tz, "yyyy-MM-dd");
      r[0] = Utilities.formatDate(cell, tz, "dd/MM/yyyy");
      if (!r[14] || String(r[14]).trim() === '') {
        r[14] = dowNames[cell.getDay()];
      }
    }
    return r.concat([iso]);
  });

  // Đọc ngưỡng động từ tab THRESHOLDS của Database chung
  var thresholds = [];
  try {
    var dbId = PropertiesService.getScriptProperties().getProperty('DATABASE_SPREADSHEET_ID');
    var dbSs = dbId ? SpreadsheetApp.openById(dbId) : ss;
    var threshSheet = dbSs.getSheetByName("THRESHOLDS");
    if (threshSheet) {
      var threshValues = threshSheet.getDataRange().getValues();
      var headers = threshValues[0];
      
      var idxId = headers.indexOf("Threshold_ID");
      var idxCode = headers.indexOf("Ma_nguong");
      var idxName = headers.indexOf("Ten_nguong");
      var idxGroup = headers.indexOf("Nhom");
      var idxSys = headers.indexOf("He_thong");
      var idxOp = headers.indexOf("Toan_tu");
      var idxVal1 = headers.indexOf("Gia_tri_1");
      var idxVal2 = headers.indexOf("Gia_tri_2");
      var idxSev = headers.indexOf("Muc_do");
      var idxActive = headers.indexOf("Kich_hoat");
      
      for (var i = 1; i < threshValues.length; i++) {
        var r = threshValues[i];
        var activeVal = String(r[idxActive]).toUpperCase();
        if (activeVal === 'TRUE' || activeVal === '1') {
          thresholds.push({
            Threshold_ID: r[idxId],
            Ma_nguong: r[idxCode],
            Ten_nguong: r[idxName],
            Nhom: r[idxGroup],
            He_thong: r[idxSys],
            Toan_tu: r[idxOp],
            Gia_tri_1: Number(r[idxVal1]),
            Gia_tri_2: r[idxVal2] !== "" ? Number(r[idxVal2]) : "",
            Muc_do: r[idxSev],
            Kich_hoat: true
          });
        }
      }
    }
  } catch (e) {
    console.error("Lỗi đọc THRESHOLDS: " + e.toString());
  }

  return { 
    rows: rows, 
    thresholds: thresholds, 
    updated: Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm") 
  };
}
