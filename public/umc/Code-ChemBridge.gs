/**
 * UMC ChemBridge — ghi TỒN / LIỀU / CHỐT NHẬP vào spreadsheet CSDL.
 *
 * KHÔNG mở, KHÔNG ghi sheet lưu lượng (DASHBOARD_DATA / CSV công khai).
 *
 * Cài:
 * 1. Sheet CSDL → Tiện ích mở rộng → Apps Script (cùng project Backend hoặc project mới).
 * 2. Tạo file Code-ChemBridge.gs, dán toàn bộ file này.
 * 3. Thuộc tính tập lệnh:
 *    DATABASE_SPREADSHEET_ID = ID sheet CSDL (không phải ID sheet lưu lượng)
 *    CHEM_BRIDGE_SECRET     = chuỗi bí mật trùng CHEM_SHEET_SECRET trên máy chủ web
 * 4. Chạy setupChemTabs() một lần.
 * 5. Triển khai → Ứng dụng web:
 *    Thực thi bằng: Tôi (chủ script)
 *    Ai có quyền:   Bất kỳ ai
 * 6. Dán URL /exec vào CHEM_SHEET_WEBHOOK_URL của web app.
 */

var CHEM_TABS_ = {
  NHAP: 'CHEM_NHAP',
  LIEU: 'CHEM_LIEU',
  TON: 'CHEM_TON',
  AUDIT: 'AUDIT_SO'
};

var FLOW_FORBIDDEN_ = ['DASHBOARD_DATA', '2PACX-1vTVjo2dh9Qd0mleS94_5LYzM-ju1wuJunMZohkLavn03i6W78IKwWOIUEsa6FEEH2UTpB8ee8XHWeoo', 'gid=1963700720'];

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function assertNotFlow_(id) {
  var s = String(id || '');
  for (var i = 0; i < FLOW_FORBIDDEN_.length; i++) {
    if (s.indexOf(FLOW_FORBIDDEN_[i]) !== -1) {
      throw new Error('Từ chối: đây là sheet lưu lượng. ChemBridge chỉ ghi spreadsheet CSDL.');
    }
  }
}

function getCsdl_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DATABASE_SPREADSHEET_ID');
  if (!id) throw new Error('Thiếu DATABASE_SPREADSHEET_ID.');
  assertNotFlow_(id);
  return SpreadsheetApp.openById(id);
}

function ensureTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function setupChemTabs() {
  var ss = getCsdl_();
  ensureTab_(ss, CHEM_TABS_.NHAP, ['Thang', 'Locked', 'Actor', 'At', 'Note', 'Micro', 'Matri', 'NaOH', 'NaHCO3', 'Javen', 'Receipts_JSON']);
  ensureTab_(ss, CHEM_TABS_.LIEU, ['Iso', 'Actor', 'At', 'Note', 'Micro', 'Matri', 'NaOH', 'NaHCO3', 'Javen']);
  ensureTab_(ss, CHEM_TABS_.TON, ['Ma_hoa_chat', 'Ton_kho', 'Ngay_cap_nhat']);
  ensureTab_(ss, CHEM_TABS_.AUDIT, ['Id', 'Thoi_gian', 'Email', 'Vai_tro', 'Hanh_dong', 'Bang', 'Khoa', 'Truoc', 'Sau']);
}

function upsertByKey_(sh, keyCol, key, rowValues) {
  var last = sh.getLastRow();
  if (last >= 2) {
    var keys = sh.getRange(2, keyCol, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) {
        sh.getRange(i + 2, 1, 1, rowValues.length).setValues([rowValues]);
        return;
      }
    }
  }
  sh.appendRow(rowValues);
}

function doGet() {
  return jsonOut_({
    ok: true,
    service: 'UMC ChemBridge',
    writes: [CHEM_TABS_.NHAP, CHEM_TABS_.LIEU, CHEM_TABS_.TON, CHEM_TABS_.AUDIT],
    neverTouch: 'DASHBOARD_DATA / sheet lưu lượng'
  });
}

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('CHEM_BRIDGE_SECRET') || '';
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!secret || body.secret !== secret) {
      return jsonOut_({ ok: false, error: 'Sai CHEM_BRIDGE_SECRET.' });
    }
    if (body.neverTouch && body.neverTouch !== 'flow-sheet') {
      /* web app đánh dấu không được đụng lưu lượng */
    }
    setupChemTabs();
    var ss = getCsdl_();
    if (ss.getSheetByName('DASHBOARD_DATA')) {
      /* CSDL lỡ có tab này thì vẫn không ghi vào */
    }

    var nhap = ss.getSheetByName(CHEM_TABS_.NHAP);
    var lieu = ss.getSheetByName(CHEM_TABS_.LIEU);
    var ton = ss.getSheetByName(CHEM_TABS_.TON);
    var audit = ss.getSheetByName(CHEM_TABS_.AUDIT);

    var rowsNhap = body.chemNhap || [];
    for (var i = 0; i < rowsNhap.length; i++) {
      var n = rowsNhap[i];
      upsertByKey_(nhap, 1, n.thang, [
        n.thang, n.locked, n.actor, n.at, n.note,
        n.micro, n.matri, n.naoh, n.nahco3, n.javen,
        n.receiptsJson || ''
      ]);
    }

    var rowsLieu = body.chemLieu || [];
    for (var j = 0; j < rowsLieu.length; j++) {
      var d = rowsLieu[j];
      upsertByKey_(lieu, 1, d.iso, [
        d.iso, d.actor, d.at, d.note,
        d.micro, d.matri, d.naoh, d.nahco3, d.javen
      ]);
    }

    var rowsTon = body.chemTon || [];
    for (var k = 0; k < rowsTon.length; k++) {
      var t = rowsTon[k];
      upsertByKey_(ton, 1, t.ma, [t.ma, t.ton, t.at]);
    }

    if (body.audit && body.audit.id) {
      var a = body.audit;
      upsertByKey_(audit, 1, a.id, [
        a.id, a.at, a.email, a.role, a.action, a.entity, a.entityId, a.before, a.after
      ]);
    }

    return jsonOut_({
      ok: true,
      tabs: [CHEM_TABS_.NHAP, CHEM_TABS_.LIEU, CHEM_TABS_.TON, CHEM_TABS_.AUDIT]
    });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
