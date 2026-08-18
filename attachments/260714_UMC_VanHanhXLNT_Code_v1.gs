/**
 * UMC Wastewater Treatment Plant Management System Backend
 * Apps Script Version: 260714_UMC_VanHanhXLNT_Code_v1.gs
 * Consolidated Backend Engine (Alerts, Operations, Chemicals, Equipments, Reports, Admin)
 */

// Global constant for user profile cache to optimize execution
let cachedUserProfile_ = null;

/**
 * Trả về đối tượng Google Spreadsheet cơ sở dữ liệu.
 * Đọc DATABASE_SPREADSHEET_ID từ Script Properties để bootstrap.
 * Nếu không có, tự động mở Spreadsheet đang liên kết (Container-bound).
 */
function getSpreadsheet_() {
  const dbId = PropertiesService.getScriptProperties().getProperty('DATABASE_SPREADSHEET_ID');
  if (dbId && dbId.trim() !== '') {
    return SpreadsheetApp.openById(dbId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Đọc một giá trị cấu hình từ tab CONFIGS.
 */
function getConfigValue_(key) {
  try {
    const spreadsheet = getSpreadsheet_();
    const sheet = spreadsheet.getSheetByName('CONFIGS');
    if (!sheet) return null;
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === key) {
        return String(values[i][1]).trim();
      }
    }
  } catch (e) {
    console.error("Lỗi getConfigValue_(" + key + "): " + e.toString());
  }
  return null;
}

/**
 * Ghi vết lịch sử truy cập và bảo mật.
 */
function writeAccessLog_(spreadsheet, email, role, action, details, result) {
  try {
    const sheet = spreadsheet.getSheetByName('ACCESS_LOGS');
    if (sheet) {
      sheet.appendRow([
        new Date(),
        email || 'unknown',
        role || 'GUEST',
        action || '',
        details || '',
        result || ''
      ]);
    }
  } catch (e) {
    console.error("Lỗi ghi ACCESS_LOGS: " + e.toString());
  }
}

/**
 * Định nghĩa ma trận quyền của hệ thống.
 */
const PERMISSION_MATRIX = {
  'CA_TRUC': [
    'theodoi', 'canhbao', 'nhatky', 'ai',
    'view_nhatky', 'write_nhatky'
  ],
  'NHA_THAU': [
    'theodoi', 'canhbao', 'nhatky', 'hoachat', 'thietbi', 'baocao', 'ai',
    'view_nhatky', 'write_nhatky', 'write_hoachat', 'write_thietbi', 'view_baocao', 'update_alert'
  ],
  'QUAN_LY': [
    'theodoi', 'canhbao', 'nguong', 'ai', 'thietbi', 'hoachat', 'nhatky', 'baocao', 'quantri',
    'view_nhatky', 'write_nhatky', 'write_hoachat', 'write_thietbi', 'view_baocao', 'write_nguong', 'write_quantri', 'update_alert', 'approve_nhatky', 'approve_baocao'
  ]
};

/**
 * Kiểm tra quyền của một vai trò đối với một hành động cụ thể.
 */
function checkPermission_(userRole, action) {
  if (!userRole || !action) return false;
  const allowedActions = PERMISSION_MATRIX[userRole] || [];
  return allowedActions.includes(action);
}

/**
 * Tìm kiếm nhân sự trong tab USERS theo email.
 */
function findUserByEmail_(email) {
  try {
    const spreadsheet = getSpreadsheet_();
    const sheet = spreadsheet.getSheetByName('USERS');
    if (!sheet) return null;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;
    
    const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    const targetEmail = email.toLowerCase().trim();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (String(row[1]).toLowerCase().trim() === targetEmail) {
        return {
          User_ID: String(row[0]),
          Email: String(row[1]),
          Ho_ten: String(row[2]),
          So_dien_thoai: String(row[3]),
          Don_vi: String(row[4]),
          Ghi_chu: String(row[5]),
          Vai_tro: String(row[6]),
          Trang_thai: String(row[7]),
          Ngay_tao: row[8]
        };
      }
    }
  } catch (e) {
    console.error("Lỗi tìm kiếm người dùng: " + e.toString());
  }
  return null;
}

/**
 * Hàm bảo vệ (Guard) ở backend để xác thực quyền truy cập trước khi thực hiện thao tác.
 */
function requirePermission_(action) {
  if (cachedUserProfile_) {
    if (!checkPermission_(cachedUserProfile_.Vai_tro, action)) {
      throw new Error("Tài khoản của bạn không có quyền thực hiện hành động này (" + action + ").");
    }
    return cachedUserProfile_;
  }

  const activeEmail = Session.getActiveUser().getEmail();
  if (!activeEmail || activeEmail.trim() === '') {
    throw new Error("Không thể xác định tài khoản Google. Vui lòng đăng nhập.");
  }

  const user = findUserByEmail_(activeEmail);
  if (!user) {
    throw new Error("Tài khoản chưa được cấp quyền truy cập hệ thống.");
  }

  if (user.Trang_thai === 'TAM_KHOA') {
    throw new Error("Tài khoản của bạn tạm thời đang bị khóa. Vui lòng liên hệ Quản lý.");
  } else if (user.Trang_thai === 'NGUNG') {
    throw new Error("Tài khoản của bạn đã ngừng hoạt động trên hệ thống này.");
  } else if (user.Trang_thai !== 'HOAT_DONG') {
    throw new Error("Trạng thái tài khoản không hợp lệ (" + user.Trang_thai + ").");
  }

  if (!checkPermission_(user.Vai_tro, action)) {
    const spreadsheet = getSpreadsheet_();
    writeAccessLog_(spreadsheet, activeEmail, user.Vai_tro, action, 'Yêu cầu bị chặn do thiếu quyền.', 'DENIED');
    throw new Error("Tài khoản của bạn không có quyền thực hiện hành động này (" + action + ").");
  }

  cachedUserProfile_ = user;
  return user;
}

/**
 * Chuẩn hóa phản hồi từ API theo định dạng JSON thống nhất.
 */
function createApiResponse_(success, data, message) {
  return JSON.stringify({
    success: success,
    data: data,
    message: message || '',
    timestamp: new Date().toISOString()
  });
}

/**
 * Hàm xử lý yêu cầu GET khi người dùng truy cập link Web App.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('UMC · Hệ thống vận hành trạm XLNT')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Trả về thông tin người dùng hiện tại đang truy cập Web App.
 */
function getCurrentUser() {
  try {
    const activeEmail = Session.getActiveUser().getEmail();
    console.log("Đang xác thực truy cập cho email: " + activeEmail);
    
    if (!activeEmail || activeEmail.trim() === "") {
      return createApiResponse_(false, null, "Không thể xác định tài khoản Google. Vui lòng đăng nhập.");
    }

    const user = findUserByEmail_(activeEmail);
    const spreadsheet = getSpreadsheet_();
    
    if (!user) {
      writeAccessLog_(spreadsheet, activeEmail, 'GUEST', 'LOGIN', 'Truy cập bị từ chối: Email chưa đăng ký.', 'UNAUTHORIZED');
      return createApiResponse_(
        false, 
        { status: "UNAUTHORIZED", email: activeEmail }, 
        "Tài khoản Google này chưa được cấp quyền truy cập hệ thống. Vui lòng liên hệ Quản lý."
      );
    }

    if (user.Trang_thai !== 'HOAT_DONG') {
      writeAccessLog_(spreadsheet, activeEmail, user.Vai_tro, 'LOGIN', 'Truy cập bị chặn: Trạng thái ' + user.Trang_thai, 'BLOCKED');
      let msg = "Tài khoản của bạn tạm thời đang bị khóa. Vui lòng liên hệ Quản lý.";
      if (user.Trang_thai === 'NGUNG') msg = "Tài khoản của bạn đã ngừng hoạt động.";
      return createApiResponse_(false, { status: user.Trang_thai, email: activeEmail }, msg);
    }

    const userProfile = {
      User_ID: user.User_ID,
      Email: user.Email,
      Ho_ten: user.Ho_ten,
      Vai_tro: user.Vai_tro,
      Trang_thai: user.Trang_thai,
      Don_vi: user.Don_vi
    };

    writeAccessLog_(spreadsheet, activeEmail, user.Vai_tro, 'LOGIN', 'Đăng nhập hệ thống qua Google OAuth thành công.', 'SUCCESS');
    return createApiResponse_(true, userProfile, "Xác thực thành công.");
  } catch (error) {
    console.error("Lỗi getCurrentUser(): " + error.toString());
    return createApiResponse_(false, null, "Lỗi xác thực hệ thống: " + error.toString());
  }
}

/**
 * Lấy cấu hình hệ thống dành cho frontend.
 */
function getSystemConfigPublic() {
  try {
    const user = requirePermission_('theodoi');
    const spreadsheet = getSpreadsheet_();
    
    const configs = {
      DASHBOARD_URL: getConfigValue_('DASHBOARD_URL') || '',
      SYS_NAME: getConfigValue_('SYS_NAME') || 'UMC Wastewater Treatment Management System',
      MAINTENANCE_MODE: getConfigValue_('MAINTENANCE_MODE') || 'false',
      CONTRACTOR_NAME: getConfigValue_('CONTRACTOR_NAME') || 'Công ty Đại Nam'
    };
    
    return createApiResponse_(true, configs, "Tải cấu hình thành công.");
  } catch(error) {
    return createApiResponse_(false, null, error.message || error.toString());
  }
}


// ==========================================
// 1. NHÓM MODULE NHẬT KÝ VẬN HÀNH (OP_LOGS)
// ==========================================

/**
 * Lấy danh sách nhật ký ca trực và lịch sử thao tác.
 */
function getOperationalLogs() {
  try {
    const user = requirePermission_('view_nhatky');
    const spreadsheet = getSpreadsheet_();
    
    const logsSheet = spreadsheet.getSheetByName('OP_LOGS');
    const logs = [];
    if (logsSheet) {
      const values = logsSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[colMap['Log_ID']]) continue;
        
        const ngayFmt = row[colMap['Ngay']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ngay']]).split('T')[0];
          
        logs.push({
          Log_ID: String(row[colMap['Log_ID']]),
          Ngay: ngayFmt,
          Ca: String(row[colMap['Ca']]),
          Nhiet_do: row[colMap['Nhiet_do']],
          pH_dau_vao: row[colMap['pH_dau_vao']],
          pH_dau_ra: row[colMap['pH_dau_ra']],
          DO: row[colMap['DO']],
          SV30: row[colMap['SV30']],
          Luu_luong_nt: row[colMap['Luu_luong_nt']],
          Amoni: row[colMap['Amoni']],
          COD: row[colMap['COD']],
          Tinh_trang_he_thong: String(row[colMap['Tinh_trang_he_thong']]),
          Su_co_phat_sinh: String(row[colMap['Su_co_phat_sinh']]),
          Bien_phap_khac_phuc: String(row[colMap['Bien_phap_khac_phuc']]),
          Hinh_anh_links: String(row[colMap['Hinh_anh_links']]),
          Trang_thai: String(row[colMap['Trang_thai']]),
          Nguoi_tao: String(row[colMap['Nguoi_tao']]),
          // Shell đọc trường Nguoi_truc (nguồn chân lý API) — alias từ cột Nguoi_tao
          Nguoi_truc: String(row[colMap['Nguoi_tao']]),
          Tao_luc: row[colMap['Ngay_tao']],
          Cap_nhat_luc: row[colMap['Ngay_sua']],
          // 4 trường bổ sung theo YeuCau v4 mục 7.1 + 7.2 (guard cho sheet cũ chưa có cột)
          Checklist_Ket_qua: colMap['Checklist_Ket_qua'] !== undefined ? String(row[colMap['Checklist_Ket_qua']] || '') : '',
          Nguoi_xacnhan_BV: colMap['Nguoi_xacnhan_BV'] !== undefined ? String(row[colMap['Nguoi_xacnhan_BV']] || '') : '',
          Chucvu_xacnhan_BV: colMap['Chucvu_xacnhan_BV'] !== undefined ? String(row[colMap['Chucvu_xacnhan_BV']] || '') : '',
          Da_xacnhan_BV: colMap['Da_xacnhan_BV'] !== undefined ? String(row[colMap['Da_xacnhan_BV']]).toUpperCase() === 'TRUE' : false
        });
      }
    }
    
    const histSheet = spreadsheet.getSheetByName('LOG_HISTORIES');
    const histories = [];
    if (histSheet) {
      const values = histSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let j = 1; j < values.length; j++) {
        const row = values[j];
        if (!row[colMap['History_ID']]) continue;
        histories.push({
          History_ID: String(row[colMap['History_ID']]),
          Log_ID: String(row[colMap['Log_ID']]),
          Thoi_gian: row[colMap['Thoi_gian']],
          Nguoi_thuc_hien: String(row[colMap['Nguoi_thuc_hien']]),
          Hanh_dong: String(row[colMap['Hanh_dong']]),
          Ghi_chu: String(row[colMap['Ghi_chu']])
        });
      }
    }
    
    // Danh mục checklist công việc theo ca (LOG_CHECKLIST_ITEMS, chỉ lấy mục đang kích hoạt)
    const ckSheet = spreadsheet.getSheetByName('LOG_CHECKLIST_ITEMS');
    const checklistItems = [];
    if (ckSheet) {
      const ckValues = ckSheet.getDataRange().getValues();
      const ckColMap = {};
      ckValues[0].forEach((h, idx) => ckColMap[h.toString().trim()] = idx);
      for (let k = 1; k < ckValues.length; k++) {
        const row = ckValues[k];
        if (!row[ckColMap['Item_ID']]) continue;
        if (String(row[ckColMap['Kich_hoat']]).toUpperCase() !== 'TRUE') continue;
        checklistItems.push({
          Item_ID: String(row[ckColMap['Item_ID']]),
          Noi_dung: String(row[ckColMap['Noi_dung']]),
          Thu_tu: Number(row[ckColMap['Thu_tu']])
        });
      }
      checklistItems.sort((a, b) => a.Thu_tu - b.Thu_tu);
    }

    return createApiResponse_(true, { logs: logs, histories: histories, checklist_items: checklistItems, currentUserRole: user.Vai_tro, currentUserEmail: user.Email }, "Tải dữ liệu nhật ký thành công.");
  } catch (error) {
    console.error("Lỗi getOperationalLogs(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Lưu nháp hoặc gửi duyệt nhật ký ca trực. Tích hợp soft-validation chỉ tiêu chất lượng.
 */
function saveOperationalLog(logId, logDataJSON, actionType, actionNote) {
  // Hợp đồng Shell: submitLogApproval gọi saveOperationalLog với actionType DUYET/BO_SUNG/KHOA.
  // Chuyển sang luồng duyệt (kiểm approve_nhatky) TRƯỚC khi chạm khóa ghi — CA_TRUC có
  // write_nhatky không được tự duyệt. Nội dung nhật ký không bị ghi đè khi duyệt.
  if (actionType === 'DUYET' || actionType === 'BO_SUNG' || actionType === 'KHOA') {
    return approveOperationalLog(logId, actionType, actionNote);
  }
  const lock = LockService.getScriptLock();
  try {
    // Chờ tối đa 10 giây để nhận khóa ghi tránh tranh chấp dữ liệu
    if (!lock.tryLock(10000)) {
      throw new Error("Hệ thống đang bận xử lý giao dịch khác. Vui lòng thử lại sau.");
    }
    
    const user = requirePermission_('write_nhatky');
    const spreadsheet = getSpreadsheet_();
    const logData = JSON.parse(logDataJSON);
    
    const temp = parseFloat(logData.Nhiet_do);
    const phIn = parseFloat(logData.pH_dau_vao);
    const phOut = parseFloat(logData.pH_dau_ra);
    const doVal = parseFloat(logData.DO);
    const sv30 = parseInt(logData.SV30);
    const flow = parseFloat(logData.Luu_luong_nt);
    const amoni = logData.Amoni !== undefined && logData.Amoni !== '' ? parseFloat(logData.Amoni) : null;
    const cod = logData.COD !== undefined && logData.COD !== '' ? parseFloat(logData.COD) : null;
    // Checklist ca trực + xác nhận Bệnh viện (YeuCau v4 mục 7.1 + 7.2 — không bắt buộc)
    const checklistKq = logData.Checklist_Ket_qua !== undefined ? String(logData.Checklist_Ket_qua) : '';
    const bvName = logData.Nguoi_xacnhan_BV ? String(logData.Nguoi_xacnhan_BV).trim() : '';
    const bvRole = logData.Chucvu_xacnhan_BV ? String(logData.Chucvu_xacnhan_BV).trim() : '';
    const bvConfirmed = logData.Da_xacnhan_BV === true || String(logData.Da_xacnhan_BV).toUpperCase() === 'TRUE';
    
    // Validate cứng dữ liệu cơ bản
    if (isNaN(temp) || temp < 10 || temp > 50) throw new Error("Chỉ số Nhiệt độ phải nằm trong khoảng từ 10 đến 50 °C.");
    if (isNaN(phIn) || phIn < 0 || phIn > 14) throw new Error("pH đầu vào không hợp lệ (phải từ 0 đến 14).");
    if (isNaN(phOut) || phOut < 0 || phOut > 14) throw new Error("pH đầu ra không hợp lệ (phải từ 0 đến 14).");
    if (isNaN(doVal) || doVal < 0 || doVal > 20) throw new Error("Chỉ số DO phải nằm trong khoảng từ 0 đến 20 mg/L.");
    if (isNaN(sv30) || sv30 < 0 || sv30 > 1000) throw new Error("Chỉ số SV30 phải nằm trong khoảng từ 0 đến 1000 mL/L.");
    if (isNaN(flow) || flow < 0) throw new Error("Lưu lượng nước thải không được phép có giá trị âm.");
    
    const logsSheet = spreadsheet.getSheetByName('OP_LOGS');
    if (!logsSheet) throw new Error("Không tìm thấy bảng OP_LOGS.");
    
    const values = logsSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIndex = -1;
    let currentStatus = 'NHAP';
    let creatorEmail = user.Email;
    
    if (logId && logId.trim() !== '') {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colMap['Log_ID']]) === logId) {
          targetRowIndex = i + 1;
          currentStatus = String(values[i][colMap['Trang_thai']]);
          creatorEmail = String(values[i][colMap['Nguoi_tao']]);
          break;
        }
      }
      
      if (targetRowIndex === -1) throw new Error("Không tìm thấy nhật ký có ID: " + logId);
      if (currentStatus === 'DA_KHOA') throw new Error("Không thể chỉnh sửa nhật ký đã được khóa lưu trữ.");
    } else {
      // Chống gửi trùng ca trong cùng ngày
      const checkDate = logData.Ngay.split('T')[0];
      for (let k = 1; k < values.length; k++) {
        const rowNgay = values[k][colMap['Ngay']] instanceof Date 
          ? Utilities.formatDate(values[k][colMap['Ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(values[k][colMap['Ngay']]).split('T')[0];
        if (rowNgay === checkDate && String(values[k][colMap['Ca']]) === logData.Ca) {
          throw new Error("Đã có nhật ký vận hành cho ngày " + checkDate + " - " + (logData.Ca === 'CA_SANG' ? "Ca Sáng" : "Ca Tối"));
        }
      }
    }
    
    // Ánh xạ trạng thái
    let nextStatus = currentStatus;
    if (actionType === 'NHAP') {
      if (user.Vai_tro === 'CA_TRUC' && logId && creatorEmail !== user.Email) {
        throw new Error("Bảo mật: Bạn chỉ có quyền sửa bản nháp của chính mình.");
      }
      nextStatus = 'NHAP';
    } else if (actionType === 'CHO_DUYET') {
      if (user.Vai_tro === 'CA_TRUC' && logId && creatorEmail !== user.Email) {
        throw new Error("Bảo mật: Bạn không thể gửi duyệt nhật ký của người khác.");
      }
      nextStatus = 'CHO_DUYET';
    }
    
    // Sửa sau duyệt (Nhật ký DA_DUYET sửa đổi quay về trạng thái CHO_DUYET)
    let isEditingApproved = false;
    if (currentStatus === 'DA_DUYET' && actionType === 'CHO_DUYET') {
      isEditingApproved = true;
      nextStatus = 'CHO_DUYET';
    }
    
    // --- KHỞI CHẠY VALIDATE MỀM (Chất lượng chất thải ngoài dải) ---
    const softWarnings = [];
    try {
      const thSheet = spreadsheet.getSheetByName('THRESHOLDS');
      if (thSheet) {
        const thValues = thSheet.getDataRange().getValues();
        const thColMap = {};
        thValues[0].forEach((h, idx) => thColMap[h.toString().trim()] = idx);
        
        // Ta cần biết hệ thống vận hành hiện tại (hệ 220 hay 600)
        // Trong trường hợp này ta kiểm tra cả 2 hệ thống hoặc dựa trên chỉ số nhập vào
        for (let r = 1; r < thValues.length; r++) {
          const row = thValues[r];
          if (String(row[thColMap['Kich_hoat']]).toUpperCase() !== 'TRUE') continue;
          if (String(row[thColMap['Nhom']]) !== 'CHAT_LUONG') continue;
          
          const code = String(row[thColMap['Ma_nguong']]);
          const op = String(row[thColMap['Toan_tu']]);
          const val1 = Number(row[thColMap['Gia_tri_1']]);
          const val2 = row[thColMap['Gia_tri_2']] !== '' ? Number(row[thColMap['Gia_tri_2']]) : null;
          
          let checkVal = null;
          let label = '';
          
          if (code.startsWith('SV30_')) {
            checkVal = sv30;
            label = 'SV30';
          } else if (code.startsWith('PH_IN_')) {
            checkVal = phIn;
            label = 'pH đầu vào';
          } else if (code.startsWith('PH_OUT_')) {
            checkVal = phOut;
            label = 'pH đầu ra';
          } else if (code.startsWith('AMONI_') && amoni !== null) {
            checkVal = amoni;
            label = 'Amoni';
          } else if (code.startsWith('COD_') && cod !== null) {
            checkVal = cod;
            label = 'COD';
          }
          
          if (checkVal !== null) {
            let isViolated = false;
            let rangeText = '';
            
            if (op === 'OUT_OF_RANGE') {
              if (checkVal < val1 || checkVal > val2) {
                isViolated = true;
                rangeText = `${val1}–${val2}`;
              }
            } else if (op === '>') {
              if (checkVal > val1) {
                isViolated = true;
                rangeText = `< ${val1}`;
              }
            } else if (op === '<') {
              if (checkVal < val1) {
                isViolated = true;
                rangeText = `>= ${val1}`;
              }
            }
            
            if (isViolated) {
              const systemLabel = code.includes('HE220') ? 'hệ 220' : 'hệ 600';
              softWarnings.push(`${label} (${systemLabel}) ${checkVal} ngoài dải an toàn (${rangeText})`);
            }
          }
        }
      }
    } catch(err) {
      console.error("Lỗi soft validation: " + err.toString());
    }
    
    const nowTime = new Date();
    
    // Ghi vào bảng OP_LOGS
    if (targetRowIndex === -1) {
      const datePart = logData.Ngay.replace(/-/g, '').substring(2, 8);
      logId = "LOG-" + datePart + "-" + String(Math.floor(1000 + Math.random() * 9000));
      
      const newRow = [];
      newRow[colMap['Log_ID']] = logId;
      newRow[colMap['Ngay']] = logData.Ngay;
      newRow[colMap['Ca']] = logData.Ca;
      newRow[colMap['Nhiet_do']] = temp;
      newRow[colMap['pH_dau_vao']] = phIn;
      newRow[colMap['pH_dau_ra']] = phOut;
      newRow[colMap['DO']] = doVal;
      newRow[colMap['SV30']] = sv30;
      newRow[colMap['Luu_luong_nt']] = flow;
      newRow[colMap['Amoni']] = amoni;
      newRow[colMap['COD']] = cod;
      newRow[colMap['Tinh_trang_he_thong']] = logData.Tinh_trang_he_thong || '';
      newRow[colMap['Su_co_phat_sinh']] = logData.Su_co_phat_sinh || '';
      newRow[colMap['Bien_phap_khac_phuc']] = logData.Bien_phap_khac_phuc || '';
      newRow[colMap['Hinh_anh_links']] = logData.Hinh_anh_links || '';
      newRow[colMap['Trang_thai']] = nextStatus;
      newRow[colMap['Nguoi_tao']] = user.Email;
      newRow[colMap['Ngay_tao']] = nowTime;
      newRow[colMap['Nguoi_sua']] = user.Email;
      newRow[colMap['Ngay_sua']] = nowTime;
      // 4 cột mới — guard cho sheet cũ chưa chạy lại setupDatabase
      if (colMap['Checklist_Ket_qua'] !== undefined) newRow[colMap['Checklist_Ket_qua']] = checklistKq;
      if (colMap['Nguoi_xacnhan_BV'] !== undefined) newRow[colMap['Nguoi_xacnhan_BV']] = bvName;
      if (colMap['Chucvu_xacnhan_BV'] !== undefined) newRow[colMap['Chucvu_xacnhan_BV']] = bvRole;
      if (colMap['Da_xacnhan_BV'] !== undefined) newRow[colMap['Da_xacnhan_BV']] = bvConfirmed ? 'TRUE' : 'FALSE';

      logsSheet.appendRow(newRow);
    } else {
      logsSheet.getRange(targetRowIndex, colMap['Nhiet_do'] + 1).setValue(temp);
      logsSheet.getRange(targetRowIndex, colMap['pH_dau_vao'] + 1).setValue(phIn);
      logsSheet.getRange(targetRowIndex, colMap['pH_dau_ra'] + 1).setValue(phOut);
      logsSheet.getRange(targetRowIndex, colMap['DO'] + 1).setValue(doVal);
      logsSheet.getRange(targetRowIndex, colMap['SV30'] + 1).setValue(sv30);
      logsSheet.getRange(targetRowIndex, colMap['Luu_luong_nt'] + 1).setValue(flow);
      logsSheet.getRange(targetRowIndex, colMap['Amoni'] + 1).setValue(amoni);
      logsSheet.getRange(targetRowIndex, colMap['COD'] + 1).setValue(cod);
      logsSheet.getRange(targetRowIndex, colMap['Tinh_trang_he_thong'] + 1).setValue(logData.Tinh_trang_he_thong || '');
      logsSheet.getRange(targetRowIndex, colMap['Su_co_phat_sinh'] + 1).setValue(logData.Su_co_phat_sinh || '');
      logsSheet.getRange(targetRowIndex, colMap['Bien_phap_khac_phuc'] + 1).setValue(logData.Bien_phap_khac_phuc || '');
      logsSheet.getRange(targetRowIndex, colMap['Hinh_anh_links'] + 1).setValue(logData.Hinh_anh_links || '');
      logsSheet.getRange(targetRowIndex, colMap['Trang_thai'] + 1).setValue(nextStatus);
      logsSheet.getRange(targetRowIndex, colMap['Nguoi_sua'] + 1).setValue(user.Email);
      logsSheet.getRange(targetRowIndex, colMap['Ngay_sua'] + 1).setValue(nowTime);
      // 4 cột mới — guard cho sheet cũ chưa chạy lại setupDatabase
      if (colMap['Checklist_Ket_qua'] !== undefined) logsSheet.getRange(targetRowIndex, colMap['Checklist_Ket_qua'] + 1).setValue(checklistKq);
      if (colMap['Nguoi_xacnhan_BV'] !== undefined) logsSheet.getRange(targetRowIndex, colMap['Nguoi_xacnhan_BV'] + 1).setValue(bvName);
      if (colMap['Chucvu_xacnhan_BV'] !== undefined) logsSheet.getRange(targetRowIndex, colMap['Chucvu_xacnhan_BV'] + 1).setValue(bvRole);
      if (colMap['Da_xacnhan_BV'] !== undefined) logsSheet.getRange(targetRowIndex, colMap['Da_xacnhan_BV'] + 1).setValue(bvConfirmed ? 'TRUE' : 'FALSE');
    }
    
    // Ghi nhận lịch sử LOG_HISTORIES
    const histSheet = spreadsheet.getSheetByName('LOG_HISTORIES');
    if (histSheet) {
      const histId = "HST-LOG-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      let actionText = actionType;
      if (isEditingApproved) {
        actionText = "SUA_SAU_DUYET";
      }
      
      let note = actionNote || '';
      if (softWarnings.length > 0) {
        note = (note ? note + " | " : "") + "Cảnh báo chỉ tiêu: " + softWarnings.join(", ");
      }
      
      histSheet.appendRow([
        histId,
        logId,
        nowTime,
        user.Email,
        actionText,
        note
      ]);
    }
    
    // Chuẩn bị payload phản hồi
    const payload = {
      Log_ID: logId,
      softWarnings: softWarnings
    };
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveOperationalLog', 'Log ' + logId + ' | ' + actionType, 'THANH_CONG');

    return createApiResponse_(true, payload, softWarnings.length > 0
      ? "Lưu nhật ký thành công. Phát hiện chỉ tiêu ngoài dải an toàn!" 
      : "Lưu nhật ký vận hành thành công.");
      
  } catch (error) {
    console.error("Lỗi trong saveOperationalLog(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Phê duyệt, yêu cầu bổ sung hoặc khóa nhật ký. Chỉ quản lý được phép.
 */
function approveOperationalLog(logId, actionType, actionNote) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('approve_nhatky');
    const spreadsheet = getSpreadsheet_();
    
    const logsSheet = spreadsheet.getSheetByName('OP_LOGS');
    if (!logsSheet) throw new Error("Không tìm thấy bảng OP_LOGS.");
    
    const values = logsSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIndex = -1;
    let oldStatus = '';
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][colMap['Log_ID']]) === logId) {
        targetRowIndex = i + 1;
        oldStatus = String(values[i][colMap['Trang_thai']]);
        break;
      }
    }
    
    if (targetRowIndex === -1) throw new Error("Không tìm thấy nhật ký cần duyệt.");
    
    const nowTime = new Date();
    let dbNextStatus = oldStatus;
    
    if (actionType === 'DUYET') {
      dbNextStatus = 'DA_DUYET';
    } else if (actionType === 'BO_SUNG') {
      dbNextStatus = 'BO_SUNG';
    } else if (actionType === 'KHOA') {
      dbNextStatus = 'DA_KHOA';
    }
    
    logsSheet.getRange(targetRowIndex, colMap['Trang_thai'] + 1).setValue(dbNextStatus);
    logsSheet.getRange(targetRowIndex, colMap['Nguoi_sua'] + 1).setValue(user.Email);
    logsSheet.getRange(targetRowIndex, colMap['Ngay_sua'] + 1).setValue(nowTime);
    
    // Ghi nhận lịch sử LOG_HISTORIES
    const histSheet = spreadsheet.getSheetByName('LOG_HISTORIES');
    if (histSheet) {
      const histId = "HST-LOG-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      histSheet.appendRow([
        histId,
        logId,
        nowTime,
        user.Email,
        actionType,
        actionNote || ''
      ]);
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'approveOperationalLog', 'Log ' + logId + ' | ' + actionType, 'THANH_CONG');

    return createApiResponse_(true, { Log_ID: logId }, "Cập nhật trạng thái duyệt nhật ký thành công.");
  } catch (error) {
    console.error("Lỗi approveOperationalLog(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Tải ảnh trực tiếp lên Google Drive qua Folder ID chung lưu trong CONFIGS.
 */
function uploadImageToDrive(fileName, base64Data) {
  try {
    const user = requirePermission_('write_nhatky');

    const folderId = getConfigValue_('UPLOAD_FOLDER_ID');
    let folder;
    
    if (folderId && folderId.trim() !== '' && folderId !== '[Dán ID Thư mục Drive lưu ảnh vào đây]') {
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (err) {
        console.warn("Không tìm thấy folder theo ID cấu hình CONFIGS, fallback sang tạo mới.");
      }
    }
    
    if (!folder) {
      const folders = DriveApp.getFoldersByName("UMC_Wastewater_Images");
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("UMC_Wastewater_Images");
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
    }
    
    const contentType = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";"));
    const bytes = Utilities.base64Decode(base64Data.split(",")[1]);
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    const file = folder.createFile(blob);
    
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const result = {
      url: "https://drive.google.com/uc?export=view&id=" + file.getId(),
      id: file.getId()
    };
    
    writeAccessLog_(getSpreadsheet_(), user.Email, user.Vai_tro, 'uploadImageToDrive', 'Tải ảnh ' + fileName, 'THANH_CONG');

    return createApiResponse_(true, result, "Tải hình ảnh lên Google Drive thành công.");
  } catch (error) {
    console.error("Lỗi uploadImageToDrive(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}


// ==========================================
// 2. NHÓM MODULE QUẢN LÝ KHO HÓA CHẤT
// ==========================================

/**
 * Lấy danh sách danh mục hóa chất, số dư tồn kho và lịch sử giao dịch.
 */
function getChemicalsData() {
  try {
    // Bước 5: quyền đọc theo module hóa chất (nhathau/quanly); CA_TRUC không được đọc
    const user = requirePermission_('hoachat');
    const spreadsheet = getSpreadsheet_();
    
    // 1. Đọc CHEMICALS
    const chemSheet = spreadsheet.getSheetByName('CHEMICALS');
    const chemicals = [];
    if (chemSheet) {
      const values = chemSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[colMap['Ma_hoa_chat']]) continue;
        chemicals.push({
          Ma_hoa_chat: String(row[colMap['Ma_hoa_chat']]),
          Ten_hoa_chat: String(row[colMap['Ten_hoa_chat']]),
          Don_vi_tinh: String(row[colMap['Don_vi_tinh']]),
          Nguong_canh_bao_ton: Number(row[colMap['Nguong_canh_bao_ton']]),
          Ghi_chu: String(row[colMap['Ghi_chu']])
        });
      }
    }
    
    // 2. Đọc CHEM_STOCKS
    const stockSheet = spreadsheet.getSheetByName('CHEM_STOCKS');
    const stocks = [];
    if (stockSheet) {
      const values = stockSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let j = 1; j < values.length; j++) {
        const row = values[j];
        if (!row[colMap['Ma_hoa_chat']]) continue;
        stocks.push({
          Ma_hoa_chat: String(row[colMap['Ma_hoa_chat']]),
          Ton_kho: Number(row[colMap['Ton_kho']]),
          Ngay_cap_nhat: row[colMap['Ngay_cap_nhat']]
        });
      }
    }
    
    // 3. Đọc CHEM_TRANSACTIONS
    const transSheet = spreadsheet.getSheetByName('CHEM_TRANSACTIONS');
    const transactions = [];
    if (transSheet) {
      const values = transSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let k = 1; k < values.length; k++) {
        const row = values[k];
        if (!row[colMap['Tx_ID']]) continue;
        
        const ngayFmt = row[colMap['Ngay_thuc_hien']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ngay_thuc_hien']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ngay_thuc_hien']]).split('T')[0];
          
        const hsdFmt = row[colMap['Han_su_dung']] instanceof Date
          ? Utilities.formatDate(row[colMap['Han_su_dung']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Han_su_dung']]).split('T')[0];
          
        transactions.push({
          Tx_ID: String(row[colMap['Tx_ID']]),
          Ma_hoa_chat: String(row[colMap['Ma_hoa_chat']]),
          Loai_giao_dich: String(row[colMap['Loai_giao_dich']]),
          So_luong: Number(row[colMap['So_luong']]),
          Lo_san_xuat: String(row[colMap['Lo_san_xuat']]),
          Han_su_dung: hsdFmt,
          Ngay_thuc_hien: ngayFmt,
          Ghi_chu: String(row[colMap['Ghi_chu']]),
          Nguoi_tao: String(row[colMap['Nguoi_tao']]),
          Ngay_tao: row[colMap['Ngay_tao']]
        });
      }
    }
    
    const result = {
      chemicals: chemicals,
      stocks: stocks,
      transactions: transactions,
      currentUserRole: user.Vai_tro,
      currentUserEmail: user.Email
    };
    
    return createApiResponse_(true, result, "Tải dữ liệu hóa chất thành công.");
  } catch (error) {
    console.error("Lỗi getChemicalsData(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Ghi nhận giao dịch nhập/xuất hóa chất và cập nhật tức thời số dư trong CHEM_STOCKS.
 * Chống tồn kho âm tuyệt đối qua LockService.
 */
function saveChemicalTransaction(transactionDataJSON) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) {
      throw new Error("Hệ thống đang bận xử lý giao dịch hóa chất khác. Vui lòng thử lại sau.");
    }
    
    const user = requirePermission_('write_hoachat');
    const spreadsheet = getSpreadsheet_();
    const transData = JSON.parse(transactionDataJSON);
    
    const qty = parseFloat(transData.So_luong);
    if (isNaN(qty) || qty <= 0) throw new Error("Số lượng giao dịch hóa chất phải lớn hơn 0.");
    if (!transData.Ma_hoa_chat || !transData.Loai_giao_dich || !transData.Ngay_thuc_hien) {
      throw new Error("Vui lòng nhập đầy đủ thông tin bắt buộc.");
    }
    
    const nowTime = new Date();
    const type = transData.Loai_giao_dich; // 'NHAP' hoặc 'XUAT'
    const code = transData.Ma_hoa_chat;
    
    const stockSheet = spreadsheet.getSheetByName('CHEM_STOCKS');
    if (!stockSheet) throw new Error("Không tìm thấy bảng CHEM_STOCKS.");
    
    const stockValues = stockSheet.getDataRange().getValues();
    const stockColMap = {};
    stockValues[0].forEach((h, idx) => stockColMap[h.toString().trim()] = idx);
    
    let targetStockRowIdx = -1;
    let currentStockQty = 0;
    
    for (let i = 1; i < stockValues.length; i++) {
      if (String(stockValues[i][stockColMap['Ma_hoa_chat']]) === code) {
        targetStockRowIdx = i + 1;
        currentStockQty = Number(stockValues[i][stockColMap['Ton_kho']]);
        break;
      }
    }
    
    // Cân bằng kho và chống tồn kho âm
    let nextStockQty = currentStockQty;
    if (type === 'XUAT') {
      if (targetStockRowIdx === -1 || currentStockQty < qty) {
        throw new Error("Chặn tồn kho âm: Số lượng xuất (" + qty + ") vượt quá lượng tồn kho thực tế hiện có (" + currentStockQty + ").");
      }
      nextStockQty = currentStockQty - qty;
    } else if (type === 'NHAP') {
      nextStockQty = currentStockQty + qty;
    }
    
    // Ghi nhận vào CHEM_TRANSACTIONS
    const transSheet = spreadsheet.getSheetByName('CHEM_TRANSACTIONS');
    if (transSheet) {
      const txId = "TX-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      transSheet.appendRow([
        txId,
        code,
        type,
        qty,
        transData.Lo_san_xuat || '',
        transData.Han_su_dung || '',
        transData.Ngay_thuc_hien,
        transData.Ghi_chu || '',
        user.Email,
        nowTime
      ]);
    }
    
    // Cập nhật số dư CHEM_STOCKS
    if (targetStockRowIdx === -1) {
      stockSheet.appendRow([
        code,
        nextStockQty,
        nowTime
      ]);
    } else {
      stockSheet.getRange(targetStockRowIdx, stockColMap['Ton_kho'] + 1).setValue(nextStockQty);
      stockSheet.getRange(targetStockRowIdx, stockColMap['Ngay_cap_nhat'] + 1).setValue(nowTime);
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveChemicalTransaction', 'Giao dịch ' + code + ' | tồn mới ' + nextStockQty, 'THANH_CONG');

    return createApiResponse_(true, { Ma_hoa_chat: code, Ton_kho: nextStockQty }, "Thực hiện giao dịch hóa chất thành công.");
  } catch (error) {
    console.error("Lỗi saveChemicalTransaction(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 3. NHÓM MODULE QUẢN LÝ THIẾT BỊ (EQUIPMENTS)
// ==========================================

/**
 * Tải danh mục thiết bị, nhật ký bảo trì và ghi nhận sự cố.
 */
function getEquipmentData() {
  try {
    // Bước 5: quyền đọc theo module thiết bị (nhathau/quanly); CA_TRUC không được đọc
    const user = requirePermission_('thietbi');
    const spreadsheet = getSpreadsheet_();
    
    // 1. Đọc EQUIPMENTS
    const eqpSheet = spreadsheet.getSheetByName('EQUIPMENTS');
    const equipments = [];
    if (eqpSheet) {
      const values = eqpSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[colMap['Equipment_ID']]) continue;
        
        const ngayLapDatFmt = row[colMap['Ngay_lap_dat']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ngay_lap_dat']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ngay_lap_dat']]).split('T')[0];
          
        const ngayBaoTriGanNhatFmt = row[colMap['Ngay_bao_tri_gan_nhat']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ngay_bao_tri_gan_nhat']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ngay_bao_tri_gan_nhat']]).split('T')[0];
          
        equipments.push({
          Equipment_ID: String(row[colMap['Equipment_ID']]),
          Ten_thiet_bi: String(row[colMap['Ten_thiet_bi']]),
          He_thong: String(row[colMap['He_thong']]),
          Vi_tri: String(row[colMap['Vi_tri']]),
          Hang_SX: String(row[colMap['Hang_SX']]),
          Model: String(row[colMap['Model']]),
          So_luong: Number(row[colMap['So_luong']]),
          Thong_so: String(row[colMap['Thong_so']]),
          Tinh_trang: String(row[colMap['Tinh_trang']]),
          Ngay_lap_dat: ngayLapDatFmt,
          Chu_ky_bao_tri_ngay: Number(row[colMap['Chu_ky_bao_tri_ngay']]),
          Ngay_bao_tri_gan_nhat: ngayBaoTriGanNhatFmt,
          Ghi_chu: String(row[colMap['Ghi_chu']])
        });
      }
    }
    
    // 2. Đọc EQP_MAINTENANCES
    const maintSheet = spreadsheet.getSheetByName('EQP_MAINTENANCES');
    const maintenances = [];
    if (maintSheet) {
      const values = maintSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let j = 1; j < values.length; j++) {
        const row = values[j];
        if (!row[colMap['Maint_ID']]) continue;
        
        const ngayBaoTriFmt = row[colMap['Ngay_bao_tri']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ngay_bao_tri']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ngay_bao_tri']]).split('T')[0];
          
        maintenances.push({
          Maint_ID: String(row[colMap['Maint_ID']]),
          Equipment_ID: String(row[colMap['Equipment_ID']]),
          Ngay_bao_tri: ngayBaoTriFmt,
          Ket_qua: String(row[colMap['Ket_qua']]),
          Noi_dung_bao_tri: String(row[colMap['Noi_dung_bao_tri']]),
          Vat_tu_thay_the: String(row[colMap['Vat_tu_thay_the']]),
          Tai_lieu_links: String(row[colMap['Tai_lieu_links']]),
          Ghi_chu: String(row[colMap['Ghi_chu']]),
          Nguoi_tao: String(row[colMap['Nguoi_tao']]),
          Ngay_tao: row[colMap['Ngay_tao']]
        });
      }
    }
    
    // 3. Đọc EQP_INCIDENTS
    const incidentSheet = spreadsheet.getSheetByName('EQP_INCIDENTS');
    const incidents = [];
    if (incidentSheet) {
      const values = incidentSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let k = 1; k < values.length; k++) {
        const row = values[k];
        if (!row[colMap['Incident_ID']]) continue;
        
        const ngayPhatSinhFmt = row[colMap['Ngay_phat_sinh']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ngay_phat_sinh']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ngay_phat_sinh']]).split('T')[0];
          
        const ngayHoanThanhFmt = row[colMap['Ngay_hoan_thanh']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ngay_hoan_thanh']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ngay_hoan_thanh']]).split('T')[0];
          
        incidents.push({
          Incident_ID: String(row[colMap['Incident_ID']]),
          Equipment_ID: String(row[colMap['Equipment_ID']]),
          Ngay_phat_sinh: ngayPhatSinhFmt,
          Mo_ta_su_co: String(row[colMap['Mo_ta_su_co']]),
          Bien_phap_xu_ly: String(row[colMap['Bien_phap_xu_ly']]),
          Trang_thai: String(row[colMap['Trang_thai']]),
          Nguoi_khac_phuc: String(row[colMap['Nguoi_khac_phuc']]),
          Ngay_hoan_thanh: ngayHoanThanhFmt,
          Hinh_anh_links: String(row[colMap['Hinh_anh_links']]),
          Tai_lieu_links: String(row[colMap['Tai_lieu_links']]),
          Nguoi_tao: String(row[colMap['Nguoi_tao']]),
          Ngay_tao: row[colMap['Ngay_tao']]
        });
      }
    }
    
    return createApiResponse_(true, { equipments: equipments, maintenances: maintenances, incidents: incidents, currentUserRole: user.Vai_tro }, "Tải dữ liệu thiết bị thành công.");
  } catch (error) {
    console.error("Lỗi getEquipmentData(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Thêm mới hoặc cập nhật thông tin thiết bị (Chỉ quản lý được phép).
 */
function saveEquipment(eqpId, eqpDataJSON) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('write_thietbi'); // Đảm bảo quyền chỉnh sửa thiết bị
    const spreadsheet = getSpreadsheet_();
    const eqpData = JSON.parse(eqpDataJSON);
    
    const eqpSheet = spreadsheet.getSheetByName('EQUIPMENTS');
    if (!eqpSheet) throw new Error("Không tìm thấy bảng EQUIPMENTS.");
    
    const values = eqpSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIdx = -1;
    if (eqpId && eqpId.trim() !== '') {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colMap['Equipment_ID']]) === eqpId) {
          targetRowIdx = i + 1;
          break;
        }
      }
      if (targetRowIdx === -1) throw new Error("Không tìm thấy thiết bị có ID: " + eqpId);
    }
    
    const nowTime = new Date();
    
    if (targetRowIdx === -1) {
      // Tạo mới thiết bị
      const randId = "EQP-" + String(Math.floor(1000 + Math.random() * 9000));
      const newRow = [];
      newRow[colMap['Equipment_ID']] = randId;
      newRow[colMap['Ten_thiet_bi']] = eqpData.Ten_thiet_bi;
      newRow[colMap['He_thong']] = eqpData.He_thong;
      newRow[colMap['Vi_tri']] = eqpData.Vi_tri;
      newRow[colMap['Hang_SX']] = eqpData.Hang_SX || '';
      newRow[colMap['Model']] = eqpData.Model || '';
      newRow[colMap['So_luong']] = Number(eqpData.So_luong) || 1;
      newRow[colMap['Thong_so']] = eqpData.Thong_so || '';
      newRow[colMap['Tinh_trang']] = eqpData.Tinh_trang || 'HOAT_DONG';
      newRow[colMap['Ngay_lap_dat']] = eqpData.Ngay_lap_dat || nowTime;
      newRow[colMap['Chu_ky_bao_tri_ngay']] = Number(eqpData.Chu_ky_bao_tri_ngay) || 90;
      newRow[colMap['Ngay_bao_tri_gan_nhat']] = eqpData.Ngay_bao_tri_gan_nhat || nowTime;
      newRow[colMap['Ghi_chu']] = eqpData.Ghi_chu || '';
      
      eqpSheet.appendRow(newRow);
      eqpId = randId;
    } else {
      // Cập nhật thông số thiết bị
      eqpSheet.getRange(targetRowIdx, colMap['Ten_thiet_bi'] + 1).setValue(eqpData.Ten_thiet_bi);
      eqpSheet.getRange(targetRowIdx, colMap['He_thong'] + 1).setValue(eqpData.He_thong);
      eqpSheet.getRange(targetRowIdx, colMap['Vi_tri'] + 1).setValue(eqpData.Vi_tri);
      eqpSheet.getRange(targetRowIdx, colMap['Hang_SX'] + 1).setValue(eqpData.Hang_SX || '');
      eqpSheet.getRange(targetRowIdx, colMap['Model'] + 1).setValue(eqpData.Model || '');
      eqpSheet.getRange(targetRowIdx, colMap['So_luong'] + 1).setValue(Number(eqpData.So_luong) || 1);
      eqpSheet.getRange(targetRowIdx, colMap['Thong_so'] + 1).setValue(eqpData.Thong_so || '');
      eqpSheet.getRange(targetRowIdx, colMap['Tinh_trang'] + 1).setValue(eqpData.Tinh_trang);
      eqpSheet.getRange(targetRowIdx, colMap['Ngay_lap_dat'] + 1).setValue(eqpData.Ngay_lap_dat);
      eqpSheet.getRange(targetRowIdx, colMap['Chu_ky_bao_tri_ngay'] + 1).setValue(Number(eqpData.Chu_ky_bao_tri_ngay));
      eqpSheet.getRange(targetRowIdx, colMap['Ngay_bao_tri_gan_nhat'] + 1).setValue(eqpData.Ngay_bao_tri_gan_nhat);
      eqpSheet.getRange(targetRowIdx, colMap['Ghi_chu'] + 1).setValue(eqpData.Ghi_chu || '');
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveEquipment', 'Thiết bị ' + eqpId, 'THANH_CONG');

    return createApiResponse_(true, { Equipment_ID: eqpId }, "Lưu thông tin hồ sơ thiết bị thành công.");
  } catch (error) {
    console.error("Lỗi saveEquipment(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ghi nhận nhật ký bảo trì định kỳ của thiết bị, cập nhật ngày bảo trì gần nhất.
 */
function saveEquipmentMaintenance(maintDataJSON) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('write_thietbi');
    const spreadsheet = getSpreadsheet_();
    const maintData = JSON.parse(maintDataJSON);
    
    const eqpId = maintData.Equipment_ID;
    if (!eqpId) throw new Error("Mã thiết bị bảo trì bắt buộc phải nhập.");
    
    const nowTime = new Date();
    
    // Ghi vào bảng EQP_MAINTENANCES
    const maintSheet = spreadsheet.getSheetByName('EQP_MAINTENANCES');
    if (maintSheet) {
      const maintId = "MNT-EQP-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      maintSheet.appendRow([
        maintId,
        eqpId,
        maintData.Ngay_bao_tri,
        maintData.Ket_qua || 'DAT_YEU_CAU',
        maintData.Noi_dung_bao_tri || '',
        maintData.Vat_tu_thay_the || '',
        maintData.Tai_lieu_links || '',
        maintData.Ghi_chu || '',
        user.Email,
        nowTime
      ]);
    }
    
    // Cập nhật trạng thái và ngày bảo trì gần nhất trong EQUIPMENTS
    const eqpSheet = spreadsheet.getSheetByName('EQUIPMENTS');
    if (eqpSheet) {
      const values = eqpSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colMap['Equipment_ID']]) === eqpId) {
          const rowNum = i + 1;
          eqpSheet.getRange(rowNum, colMap['Ngay_bao_tri_gan_nhat'] + 1).setValue(maintData.Ngay_bao_tri);
          
          // Nếu kết quả bảo trì báo HONG_HOC, tự động đặt tình trạng thiết bị thành SU_CO
          if (maintData.Ket_qua === 'HONG_HOC') {
            eqpSheet.getRange(rowNum, colMap['Tinh_trang'] + 1).setValue('SU_CO');
          } else {
            eqpSheet.getRange(rowNum, colMap['Tinh_trang'] + 1).setValue('HOAT_DONG');
          }
          break;
        }
      }
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveEquipmentMaintenance', 'Ghi nhật ký bảo trì thiết bị', 'THANH_CONG');

    return createApiResponse_(true, null, "Ghi nhận nhật ký bảo trì thành công.");
  } catch (error) {
    console.error("Lỗi saveEquipmentMaintenance(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ghi nhận sự cố hỏng hóc hoặc cập nhật quá trình sửa chữa.
 */
function saveEquipmentIncident(incidentId, incidentDataJSON, actionType, actionNote) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('write_thietbi');
    const spreadsheet = getSpreadsheet_();
    const incidentData = JSON.parse(incidentDataJSON);
    
    const eqpId = incidentData.Equipment_ID;
    if (!eqpId) throw new Error("Mã thiết bị xảy ra sự cố bắt buộc phải có.");
    
    const incidentSheet = spreadsheet.getSheetByName('EQP_INCIDENTS');
    if (!incidentSheet) throw new Error("Không tìm thấy bảng EQP_INCIDENTS.");
    
    const values = incidentSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIdx = -1;
    let oldStatus = 'CHO_XU_LY';
    
    if (incidentId && incidentId.trim() !== '') {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colMap['Incident_ID']]) === incidentId) {
          targetRowIdx = i + 1;
          oldStatus = String(values[i][colMap['Trang_thai']]);
          break;
        }
      }
      if (targetRowIdx === -1) throw new Error("Không tìm thấy sự cố có ID: " + incidentId);
    }
    
    const nowTime = new Date();
    
    // Quyết định trạng thái sự cố tiếp theo
    let nextStatus = oldStatus;
    if (actionType === 'TAO') {
      nextStatus = 'CHO_XU_LY';
    } else if (actionType === 'SUA_CHUA') {
      nextStatus = 'DANG_XU_LY';
    } else if (actionType === 'HOAN_THANH') {
      nextStatus = 'DA_XU_LY';
    }
    
    if (targetRowIdx === -1) {
      const randId = "INC-EQP-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      const newRow = [];
      newRow[colMap['Incident_ID']] = randId;
      newRow[colMap['Equipment_ID']] = eqpId;
      newRow[colMap['Ngay_phat_sinh']] = incidentData.Ngay_phat_sinh || nowTime;
      newRow[colMap['Mo_ta_su_co']] = incidentData.Mo_ta_su_co || '';
      newRow[colMap['Bien_phap_xu_ly']] = incidentData.Bien_phap_xu_ly || '';
      newRow[colMap['Trang_thai']] = nextStatus;
      newRow[colMap['Nguoi_khac_phuc']] = '';
      newRow[colMap['Ngay_hoan_thanh']] = '';
      newRow[colMap['Hinh_anh_links']] = incidentData.Hinh_anh_links || '';
      newRow[colMap['Tai_lieu_links']] = incidentData.Tai_lieu_links || '';
      newRow[colMap['Nguoi_tao']] = user.Email;
      newRow[colMap['Ngay_tao']] = nowTime;
      
      incidentSheet.appendRow(newRow);
      incidentId = randId;
    } else {
      incidentSheet.getRange(targetRowIdx, colMap['Bien_phap_xu_ly'] + 1).setValue(incidentData.Bien_phap_xu_ly || '');
      incidentSheet.getRange(targetRowIdx, colMap['Trang_thai'] + 1).setValue(nextStatus);
      incidentSheet.getRange(targetRowIdx, colMap['Hinh_anh_links'] + 1).setValue(incidentData.Hinh_anh_links || '');
      incidentSheet.getRange(targetRowIdx, colMap['Tai_lieu_links'] + 1).setValue(incidentData.Tai_lieu_links || '');
      
      if (nextStatus === 'DA_XU_LY') {
        incidentSheet.getRange(targetRowIdx, colMap['Nguoi_khac_phuc'] + 1).setValue(user.Email);
        incidentSheet.getRange(targetRowIdx, colMap['Ngay_hoan_thanh'] + 1).setValue(nowTime);
      }
    }
    
    // Tự động chuyển đổi tình trạng thiết bị trong EQUIPMENTS
    const eqpSheet = spreadsheet.getSheetByName('EQUIPMENTS');
    if (eqpSheet) {
      const eqpValues = eqpSheet.getDataRange().getValues();
      const eqpColMap = {};
      eqpValues[0].forEach((h, idx) => eqpColMap[h.toString().trim()] = idx);
      
      for (let k = 1; k < eqpValues.length; k++) {
        if (String(eqpValues[k][eqpColMap['Equipment_ID']]) === eqpId) {
          const rowNum = k + 1;
          // Nếu sự cố đã được xử lý xong, đưa thiết bị về HOAT_DONG, ngược lại đặt SU_CO
          if (nextStatus === 'DA_XU_LY') {
            eqpSheet.getRange(rowNum, eqpColMap['Tinh_trang'] + 1).setValue('HOAT_DONG');
          } else {
            eqpSheet.getRange(rowNum, eqpColMap['Tinh_trang'] + 1).setValue('SU_CO');
          }
          break;
        }
      }
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveEquipmentIncident', 'Sự cố ' + incidentId + ' | ' + actionType, 'THANH_CONG');

    return createApiResponse_(true, { Incident_ID: incidentId }, "Cập nhật sự cố thiết bị thành công.");
  } catch (error) {
    console.error("Lỗi saveEquipmentIncident(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 4. NHÓM MODULE BÁO CÁO VẬN HÀNH (REPORTS)
// ==========================================

/**
 * Lấy danh sách báo cáo đã lập.
 */
function getReportsList() {
  try {
    const user = requirePermission_('view_baocao');
    const spreadsheet = getSpreadsheet_();
    
    const sheet = spreadsheet.getSheetByName('REPORTS');
    const reports = [];
    if (sheet) {
      const values = sheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[colMap['Report_ID']]) continue;
        
        const tuNgayFmt = row[colMap['Tu_ngay']] instanceof Date
          ? Utilities.formatDate(row[colMap['Tu_ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Tu_ngay']]).split('T')[0];
          
        const denNgayFmt = row[colMap['Den_ngay']] instanceof Date
          ? Utilities.formatDate(row[colMap['Den_ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Den_ngay']]).split('T')[0];
          
        reports.push({
          Report_ID: String(row[colMap['Report_ID']]),
          Loai_bao_cao: String(row[colMap['Loai_bao_cao']]),
          Ten_bao_cao: String(row[colMap['Ten_bao_cao']]),
          Tu_ngay: tuNgayFmt,
          Den_ngay: denNgayFmt,
          Trang_thai: String(row[colMap['Trang_thai']]),
          Nguoi_tao: String(row[colMap['Nguoi_tao']]),
          Tao_luc: row[colMap['Ngay_tao']],
          Nguoi_duyet: String(row[colMap['Nguoi_duyet']]),
          Duyet_luc: row[colMap['Ngay_duyet']],
          Ghi_chu_duyet: String(row[colMap['Ghi_chu_duyet']]),
          Noi_dung_json: String(row[colMap['Noi_dung_json']])
        });
      }
    }
    
    // Mới xếp lên trước
    reports.sort((a, b) => new Date(b.Tao_luc) - new Date(a.Tao_luc));
    return createApiResponse_(true, reports, "Lấy danh sách báo cáo thành công.");
  } catch (error) {
    console.error("Lỗi getReportsList(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Tổng hợp số liệu trung thực từ bảng OP_LOGS trong khoảng ngày được chọn.
 */
function compileReportData(reportType, fromDate, toDate) {
  try {
    requirePermission_('view_baocao');
    const spreadsheet = getSpreadsheet_();
    
    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    
    const logsSheet = spreadsheet.getSheetByName('OP_LOGS');
    if (!logsSheet) throw new Error("Không tìm thấy bảng OP_LOGS.");
    
    const values = logsSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let totalLogs = 0;
    let totalFlow = 0;
    let sumTemp = 0, sumPhIn = 0, sumPhOut = 0, sumDo = 0, sumSv30 = 0;
    let sumAmoni = 0, sumCod = 0;
    let countAmoni = 0, countCod = 0;
    
    const logsList = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[colMap['Log_ID']]) continue;
      
      const logDateStr = row[colMap['Ngay']] instanceof Date
        ? Utilities.formatDate(row[colMap['Ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(row[colMap['Ngay']]).split('T')[0];
        
      const logDate = new Date(logDateStr);
      if (logDate >= start && logDate <= end) {
        const flow = Number(row[colMap['Luu_luong_nt']]) || 0;
        const temp = Number(row[colMap['Nhiet_do']]) || 0;
        const phIn = Number(row[colMap['pH_dau_vao']]) || 0;
        const phOut = Number(row[colMap['pH_dau_ra']]) || 0;
        const doVal = Number(row[colMap['DO']]) || 0;
        const sv30 = Number(row[colMap['SV30']]) || 0;
        
        const amoniRaw = row[colMap['Amoni']];
        const codRaw = row[colMap['COD']];
        
        totalFlow += flow;
        sumTemp += temp;
        sumPhIn += phIn;
        sumPhOut += phOut;
        sumDo += doVal;
        sumSv30 += sv30;
        totalLogs++;
        
        if (amoniRaw !== undefined && amoniRaw !== null && amoniRaw !== '' && !isNaN(parseFloat(amoniRaw))) {
          sumAmoni += parseFloat(amoniRaw);
          countAmoni++;
        }
        if (codRaw !== undefined && codRaw !== null && codRaw !== '' && !isNaN(parseFloat(codRaw))) {
          sumCod += parseFloat(codRaw);
          countCod++;
        }
        
        logsList.push({
          Log_ID: String(row[colMap['Log_ID']]),
          Ngay: logDateStr,
          Ca: String(row[colMap['Ca']]),
          Nguoi_truc: String(row[colMap['Nguoi_tao']]),
          Nhiet_do: temp,
          pH_dau_vao: phIn,
          pH_dau_ra: phOut,
          DO: doVal,
          SV30: sv30,
          Luu_luong_nt: flow,
          Amoni: amoniRaw,
          COD: codRaw
        });
      }
    }
    
    const summary = {
      total_logs: totalLogs,
      total_flow: totalFlow,
      avg_temp: totalLogs > 0 ? Number((sumTemp / totalLogs).toFixed(1)) : 0,
      avg_ph_in: totalLogs > 0 ? Number((sumPhIn / totalLogs).toFixed(2)) : 0,
      avg_ph_out: totalLogs > 0 ? Number((sumPhOut / totalLogs).toFixed(2)) : 0,
      avg_do: totalLogs > 0 ? Number((sumDo / totalLogs).toFixed(1)) : 0,
      avg_sv30: totalLogs > 0 ? Math.round(sumSv30 / totalLogs) : 0,
      avg_amoni: countAmoni > 0 ? Number((sumAmoni / countAmoni).toFixed(2)) : null,
      avg_cod: countCod > 0 ? Number((sumCod / countCod).toFixed(1)) : null
    };
    
    const payload = {
      reportType: reportType,
      period: { from: fromDate, to: toDate },
      summary: summary,
      logs: logsList
    };
    
    return createApiResponse_(true, payload, "Tổng hợp số liệu thành công.");
  } catch (error) {
    console.error("Lỗi compileReportData(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Lưu hoặc đệ trình báo cáo tổng hợp.
 */
function saveReport(reportId, reportDataJSON, actionType) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('view_baocao');
    const spreadsheet = getSpreadsheet_();
    const rptData = JSON.parse(reportDataJSON);
    
    const rptSheet = spreadsheet.getSheetByName('REPORTS');
    if (!rptSheet) throw new Error("Không tìm thấy bảng REPORTS.");
    
    const values = rptSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIdx = -1;
    if (reportId && reportId.trim() !== '') {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colMap['Report_ID']]) === reportId) {
          targetRowIdx = i + 1;
          break;
        }
      }
    }
    
    const nowTime = new Date();
    const status = actionType === 'GUI' ? 'CHO_DUYET' : 'NHAP';
    
    if (targetRowIdx === -1) {
      reportId = "RPT-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      const newRow = [];
      newRow[colMap['Report_ID']] = reportId;
      newRow[colMap['Loai_bao_cao']] = rptData.Loai_bao_cao;
      newRow[colMap['Ten_bao_cao']] = rptData.Ten_bao_cao;
      newRow[colMap['Tu_ngay']] = rptData.Tu_ngay;
      newRow[colMap['Den_ngay']] = rptData.Den_ngay;
      newRow[colMap['Trang_thai']] = status;
      newRow[colMap['Noi_dung_json']] = JSON.stringify(rptData.compiledData || rptData);
      newRow[colMap['Nguoi_tao']] = user.Email;
      newRow[colMap['Ngay_tao']] = nowTime;
      newRow[colMap['Nguoi_duyet']] = '';
      newRow[colMap['Ngay_duyet']] = '';
      newRow[colMap['Ghi_chu_duyet']] = '';
      
      rptSheet.appendRow(newRow);
    } else {
      rptSheet.getRange(targetRowIdx, colMap['Ten_bao_cao'] + 1).setValue(rptData.Ten_bao_cao);
      rptSheet.getRange(targetRowIdx, colMap['Trang_thai'] + 1).setValue(status);
      rptSheet.getRange(targetRowIdx, colMap['Noi_dung_json'] + 1).setValue(JSON.stringify(rptData.compiledData || rptData));
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveReport', 'Báo cáo ' + reportId, 'THANH_CONG');

    return createApiResponse_(true, { Report_ID: reportId }, "Lưu báo cáo thành công.");
  } catch (error) {
    console.error("Lỗi saveReport(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Duyệt hoặc Từ chối báo cáo. Chỉ quản lý được phép.
 */
function approveReport(reportId, actionType, note) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('approve_baocao');
    const spreadsheet = getSpreadsheet_();
    
    const rptSheet = spreadsheet.getSheetByName('REPORTS');
    if (!rptSheet) throw new Error("Không tìm thấy bảng REPORTS.");
    
    const values = rptSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][colMap['Report_ID']]) === reportId) {
        targetRowIdx = i + 1;
        break;
      }
    }
    
    if (targetRowIdx === -1) throw new Error("Không tìm thấy báo cáo.");
    
    const nowTime = new Date();
    const status = actionType === 'DUYET' ? 'DA_DUYET' : 'TU_CHOI';
    
    rptSheet.getRange(targetRowIdx, colMap['Trang_thai'] + 1).setValue(status);
    rptSheet.getRange(targetRowIdx, colMap['Nguoi_duyet'] + 1).setValue(user.Email);
    rptSheet.getRange(targetRowIdx, colMap['Ngay_duyet'] + 1).setValue(nowTime);
    rptSheet.getRange(targetRowIdx, colMap['Ghi_chu_duyet'] + 1).setValue(note || '');
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'approveReport', 'Báo cáo ' + reportId + ' | ' + actionType, 'THANH_CONG');

    return createApiResponse_(true, { Report_ID: reportId }, "Phê duyệt báo cáo thành công.");
  } catch (error) {
    console.error("Lỗi approveReport(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 5. NHÓM THỜI GIAN THỰC & DỰ LIỆU CẢNH BÁO (ALERTS)
// ==========================================

/**
 * Hàm lấy cấu hình ngưỡng (called by frontend module nguong).
 */
function getThresholds() {
  try {
    const user = requirePermission_('theodoi');
    const spreadsheet = getSpreadsheet_();
    
    const thSheet = spreadsheet.getSheetByName('THRESHOLDS');
    const thresholds = [];
    if (thSheet) {
      const values = thSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[colMap['Threshold_ID']]) continue;
        
        const apDungNgayFmt = row[colMap['Ap_dung_ngay']] instanceof Date
          ? Utilities.formatDate(row[colMap['Ap_dung_ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(row[colMap['Ap_dung_ngay']]).split('T')[0];
          
        thresholds.push({
          Threshold_ID: String(row[colMap['Threshold_ID']]),
          Ma_nguong: String(row[colMap['Ma_nguong']]),
          Ten_nguong: String(row[colMap['Ten_nguong']]),
          Nhom: String(row[colMap['Nhom']]),
          He_thong: String(row[colMap['He_thong']]),
          Toan_tu: String(row[colMap['Toan_tu']]),
          Gia_tri_1: row[colMap['Gia_tri_1']],
          Gia_tri_2: row[colMap['Gia_tri_2']],
          Ap_dung_ngay: apDungNgayFmt,
          Muc_do: String(row[colMap['Muc_do']]),
          Kich_hoat: String(row[colMap['Kich_hoat']]).toUpperCase() === 'TRUE',
          Ghi_chu: String(row[colMap['Ghi_chu']]),
          Nguoi_sua: String(row[colMap['Nguoi_sua']]),
          Ngay_sua: row[colMap['Ngay_sua']]
        });
      }
    }
    
    return createApiResponse_(true, thresholds, "Tải dữ liệu cấu hình ngưỡng thành công.");
  } catch (error) {
    console.error("Lỗi getThresholds(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Lưu hoặc cập nhật cấu hình ngưỡng động.
 */
function saveThreshold(thresholdId, thresholdDataJSON) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('write_nguong');
    const spreadsheet = getSpreadsheet_();
    const thData = JSON.parse(thresholdDataJSON);
    
    const thSheet = spreadsheet.getSheetByName('THRESHOLDS');
    if (!thSheet) throw new Error("Không tìm thấy bảng THRESHOLDS.");
    
    const values = thSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIdx = -1;
    if (thresholdId && thresholdId.trim() !== '') {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colMap['Threshold_ID']]) === thresholdId) {
          targetRowIdx = i + 1;
          break;
        }
      }
      if (targetRowIdx === -1) throw new Error("Không tìm thấy ngưỡng có ID: " + thresholdId);
    }
    
    const nowTime = new Date();
    
    if (targetRowIdx === -1) {
      const randId = "TH-" + String(Math.floor(1000 + Math.random() * 9000));
      const newRow = [];
      newRow[colMap['Threshold_ID']] = randId;
      newRow[colMap['Ma_nguong']] = thData.Ma_nguong;
      newRow[colMap['Ten_nguong']] = thData.Ten_nguong;
      newRow[colMap['Nhom']] = thData.Nhom;
      newRow[colMap['He_thong']] = thData.He_thong;
      newRow[colMap['Toan_tu']] = thData.Toan_tu;
      newRow[colMap['Gia_tri_1']] = Number(thData.Gia_tri_1);
      newRow[colMap['Gia_tri_2']] = thData.Gia_tri_2 !== '' ? Number(thData.Gia_tri_2) : '';
      newRow[colMap['Ap_dung_ngay']] = thData.Ap_dung_ngay || nowTime;
      newRow[colMap['Muc_do']] = thData.Muc_do || 'WARNING';
      newRow[colMap['Kich_hoat']] = thData.Kich_hoat !== undefined ? String(thData.Kich_hoat).toUpperCase() : 'TRUE';
      newRow[colMap['Ghi_chu']] = thData.Ghi_chu || '';
      newRow[colMap['Nguoi_sua']] = user.Email;
      newRow[colMap['Ngay_sua']] = nowTime;
      
      thSheet.appendRow(newRow);
      thresholdId = randId;
    } else {
      thSheet.getRange(targetRowIdx, colMap['Ten_nguong'] + 1).setValue(thData.Ten_nguong);
      thSheet.getRange(targetRowIdx, colMap['Toan_tu'] + 1).setValue(thData.Toan_tu);
      thSheet.getRange(targetRowIdx, colMap['Gia_tri_1'] + 1).setValue(Number(thData.Gia_tri_1));
      thSheet.getRange(targetRowIdx, colMap['Gia_tri_2'] + 1).setValue(thData.Gia_tri_2 !== '' ? Number(thData.Gia_tri_2) : '');
      thSheet.getRange(targetRowIdx, colMap['Muc_do'] + 1).setValue(thData.Muc_do);
      thSheet.getRange(targetRowIdx, colMap['Kich_hoat'] + 1).setValue(String(thData.Kich_hoat).toUpperCase());
      thSheet.getRange(targetRowIdx, colMap['Ghi_chu'] + 1).setValue(thData.Ghi_chu || '');
      thSheet.getRange(targetRowIdx, colMap['Nguoi_sua'] + 1).setValue(user.Email);
      thSheet.getRange(targetRowIdx, colMap['Ngay_sua'] + 1).setValue(nowTime);
    }
    
    // Clear cache để cấu hình ngưỡng được kích hoạt lập tức
    CacheService.getScriptCache().remove('THRESHOLDS_CACHE');
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveThreshold', 'Ngưỡng ' + thresholdId, 'THANH_CONG');

    return createApiResponse_(true, { Threshold_ID: thresholdId }, "Cập nhật ngưỡng thành công.");
  } catch (error) {
    console.error("Lỗi saveThreshold(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Bật/tắt kích hoạt một quy tắc ngưỡng.
 */
function toggleThreshold(thresholdId, isKichHoat) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('write_nguong');
    const spreadsheet = getSpreadsheet_();
    
    const thSheet = spreadsheet.getSheetByName('THRESHOLDS');
    if (!thSheet) throw new Error("Không tìm thấy bảng THRESHOLDS.");
    
    const values = thSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][colMap['Threshold_ID']]) === thresholdId) {
        targetRowIdx = i + 1;
        break;
      }
    }
    
    if (targetRowIdx === -1) throw new Error("Không tìm thấy quy tắc ngưỡng.");
    
    const nowTime = new Date();
    thSheet.getRange(targetRowIdx, colMap['Kich_hoat'] + 1).setValue(isKichHoat ? 'TRUE' : 'FALSE');
    thSheet.getRange(targetRowIdx, colMap['Nguoi_sua'] + 1).setValue(user.Email);
    thSheet.getRange(targetRowIdx, colMap['Ngay_sua'] + 1).setValue(nowTime);
    
    CacheService.getScriptCache().remove('THRESHOLDS_CACHE');
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'toggleThreshold', 'Ngưỡng ' + thresholdId + ' | Kich_hoat=' + isKichHoat, 'THANH_CONG');

    return createApiResponse_(true, { Threshold_ID: thresholdId, Kich_hoat: isKichHoat }, "Thay đổi trạng thái quy tắc thành công.");
  } catch (error) {
    console.error("Lỗi toggleThreshold(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Quét dữ liệu lưu lượng thô và trả về danh sách cảnh báo, tự động nạp cảnh báo mới.
 */
function getAlertsData() {
  try {
    const user = requirePermission_('theodoi');
    const spreadsheet = getSpreadsheet_();
    
    const dataSpreadsheetId = getConfigValue_('WASTEWATER_DATA_SPREADSHEET_ID');
    if (!dataSpreadsheetId) {
      throw new Error("Cấu hình hệ thống thiếu key WASTEWATER_DATA_SPREADSHEET_ID.");
    }
    
    let dataSpreadsheet;
    try {
      dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    } catch (err) {
      throw new Error("Không thể kết nối đến tệp dữ liệu lưu lượng nước thải. Vui lòng kiểm tra lại quyền truy cập hoặc ID.");
    }
    
    const dbSheet = dataSpreadsheet.getSheetByName('DASHBOARD_DATA');
    if (!dbSheet) throw new Error("Không tìm thấy tab 'DASHBOARD_DATA' trong tệp lưu lượng.");
    
    const dbValues = dbSheet.getDataRange().getValues();
    const dbHeaders = dbValues[0];
    const colMap = {};
    dbHeaders.forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    // Đọc tab ALERTS hiện tại
    const alertsSheet = spreadsheet.getSheetByName('ALERTS');
    if (!alertsSheet) throw new Error("Không tìm thấy bảng ALERTS.");
    
    const alertValues = alertsSheet.getDataRange().getValues();
    const alertColMap = {};
    alertValues[0].forEach((h, idx) => alertColMap[h.toString().trim()] = idx);
    
    const existingAlertsMap = {};
    for (let j = 1; j < alertValues.length; j++) {
      const row = alertValues[j];
      const datePart = row[alertColMap['Ngay']] instanceof Date
        ? Utilities.formatDate(row[alertColMap['Ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(row[alertColMap['Ngay']]).split('T')[0];
      const code = String(row[alertColMap['Loai_canh_bao']]);
      const value = String(row[alertColMap['Gia_tri']]);
      const key = `${datePart}::${code}::${value}`;
      existingAlertsMap[key] = {
        rowNum: j + 1,
        status: String(row[alertColMap['Trang_thai']])
      };
    }
    
    // Đọc cấu hình THRESHOLDS đang kích hoạt
    const thresholds = [];
    const thSheet = spreadsheet.getSheetByName('THRESHOLDS');
    if (thSheet) {
      const thValues = thSheet.getDataRange().getValues();
      const thColMap = {};
      thValues[0].forEach((h, idx) => thColMap[h.toString().trim()] = idx);
      
      for (let r = 1; r < thValues.length; r++) {
        const row = thValues[r];
        if (String(row[thColMap['Kich_hoat']]).toUpperCase() === 'TRUE' && String(row[thColMap['Nhom']]) === 'LUU_LUONG') {
          thresholds.push({
            Ma_nguong: String(row[thColMap['Ma_nguong']]),
            Toan_tu: String(row[thColMap['Toan_tu']]),
            Gia_tri_1: Number(row[thColMap['Gia_tri_1']]),
            Gia_tri_2: row[thColMap['Gia_tri_2']] !== '' ? Number(row[thColMap['Gia_tri_2']]) : null,
            Muc_do: String(row[thColMap['Muc_do']]),
            Ten_nguong: String(row[thColMap['Ten_nguong']])
          });
        }
      }
    }
    
    // Thực hiện quét dữ liệu và sinh cảnh báo
    const generatedAlerts = [];
    const nowTime = new Date();
    
    for (let i = 1; i < dbValues.length - 1; i++) {
      const todayRow = dbValues[i];
      const tomorrowRow = dbValues[i + 1];
      const todayRowIdx = i + 1;
      const tomorrowRowIdx = i + 2;
      
      const iso = String(todayRow[colMap['iso']]).split('T')[0];
      const thu = String(todayRow[colMap['thu']]).trim();
      
      if (!iso || iso.trim() === '' || iso === 'undefined') continue;
      
      // 1. KIỂM TRA LỖI CÔNG THỨC (FIX-02)
      const mandatoryCols = ['nt7', 'nt17', 's600', 's220', 'capA', 'capB', 'llvaoB'];
      let hasFormulaError = false;
      
      mandatoryCols.forEach(col => {
        const valToday = todayRow[colMap[col]];
        if (valToday !== null && typeof valToday === 'string' && valToday.trim().startsWith('#')) {
          generatedAlerts.push({
            Ngay: iso,
            Loai_canh_bao: 'FORMULA_ERROR',
            Muc_do: 'DATA_ERROR',
            Noi_dung: `Lỗi công thức tại dòng ${todayRowIdx}, cột [${col}]: giá trị lỗi [${valToday}].`,
            Gia_tri: valToday,
            Nguong: 'Không lỗi'
          });
          hasFormulaError = true;
        }
        
        const valTomorrow = tomorrowRow[colMap[col]];
        if (valTomorrow !== null && typeof valTomorrow === 'string' && valTomorrow.trim().startsWith('#')) {
          generatedAlerts.push({
            Ngay: iso,
            Loai_canh_bao: 'FORMULA_ERROR',
            Muc_do: 'DATA_ERROR',
            Noi_dung: `Lỗi công thức tại dòng ${tomorrowRowIdx}, cột [${col}]: giá trị lỗi [${valTomorrow}].`,
            Gia_tri: valTomorrow,
            Nguong: 'Không lỗi'
          });
          hasFormulaError = true;
        }
      });
      
      if (hasFormulaError) continue;
      
      // 2. KIỂM TRA KHOẢNG CÁCH NGÀY (FIX-01 & FIX-03)
      const tomorrowIso = String(tomorrowRow[colMap['iso']]).split('T')[0];
      const todayDate = new Date(iso);
      const tomorrowDate = new Date(tomorrowIso);
      const diffDays = Math.round((tomorrowDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        generatedAlerts.push({
          Ngay: iso,
          Loai_canh_bao: 'DUPLICATE_DATE',
          Muc_do: 'DATA_ERROR',
          Noi_dung: `Trùng ngày: Trùng dòng cùng ngày ${iso} tại dòng ${todayRowIdx} và ${tomorrowRowIdx}.`,
          Gia_tri: 2,
          Nguong: 'Độc bản'
        });
        continue;
      }
      
      if (diffDays !== 1) {
        const missingDays = diffDays - 1;
        generatedAlerts.push({
          Ngay: iso,
          Loai_canh_bao: 'DATA_GAP',
          Muc_do: 'DATA_ERROR',
          Noi_dung: `Gián đoạn chuỗi số liệu: Ngày trước: ${iso}, Ngày sau: ${tomorrowIso}, Số ngày bị thiếu: ${missingDays} ngày. Các dòng liên quan: dòng ${todayRowIdx} và dòng ${tomorrowRowIdx}.`,
          Gia_tri: diffDays,
          Nguong: '1 ngày'
        });
        continue;
      }
      
      // Đọc chỉ số số liệu
      const nt7_t = parseFloat(todayRow[colMap['nt7']]);
      const nt17_t = parseFloat(todayRow[colMap['nt17']]);
      const s600_t = parseFloat(todayRow[colMap['s600']]);
      const s220_t = parseFloat(todayRow[colMap['s220']]);
      const capA_t = parseFloat(todayRow[colMap['capA']]);
      const capB_t = parseFloat(todayRow[colMap['capB']]);
      const llvaoB = parseFloat(todayRow[colMap['llvaoB']]);
      
      const nt7_tom = parseFloat(tomorrowRow[colMap['nt7']]);
      const s600_tom = parseFloat(tomorrowRow[colMap['s600']]);
      const s220_tom = parseFloat(tomorrowRow[colMap['s220']]);
      const capA_tom = parseFloat(tomorrowRow[colMap['capA']]);
      const capB_tom = parseFloat(tomorrowRow[colMap['capB']]);
      
      // Tính lưu lượng 24h
      const llnt = nt7_tom - nt7_t;
      const ll600 = s600_tom - s600_t;
      const ll220 = s220_tom - s220_t;
      const llcapA = capA_tom - capA_t;
      const llcapB = capB_tom - capB_t;
      const llcap = llcapA + llcapB;
      const chenh = llcap - llnt;
      const thatthoatB = llcapB - llvaoB;
      
      // Chống âm
      const checkNegative = (val, name) => {
        if (val !== null && !isNaN(val) && val < 0) {
          generatedAlerts.push({
            Ngay: iso,
            Loai_canh_bao: 'NEGATIVE_FLOW_ERROR',
            Muc_do: 'DATA_ERROR',
            Noi_dung: `Phát hiện lưu lượng âm tại chỉ số ${name} (${val} m³)`,
            Gia_tri: val,
            Nguong: '>= 0'
          });
        }
      };
      checkNegative(llnt, 'Nước thải 24h');
      checkNegative(ll600, 'Hệ 600');
      checkNegative(ll220, 'Hệ 220');
      checkNegative(llcapA, 'Cấp A');
      checkNegative(llcapB, 'Cấp B');
      checkNegative(llcap, 'Tổng cấp');
      
      // Đối chiếu ngưỡng động
      const isWeekend = (thu === 'T7' || thu === 'CN');
      
      const getThreshold = (code, defVal1, defVal2, defOp, defSev) => {
        const matched = thresholds.find(t => t.Ma_nguong === code);
        return matched || { Gia_tri_1: defVal1, Gia_tri_2: defVal2, Toan_tu: defOp, Muc_do: defSev, Ten_nguong: code };
      };
      
      if (!isNaN(llnt)) {
        if (!isWeekend) {
          const t = getThreshold('NT_NGAY_THUONG', 810, null, '>', 'CRITICAL');
          if (llnt > t.Gia_tri_1) {
            generatedAlerts.push({
              Ngay: iso,
              Loai_canh_bao: 'NT_NGAY_THUONG',
              Muc_do: t.Muc_do,
              Noi_dung: `Lưu lượng nước thải ngày thường ${llnt} m³ vượt hạn ${t.Gia_tri_1} m³`,
              Gia_tri: llnt,
              Nguong: t.Gia_tri_1
            });
          }
        } else {
          const t = getThreshold('NT_CUOI_TUAN', 650, null, '>', 'CRITICAL');
          if (llnt > t.Gia_tri_1) {
            generatedAlerts.push({
              Ngay: iso,
              Loai_canh_bao: 'NT_CUOI_TUAN',
              Muc_do: t.Muc_do,
              Noi_dung: `Lưu lượng nước thải cuối tuần ${llnt} m³ vượt hạn ${t.Gia_tri_1} m³`,
              Gia_tri: llnt,
              Nguong: t.Gia_tri_1
            });
          }
        }
      }
      
      if (!isNaN(ll220) && thu !== 'CN') {
        const t = getThreshold('HE220_KHOANG', 200, 220, 'OUT_OF_RANGE', 'WARNING');
        if (ll220 < t.Gia_tri_1 || ll220 > t.Gia_tri_2) {
          generatedAlerts.push({
            Ngay: iso,
            Loai_canh_bao: 'HE220_KHOANG',
            Muc_do: t.Muc_do,
            Noi_dung: `Lưu lượng Hệ 220 là ${ll220} m³ nằm ngoài dải an toàn ${t.Gia_tri_1}–${t.Gia_tri_2} m³`,
            Gia_tri: ll220,
            Nguong: `${t.Gia_tri_1} - ${t.Gia_tri_2}`
          });
        }
      }
      
      if (!isNaN(ll600)) {
        const t = getThreshold('HE600_MAX', 600, null, '>', 'CRITICAL');
        if (ll600 > t.Gia_tri_1) {
          generatedAlerts.push({
            Ngay: iso,
            Loai_canh_bao: 'HE600_MAX',
            Muc_do: t.Muc_do,
            Noi_dung: `Lưu lượng Hệ 600 là ${ll600} m³ vượt hạn tối đa ${t.Gia_tri_1} m³`,
            Gia_tri: ll600,
            Nguong: t.Gia_tri_1
          });
        }
      }
      
      if (!isNaN(chenh)) {
        const t = getThreshold('CHENH_CAP_THAI', 140, null, '>', 'HIGH');
        if (Math.abs(chenh) > t.Gia_tri_1) {
          generatedAlerts.push({
            Ngay: iso,
            Loai_canh_bao: 'CHENH_CAP_THAI',
            Muc_do: t.Muc_do,
            Noi_dung: `Lệch nước cấp - thải đạt ${Math.abs(chenh).toFixed(1)} m³ (Cấp: ${llcap.toFixed(1)} m³, Thải: ${llnt.toFixed(1)} m³) vượt hạn ${t.Gia_tri_1} m³`,
            Gia_tri: Math.abs(chenh).toFixed(1),
            Nguong: t.Gia_tri_1
          });
        }
      }
      
      if (!isNaN(thatthoatB)) {
        const t = getThreshold('THAT_THOAT_B', -5, 5, 'OUT_OF_RANGE', 'HIGH');
        if (thatthoatB < t.Gia_tri_1 || thatthoatB > t.Gia_tri_2) {
          generatedAlerts.push({
            Ngay: iso,
            Loai_canh_bao: 'THAT_THOAT_B',
            Muc_do: t.Muc_do,
            Noi_dung: `Thất thoát nước Khu B là ${thatthoatB.toFixed(1)} m³ ngoài dải cho phép ${t.Gia_tri_1} đến +${t.Gia_tri_2} m³`,
            Gia_tri: thatthoatB.toFixed(1),
            Nguong: `[${t.Gia_tri_1}, ${t.Gia_tri_2}]`
          });
        }
      }
    }
    
    // Lưu các cảnh báo mới phát hiện vào Sheet ALERTS
    generatedAlerts.forEach(alert => {
      const key = `${alert.Ngay}::${alert.Loai_canh_bao}::${alert.Gia_tri}`;
      if (!existingAlertsMap[key]) {
        const alertId = "ALT-" + alert.Ngay.replace(/-/g, '') + "-" + String(Math.floor(1000 + Math.random() * 9000));
        alertsSheet.appendRow([
          alertId,
          alert.Ngay,
          alert.Loai_canh_bao,
          alert.Muc_do,
          alert.Noi_dung,
          alert.Gia_tri,
          alert.Nguong,
          'MOI',
          '', // Nguoi_xu_ly
          nowTime,
          '' // Ghi_chu_xu_ly
        ]);
        
        // Ghi nhận lịch sử ALERT_HISTORIES
        const alHistSheet = spreadsheet.getSheetByName('ALERT_HISTORIES');
        if (alHistSheet) {
          const histId = "HST-ALT-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
          alHistSheet.appendRow([
            histId,
            alertId,
            nowTime,
            'SYSTEM',
            'MOI',
            'Tự động sinh cảnh báo hệ thống.'
          ]);
        }
      }
    });
    
    // Tải lại toàn bộ cảnh báo trả về client
    const freshAlertValues = alertsSheet.getDataRange().getValues();
    const freshColMap = {};
    freshAlertValues[0].forEach((h, idx) => freshColMap[h.toString().trim()] = idx);
    
    const finalAlerts = [];
    for (let k = 1; k < freshAlertValues.length; k++) {
      const row = freshAlertValues[k];
      if (!row[freshColMap['Alert_ID']]) continue;
      
      const ngayFmt = row[freshColMap['Ngay']] instanceof Date
        ? Utilities.formatDate(row[freshColMap['Ngay']], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(row[freshColMap['Ngay']]).split('T')[0];
        
      finalAlerts.push({
        Alert_ID: String(row[freshColMap['Alert_ID']]),
        Ngay: ngayFmt,
        Loai_canh_bao: String(row[freshColMap['Loai_canh_bao']]),
        Muc_do: String(row[freshColMap['Muc_do']]),
        Noi_dung: String(row[freshColMap['Noi_dung']]),
        Gia_tri: row[freshColMap['Gia_tri']],
        Nguong: row[freshColMap['Nguong']],
        Trang_thai: String(row[freshColMap['Trang_thai']]),
        Nguoi_xu_ly: String(row[freshColMap['Nguoi_xu_ly']]),
        Ngay_cap_nhat: row[freshColMap['Ngay_cap_nhat']],
        Ghi_chu_xu_ly: String(row[freshColMap['Ghi_chu_xu_ly']])
      });
    }
    
    // Tải alert histories
    const freshAlHistSheet = spreadsheet.getSheetByName('ALERT_HISTORIES');
    const alHistories = [];
    if (freshAlHistSheet) {
      const alHistValues = freshAlHistSheet.getDataRange().getValues();
      const alHistColMap = {};
      alHistValues[0].forEach((h, idx) => alHistColMap[h.toString().trim()] = idx);
      
      for (let hIdx = 1; hIdx < alHistValues.length; hIdx++) {
        const row = alHistValues[hIdx];
        if (!row[alHistColMap['History_ID']]) continue;
        alHistories.push({
          History_ID: String(row[alHistColMap['History_ID']]),
          Alert_ID: String(row[alHistColMap['Alert_ID']]),
          Thoi_gian: row[alHistColMap['Thoi_gian']],
          Nguoi_thuc_hien: String(row[alHistColMap['Nguoi_thuc_hien']]),
          Trang_thai_moi: String(row[alHistColMap['Trang_thai_moi']]),
          Ghi_chu: String(row[alHistColMap['Ghi_chu']])
        });
      }
    }
    
    // Mới xếp trước
    finalAlerts.sort((a, b) => new Date(b.Ngay_cap_nhat) - new Date(a.Ngay_cap_nhat));
    
    const result = {
      alerts: finalAlerts,
      histories: alHistories,
      currentUserRole: user.Vai_tro,
      currentUserEmail: user.Email
    };
    
    return createApiResponse_(true, result, "Đã cập nhật quét và tải dữ liệu cảnh báo.");
  } catch (error) {
    console.error("Lỗi getAlertsData(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Cập nhật trạng thái xử lý cảnh báo (MOI ➔ DA_XEM ➔ DANG_XU_LY ➔ DA_XU_LY).
 */
function updateAlertStatus(alertId, actionType, note) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('update_alert');
    const spreadsheet = getSpreadsheet_();
    
    const alertsSheet = spreadsheet.getSheetByName('ALERTS');
    if (!alertsSheet) throw new Error("Không tìm thấy bảng ALERTS.");
    
    const values = alertsSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    let targetRowIdx = -1;
    let oldStatus = 'MOI';
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][colMap['Alert_ID']]) === alertId) {
        targetRowIdx = i + 1;
        oldStatus = String(values[i][colMap['Trang_thai']]);
        break;
      }
    }
    
    if (targetRowIdx === -1) throw new Error("Không tìm thấy bản ghi cảnh báo.");
    
    const nowTime = new Date();
    let nextStatus = oldStatus;
    
    if (actionType === 'XEM') {
      nextStatus = 'DA_XEM';
    } else if (actionType === 'XU_LY') {
      nextStatus = 'DANG_XU_LY';
    } else if (actionType === 'HOAN_THANH') {
      nextStatus = 'DA_XU_LY';
    }
    
    alertsSheet.getRange(targetRowIdx, colMap['Trang_thai'] + 1).setValue(nextStatus);
    alertsSheet.getRange(targetRowIdx, colMap['Nguoi_xu_ly'] + 1).setValue(user.Email);
    alertsSheet.getRange(targetRowIdx, colMap['Ngay_cap_nhat'] + 1).setValue(nowTime);
    alertsSheet.getRange(targetRowIdx, colMap['Ghi_chu_xu_ly'] + 1).setValue(note || '');
    
    // Ghi nhận lịch sử ALERT_HISTORIES
    const alHistSheet = spreadsheet.getSheetByName('ALERT_HISTORIES');
    if (alHistSheet) {
      const histId = "HST-ALT-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      alHistSheet.appendRow([
        histId,
        alertId,
        nowTime,
        user.Email,
        nextStatus,
        note || ''
      ]);
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'updateAlertStatus', 'Cảnh báo ' + alertId + ' -> ' + nextStatus, 'THANH_CONG');

    return createApiResponse_(true, { Alert_ID: alertId, Trang_thai: nextStatus }, "Cập nhật trạng thái xử lý cảnh báo thành công.");
  } catch (error) {
    console.error("Lỗi updateAlertStatus(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 6. NHÓM QUẢN TRỊ ADMIN (USERS, CONFIGS)
// ==========================================

/**
 * Thêm mới hoặc chỉnh sửa cấu hình thông tin nhân sự (Vai trò QUAN_LY).
 */
function saveUserAdmin(userId, userDataJSON) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('write_quantri');
    const spreadsheet = getSpreadsheet_();
    const userData = JSON.parse(userDataJSON);
    
    const uSheet = spreadsheet.getSheetByName('USERS');
    if (!uSheet) throw new Error("Không tìm thấy bảng USERS.");
    
    const values = uSheet.getDataRange().getValues();
    const colMap = {};
    values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
    
    const email = userData.Email.toLowerCase().trim();
    
    let targetRowIdx = -1;
    if (userId && userId.trim() !== '') {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colMap['User_ID']]) === userId) {
          targetRowIdx = i + 1;
          break;
        }
      }
      if (targetRowIdx === -1) throw new Error("Không tìm thấy tài khoản nhân sự.");
    } else {
      // Chống trùng lặp email
      for (let k = 1; k < values.length; k++) {
        if (String(values[k][colMap['Email']]).toLowerCase().trim() === email) {
          throw new Error("Tài khoản email này đã tồn tại trong hệ thống.");
        }
      }
    }
    
    const nowTime = new Date();
    
    if (targetRowIdx === -1) {
      const randId = "UMC-USR-" + Utilities.formatDate(nowTime, Session.getScriptTimeZone(), "yyyyMMdd") + "-" + String(Math.floor(1000 + Math.random() * 9000));
      const newRow = [];
      newRow[colMap['User_ID']] = randId;
      newRow[colMap['Email']] = email;
      newRow[colMap['Ho_ten']] = userData.Ho_ten;
      newRow[colMap['So_dien_thoai']] = userData.So_dien_thoai || '';
      newRow[colMap['Don_vi']] = userData.Don_vi || '';
      newRow[colMap['Ghi_chu']] = userData.Ghi_chu || '';
      newRow[colMap['Vai_tro']] = userData.Vai_tro || 'CA_TRUC';
      newRow[colMap['Trang_thai']] = userData.Trang_thai || 'HOAT_DONG';
      newRow[colMap['Ngay_tao']] = nowTime;
      newRow[colMap['Nguoi_tao']] = user.Email;
      newRow[colMap['Ngay_sua']] = nowTime;
      newRow[colMap['Nguoi_sua']] = user.Email;
      
      uSheet.appendRow(newRow);
      userId = randId;
      
      // Tự động share quyền chỉnh sửa (Editor) Spreadsheet cho nhân viên mới
      try {
        spreadsheet.addEditor(email);
        const dataSpreadsheetId = getConfigValue_('WASTEWATER_DATA_SPREADSHEET_ID');
        if (dataSpreadsheetId) {
          SpreadsheetApp.openById(dataSpreadsheetId).addEditor(email);
        }
      } catch (err) {
        console.warn("Lỗi chia sẻ quyền chỉnh sửa file tự động cho email " + email + ": " + err.toString());
      }
    } else {
      uSheet.getRange(targetRowIdx, colMap['Email'] + 1).setValue(email);
      uSheet.getRange(targetRowIdx, colMap['Ho_ten'] + 1).setValue(userData.Ho_ten);
      uSheet.getRange(targetRowIdx, colMap['So_dien_thoai'] + 1).setValue(userData.So_dien_thoai || '');
      uSheet.getRange(targetRowIdx, colMap['Don_vi'] + 1).setValue(userData.Don_vi || '');
      uSheet.getRange(targetRowIdx, colMap['Ghi_chu'] + 1).setValue(userData.Ghi_chu || '');
      uSheet.getRange(targetRowIdx, colMap['Vai_tro'] + 1).setValue(userData.Vai_tro);
      uSheet.getRange(targetRowIdx, colMap['Trang_thai'] + 1).setValue(userData.Trang_thai);
      uSheet.getRange(targetRowIdx, colMap['Ngay_sua'] + 1).setValue(nowTime);
      uSheet.getRange(targetRowIdx, colMap['Nguoi_sua'] + 1).setValue(user.Email);
    }
    
    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'saveUserAdmin', 'Tài khoản ' + userId, 'THANH_CONG');

    return createApiResponse_(true, { User_ID: userId }, "Cập nhật tài khoản nhân sự thành công.");
  } catch (error) {
    console.error("Lỗi saveUserAdmin(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hàm con nội bộ của getAdminSystemData: đọc danh sách nhân sự.
 * Hậu tố _ = private, không gọi được qua google.script.run (API public đã gộp vào getAdminSystemData).
 */
function getUsersListAdmin_() {
  try {
    requirePermission_('write_quantri');
    const spreadsheet = getSpreadsheet_();
    
    const uSheet = spreadsheet.getSheetByName('USERS');
    const users = [];
    if (uSheet) {
      const values = uSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[colMap['User_ID']]) continue;
        users.push({
          User_ID: String(row[colMap['User_ID']]),
          Email: String(row[colMap['Email']]),
          Ho_ten: String(row[colMap['Ho_ten']]),
          So_dien_thoai: String(row[colMap['So_dien_thoai']]),
          Don_vi: String(row[colMap['Don_vi']]),
          Ghi_chu: String(row[colMap['Ghi_chu']]),
          Vai_tro: String(row[colMap['Vai_tro']]),
          Trang_thai: String(row[colMap['Trang_thai']]),
          Ngay_tao: row[colMap['Ngay_tao']],
          Nguoi_tao: String(row[colMap['Nguoi_tao']]),
          Ngay_sua: row[colMap['Ngay_sua']],
          Nguoi_sua: String(row[colMap['Nguoi_sua']])
        });
      }
    }
    
    return createApiResponse_(true, users, "Tải danh sách người dùng quản trị thành công.");
  } catch (error) {
    console.error("Lỗi getUsersListAdmin_(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Gộp dữ liệu module Quản trị theo hợp đồng API Shell (getAdminSystemData).
 * Trả { users:[], configs:{KEY:{value}}, logs:[], versions:[] }.
 * Tái dùng getUsersListAdmin_ + getConfigsListAdmin_ (private) làm hàm con để đỡ lặp logic đọc.
 */
function getAdminSystemData() {
  try {
    requirePermission_('write_quantri');
    const spreadsheet = getSpreadsheet_();

    // users — tái dùng getUsersListAdmin_ (đọc tab USERS)
    const usersResp = JSON.parse(getUsersListAdmin_());
    const users = usersResp.success ? usersResp.data : [];

    // configs — getConfigsListAdmin_ trả phẳng {KEY: val}; bọc thành {KEY: {value}} vì Shell đọc configs['SYS_NAME'].value
    const cfgResp = JSON.parse(getConfigsListAdmin_());
    const flatConfigs = cfgResp.success ? cfgResp.data : {};
    const configs = {};
    Object.keys(flatConfigs).forEach(key => {
      configs[key] = { key: key, value: flatConfigs[key] };
    });

    // logs — ánh xạ ACCESS_LOGS sang cấu trúc Shell đọc {Timestamp, Log_Type, User_Email, Action, Details}
    const logs = [];
    const alSheet = spreadsheet.getSheetByName('ACCESS_LOGS');
    if (alSheet) {
      const values = alSheet.getDataRange().getValues();
      const colMap = {};
      values[0].forEach((h, idx) => colMap[h.toString().trim()] = idx);
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[colMap['Thoi_gian']]) continue;
        const ketQua = String(row[colMap['Ket_qua']]).toUpperCase();
        const hanhDong = String(row[colMap['Hanh_dong']]);
        const hanhDongLower = hanhDong.toLowerCase();
        // Ưu tiên nhận diện hành động đăng nhập (ACCESS_LOGS ghi Hanh_dong='LOGIN') → icon 🔑
        let logType;
        if (hanhDong.toUpperCase() === 'LOGIN' || hanhDongLower.indexOf('login') !== -1 || hanhDongLower.indexOf('đăng nhập') !== -1 || hanhDongLower.indexOf('getcurrentuser') !== -1) {
          logType = 'LOGIN';
        } else if (ketQua === 'THAT_BAI' || ketQua === 'DENIED') {
          logType = 'ERROR';
        } else {
          logType = 'ACTIVITY';
        }
        logs.push({
          Timestamp: row[colMap['Thoi_gian']],
          Log_Type: logType,
          User_Email: String(row[colMap['Email']]),
          Action: hanhDong,
          Details: String(row[colMap['Chi_tiet']])
        });
      }
      logs.reverse(); // mới nhất lên đầu
    }

    // versions — chưa có tab VERSIONS trong database; trả rỗng (Shell tự hiển thị "Chưa có phiên bản")
    const versions = [];

    return createApiResponse_(true, { users: users, configs: configs, logs: logs, versions: versions }, "Tải dữ liệu quản trị hệ thống thành công.");
  } catch (error) {
    console.error("Lỗi getAdminSystemData(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}

/**
 * Cập nhật một tham số cấu hình hệ thống theo cặp key/value rời (updateSystemConfig).
 * Ghi 1 dòng CONFIGS: cập nhật nếu key đã có, thêm mới nếu chưa.
 */
function updateSystemConfig(key, value) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = requirePermission_('write_quantri');
    const spreadsheet = getSpreadsheet_();

    const cfgSheet = spreadsheet.getSheetByName('CONFIGS');
    if (!cfgSheet) throw new Error("Không tìm thấy bảng CONFIGS.");

    const cfgKey = String(key).trim();
    const cfgVal = String(value).trim();
    if (!cfgKey) throw new Error("Thiếu khóa cấu hình.");

    const values = cfgSheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === cfgKey) { foundRow = i + 1; break; }
    }
    if (foundRow !== -1) {
      cfgSheet.getRange(foundRow, 2).setValue(cfgVal);
    } else {
      cfgSheet.appendRow([cfgKey, cfgVal]);
    }

    writeAccessLog_(spreadsheet, user.Email, user.Vai_tro, 'updateSystemConfig', cfgKey + ' = ' + cfgVal, 'THANH_CONG');
    return createApiResponse_(true, { key: cfgKey, value: cfgVal }, "Cập nhật cấu hình thành công.");
  } catch (error) {
    console.error("Lỗi updateSystemConfig(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hàm con nội bộ của getAdminSystemData: đọc tham số cấu hình.
 * Hậu tố _ = private, không gọi được qua google.script.run (API public đã gộp vào getAdminSystemData).
 */
function getConfigsListAdmin_() {
  try {
    requirePermission_('write_quantri');
    const spreadsheet = getSpreadsheet_();
    
    const cfgSheet = spreadsheet.getSheetByName('CONFIGS');
    const configs = {};
    if (cfgSheet) {
      const values = cfgSheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        const key = String(values[i][0]).trim();
        const val = String(values[i][1]).trim();
        if (key) {
          configs[key] = val;
        }
      }
    }
    
    return createApiResponse_(true, configs, "Tải cấu hình quản trị thành công.");
  } catch (error) {
    console.error("Lỗi getConfigsListAdmin_(): " + error.toString());
    return createApiResponse_(false, null, error.message || error.toString());
  }
}


// ==========================================
// 7. HÀM KHỞI TẠO BOOTSTRAP HỆ THỐNG
// ==========================================

/**
 * Hàm khởi tạo cơ sở dữ liệu Google Sheets 15 tab chuẩn chỉ và nạp dữ liệu mẫu ban đầu.
 * Chạy thủ công một lần bởi Admin từ trình chỉnh sửa mã nguồn Apps Script.
 */
function setupDatabase() {
  const spreadsheet = getSpreadsheet_();
  console.log("=== Bắt đầu khởi tạo cơ sở dữ liệu 15 tab cho Trạm XLNT UMC ===");
  
  const boldStyle = { fontWeight: 'bold', background: '#1e293b', fontColor: '#ffffff' };
  
  const createTab = (name, headers) => {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
           .setFontWeight('bold')
           .setBackground('#1e293b')
           .setFontColor('#ffffff');
      console.log(`Đã tạo tab: ${name}`);
    } else {
      console.log(`Tab đã tồn tại: ${name}`);
    }
    return sheet;
  };
  
  // 1. Tab USERS
  const uSheet = createTab('USERS', ['User_ID', 'Email', 'Ho_ten', 'So_dien_thoai', 'Don_vi', 'Ghi_chu', 'Vai_tro', 'Trang_thai', 'Ngay_tao', 'Nguoi_tao', 'Ngay_sua', 'Nguoi_sua']);
  if (uSheet.getLastRow() <= 1) {
    uSheet.appendRow([
      'UMC-USR-20260715-0001',
      'masongnguyen@gmail.com',
      'Mà Song Nguyễn',
      '0900000000',
      'Ban Giám Đốc',
      'Tài khoản quản lý tối cao khởi tạo hệ thống',
      'QUAN_LY',
      'HOAT_DONG',
      new Date(),
      'SYSTEM',
      new Date(),
      'SYSTEM'
    ]);
  }
  
  // 2. Tab CONFIGS
  const cSheet = createTab('CONFIGS', ['Key', 'Value']);
  if (cSheet.getLastRow() <= 1) {
    cSheet.appendRow(['SYS_NAME', 'Hệ thống Vận hành Trạm XLNT UMC']);
    cSheet.appendRow(['DASHBOARD_URL', 'https://script.google.com/macros/s/AKfycbxlSxa-M7LMZCvjdHwHUTnFRwFmKfxGrj3F9kwCL5dRviv-865ht4ivaGNM_MiaiYzG7g/exec']);
    cSheet.appendRow(['MAINTENANCE_MODE', 'false']);
    cSheet.appendRow(['WASTEWATER_DATA_SPREADSHEET_ID', '[Dán ID Spreadsheet Dữ liệu Lưu lượng vào đây]']);
    cSheet.appendRow(['UPLOAD_FOLDER_ID', '[Dán ID Thư mục Drive lưu ảnh vào đây]']);
    cSheet.appendRow(['CONTRACTOR_NAME', 'Công ty Đại Nam']);
  }
  
  // 3. Tab THRESHOLDS
  const thSheet = createTab('THRESHOLDS', ['Threshold_ID', 'Ma_nguong', 'Ten_nguong', 'Nhom', 'He_thong', 'Toan_tu', 'Gia_tri_1', 'Gia_tri_2', 'Ap_dung_ngay', 'Muc_do', 'Kich_hoat', 'Ghi_chu', 'Nguoi_sua', 'Ngay_sua']);
  if (thSheet.getLastRow() <= 1) {
    const now = new Date();
    const seeds = [
      // 6 lưu lượng
      ['TH-LU-01', 'NT_NGAY_THUONG', 'Lưu lượng xả thải ngày thường', 'LUU_LUONG', 'Nuoc_thai', '>', 810, '', now, 'CRITICAL', 'TRUE', 'Ngưỡng ngày thường T2-T6', 'SYSTEM', now],
      ['TH-LU-02', 'NT_CUOI_TUAN', 'Lưu lượng xả thải cuối tuần', 'LUU_LUONG', 'Nuoc_thai', '>', 650, '', now, 'CRITICAL', 'TRUE', 'Ngưỡng cuối tuần T7-CN', 'SYSTEM', now],
      ['TH-LU-03', 'HE220_KHOANG', 'Lưu lượng vận hành hệ 220', 'LUU_LUONG', 'He_220', 'OUT_OF_RANGE', 200, 220, now, 'WARNING', 'TRUE', 'Khoảng lưu lượng an toàn hệ 220', 'SYSTEM', now],
      ['TH-LU-04', 'HE600_MAX', 'Giới hạn lưu lượng hệ 600', 'LUU_LUONG', 'He_600', '>', 600, '', now, 'CRITICAL', 'TRUE', 'Giới hạn lưu lượng hệ 600', 'SYSTEM', now],
      ['TH-LU-05', 'CHENH_CAP_THAI', 'Chênh lệch nước cấp và thải', 'LUU_LUONG', 'Nuoc_thai', '>', 140, '', now, 'HIGH', 'TRUE', 'Độ chênh lệch tối đa Cấp - Thải', 'SYSTEM', now],
      ['TH-LU-06', 'THAT_THOAT_B', 'Thất thoát nước khu B', 'LUU_LUONG', 'Nuoc_cap', 'OUT_OF_RANGE', -5, 5, now, 'HIGH', 'TRUE', 'Độ thất thoát Khu B cho phép', 'SYSTEM', now],
      // 10 chất lượng — DẢI VẬN HÀNH NỘI BỘ theo DuLieu-HeThong_v6 mục 4.c (nguồn: Báo cáo T04/2026 mục 6).
      // ĐÂY KHÔNG PHẢI SỐ QCVN. Dải này chặt hơn nhiều so với giới hạn pháp lý ở nhóm PHAP_LY — không lẫn 2 nhóm.
      // Toan_tu dùng OUT_OF_RANGE (giá trị enum thật trong Database-Schema; tài liệu gọi là "NGOAI_KHOANG").
      // Gia_tri_1 = cận dưới, Gia_tri_2 = cận trên. Cảnh báo VÀNG khi ngoài dải, không chặn nhập.
      ['TH-CL-01', 'SV30_HE600', 'SV30 hệ 600', 'CHAT_LUONG', 'He_600', 'OUT_OF_RANGE', 300, 400, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 300-400 ml/L (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-02', 'SV30_HE220', 'SV30 hệ 220', 'CHAT_LUONG', 'He_220', 'OUT_OF_RANGE', 250, 350, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 250-350 ml/L. Cận dưới 250 đồng thời phủ quy tắc E-HSMT "SV30 < 250 báo bùn hoạt tính thấp"', 'SYSTEM', now],
      ['TH-CL-03', 'PH_IN_HE600', 'pH đầu vào hệ 600', 'CHAT_LUONG', 'He_600', 'OUT_OF_RANGE', 7.0, 7.5, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 7,0-7,5 (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-04', 'PH_IN_HE220', 'pH đầu vào hệ 220', 'CHAT_LUONG', 'He_220', 'OUT_OF_RANGE', 7.0, 7.5, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 7,0-7,5 (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-05', 'PH_OUT_HE600', 'pH đầu ra hệ 600', 'CHAT_LUONG', 'He_600', 'OUT_OF_RANGE', 7.2, 7.6, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 7,2-7,6 (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-06', 'PH_OUT_HE220', 'pH đầu ra hệ 220', 'CHAT_LUONG', 'He_220', 'OUT_OF_RANGE', 7.0, 7.4, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 7,0-7,4 (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-07', 'AMONI_HE600', 'Amoni hệ 600', 'CHAT_LUONG', 'He_600', 'OUT_OF_RANGE', 5.0, 8.0, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 5,0-8,0 mg/l (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-08', 'AMONI_HE220', 'Amoni hệ 220', 'CHAT_LUONG', 'He_220', 'OUT_OF_RANGE', 3.0, 6.0, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 3,0-6,0 mg/l (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-09', 'COD_HE600', 'COD hệ 600', 'CHAT_LUONG', 'He_600', 'OUT_OF_RANGE', 30, 40, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 30-40 (Báo cáo T04/2026)', 'SYSTEM', now],
      ['TH-CL-10', 'COD_HE220', 'COD hệ 220', 'CHAT_LUONG', 'He_220', 'OUT_OF_RANGE', 10, 20, now, 'NHAC_NHO', 'TRUE', 'Dải vận hành bình thường 10-20 (Báo cáo T04/2026)', 'SYSTEM', now],
      // 10 pháp lý (QCVN 28:2010 cột B, K=1) — DuLieu-HeThong v5 mục 6, Muc_do=LOI
      ['TH-PL-01', 'QCVN_PH', 'pH nước thải sau xử lý', 'PHAP_LY', 'Nuoc_thai', 'OUT_OF_RANGE', 6.5, 8.5, now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B, K=1', 'SYSTEM', now],
      ['TH-PL-02', 'QCVN_BOD5', 'BOD5', 'PHAP_LY', 'Nuoc_thai', '>', 50, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 50 mg/l', 'SYSTEM', now],
      ['TH-PL-03', 'QCVN_COD', 'COD', 'PHAP_LY', 'Nuoc_thai', '>', 100, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 100 mg/l', 'SYSTEM', now],
      ['TH-PL-04', 'QCVN_TSS', 'Tổng chất rắn lơ lửng (TSS)', 'PHAP_LY', 'Nuoc_thai', '>', 100, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 100 mg/l', 'SYSTEM', now],
      ['TH-PL-05', 'QCVN_AMONI', 'Amoni (tính theo N)', 'PHAP_LY', 'Nuoc_thai', '>', 10, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 10 mg/l', 'SYSTEM', now],
      ['TH-PL-06', 'QCVN_PHOTPHAT', 'Photphat (tính theo P)', 'PHAP_LY', 'Nuoc_thai', '>', 10, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 10 mg/l', 'SYSTEM', now],
      ['TH-PL-07', 'QCVN_NITRAT', 'Nitrat (tính theo N)', 'PHAP_LY', 'Nuoc_thai', '>', 50, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 50 mg/l', 'SYSTEM', now],
      ['TH-PL-08', 'QCVN_DAUMO', 'Dầu mỡ động thực vật', 'PHAP_LY', 'Nuoc_thai', '>', 20, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 20 mg/l', 'SYSTEM', now],
      ['TH-PL-09', 'QCVN_SUNFUA', 'Sunfua (tính theo H2S)', 'PHAP_LY', 'Nuoc_thai', '>', 4, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 4 mg/l', 'SYSTEM', now],
      ['TH-PL-10', 'QCVN_COLIFORM', 'Tổng Coliform', 'PHAP_LY', 'Nuoc_thai', '>', 5000, '', now, 'LOI', 'TRUE', 'QCVN 28:2010 cột B: <= 5.000 MPN/100ml', 'SYSTEM', now]
    ];
    seeds.forEach(row => thSheet.appendRow(row));
  }
  
  // 4. Tab OP_LOGS (4 cột cuối bổ sung theo YeuCau v4 mục 7.1 + 7.2: checklist ca trực + xác nhận Bệnh viện)
  createTab('OP_LOGS', ['Log_ID', 'Ngay', 'Ca', 'Nhiet_do', 'pH_dau_vao', 'pH_dau_ra', 'DO', 'SV30', 'Luu_luong_nt', 'Amoni', 'COD', 'Tinh_trang_he_thong', 'Su_co_phat_sinh', 'Bien_phap_khac_phuc', 'Hinh_anh_links', 'Trang_thai', 'Nguoi_tao', 'Ngay_tao', 'Nguoi_sua', 'Ngay_sua', 'Checklist_Ket_qua', 'Nguoi_xacnhan_BV', 'Chucvu_xacnhan_BV', 'Da_xacnhan_BV']);

  // 4.b Tab LOG_CHECKLIST_ITEMS — danh mục công việc hàng ngày theo ca.
  // Seed 19 mục NGUYÊN VĂN từ DuLieu-HeThong_v5 mục 4.b (nguồn gốc: Báo cáo vận hành T04/2026 mục 3.1).
  const ckSheet = createTab('LOG_CHECKLIST_ITEMS', ['Item_ID', 'Noi_dung', 'Thu_tu', 'Kich_hoat']);
  if (ckSheet.getLastRow() <= 1) {
    const ckItems = [
      'Đo pH nước đầu vào và các bể bằng máy đo pH.',
      'Căn chỉnh lưu lượng khí cung cấp cho bể sục khí phù hợp để điều chỉnh nồng độ Oxy hòa tan.',
      'Vệ sinh các Hố thu gom, giỏ, lưới chắn rác khu A, Khu B, bể xử lý.',
      'Ghi chỉ số đồng hồ lưu lượng nước thải đầu vào, đầu ra để tính lưu lượng nước thải phát sinh trong giờ cao điểm.',
      'Xử lý bùn nổi ở Bể lắng.',
      'Vệ sinh thiết bị đo lưu lượng.',
      'Kiểm tra bùn vi sinh trong các bể xử lý, chỉ số bùn.',
      'Kiểm tra đèn tín hiệu, phao, timer, đèn sự cố.',
      'Kiểm tra sự tắc nghẽn, van, và đầu hút của bơm.',
      'Kiểm tra và khắc phục mùi hôi phát sinh (nếu có) từ hệ thống xử lý nước thải.',
      'Kiểm tra chế độ vận hành.',
      'Kiểm tra bồn lọc, rửa lọc.',
      'Kiểm tra, vệ sinh Hố thu gom tại khu B.',
      'Kiểm tra, vệ sinh lưới chắn rác tại hệ thống XLNT 220m³/ngày.',
      'Kiểm tra, vệ sinh lưới chắn rác tại hệ thống XLNT 600m³/ngày.',
      'Kiểm tra, vệ sinh lưới chắn giá thể tại các bể sinh học.',
      'Vệ sinh bùn nổi Bể lắng và cân chỉnh thu bùn bề mặt Bể lắng.',
      'Kiểm tra và pha hóa chất hàng ngày.',
      'Kiểm tra vệ sinh tấm lắng lamen.'
    ];
    ckItems.forEach((noiDung, idx) => {
      const stt = idx + 1;
      ckSheet.appendRow(['CKL-' + (stt < 10 ? '0' + stt : stt), noiDung, stt, 'TRUE']);
    });
  }

  // 5. Tab LOG_HISTORIES
  createTab('LOG_HISTORIES', ['History_ID', 'Log_ID', 'Thoi_gian', 'Nguoi_thuc_hien', 'Hanh_dong', 'Ghi_chu']);
  
  // 6. Tab CHEMICALS — 5 hóa chất THẬT theo DuLieu-HeThong_v6 mục 5 (KHÔNG dùng PAC/Chlorine của mock demo cũ).
  // Phương án A (đã chốt): 2 VAI TRÒ ĐỊNH MỨC tách thành CỘT RIÊNG, không gộp, không tách tab:
  //   - Dinh_muc_thang_van_hanh   = định mức vận hành ngày thường, TỔNG 2 hệ (mục 5.1, GPMT Bảng 7)
  //   - Dinh_muc_he600 / Dinh_muc_he220 = tách theo từng hệ đúng nguồn 5.1 (giữ nguyên dữ liệu gốc,
  //     dù Shell master hóa chất hiện chưa hiển thị 2 cột này)
  //   - Khoi_luong_hopdong_18thang = khối lượng hợp đồng 2026-2027 để đối chiếu khi nhà thầu giao (mục 5.2, E-HSMT)
  // Nguong_canh_bao_ton để TRỐNG: v6 không có ngưỡng tồn -> admin tự đặt, không tự chế số.
  const chemSheet = createTab('CHEMICALS', ['Ma_hoa_chat', 'Ten_hoa_chat', 'Don_vi_tinh', 'Nguong_canh_bao_ton', 'Dinh_muc_thang_van_hanh', 'Dinh_muc_he600', 'Dinh_muc_he220', 'Khoi_luong_hopdong_18thang', 'Ghi_chu']);
  if (chemSheet.getLastRow() <= 1) {
    chemSheet.appendRow(['NAOH', 'NaOH ≥98%', 'kg', '', 567, 416, 151, 11250, 'Cân bằng pH. Hợp đồng 5.2 quy đổi ≈ 625 kg/tháng (cao hơn định mức vận hành 567).']);
    chemSheet.appendRow(['JAVEN', 'Javen 10%', 'kg', '', 1047, 914, 133, 22447, 'Khử trùng. Hợp đồng 5.2 quy đổi ≈ 1.247 kg/tháng (cao hơn định mức vận hành 1.047).']);
    chemSheet.appendRow(['NAHCO3', 'NaHCO3', 'kg', '', 180, 132, 48, 3240, 'Ổn định pH. Hợp đồng 5.2 quy đổi = 180 kg/tháng (khớp định mức vận hành).']);
    chemSheet.appendRow(['MATRI', 'Mật rỉ đường', 'kg', '', 750, 550, 200, 13500, 'Tăng carbon cho vi sinh. Hợp đồng 5.2 quy đổi = 750 kg/tháng (khớp định mức vận hành).']);
    chemSheet.appendRow(['VISINH', 'Vi sinh xử lý nước thải', 'gallon', '', '', '', '', 108, 'Hạng mục hợp đồng mới, KHÔNG có trong định mức vận hành 5.1 -> 3 cột định mức để trống. Hợp đồng 5.2: 108 gallon (~409L)/18 tháng = 6 gallon/tháng. Thành phần: Bacillus spp, Clostridium spp, Desulfovibrio spp, Pseudomonas spp, Rhodopseudomonas spp.']);
  }

  // 7. Tab CHEM_STOCKS — KHÔNG seed: v5 không có số liệu tồn kho thực tế (trước đây là số bịa).
  createTab('CHEM_STOCKS', ['Ma_hoa_chat', 'Ton_kho', 'Ngay_cap_nhat']);

  // 8. Tab CHEM_TRANSACTIONS — KHÔNG seed giao dịch mẫu (không có nguồn; tồn kho phát sinh từ giao dịch thật).
  createTab('CHEM_TRANSACTIONS', ['Tx_ID', 'Ma_hoa_chat', 'Loai_giao_dich', 'So_luong', 'Lo_san_xuat', 'Han_su_dung', 'Ngay_thuc_hien', 'Ghi_chu', 'Nguoi_tao', 'Ngay_tao']);
  
  // 9. Tab EQUIPMENTS — seed 34 hạng mục theo DuLieu-HeThong_v7 mục 3: 16 hệ 600 + 18 hệ 220 (17 GPMT Bảng 5 + TB-220-18 xác nhận thực địa).
  // Thông số kỹ thuật + số lượng theo v5 (GPMT). Hang_SX/Model merge từ DuLieu-HeThong_v2 mục 3
  // (lý lịch thiết bị) — CHỈ merge dòng ánh xạ rõ ràng (tên hạng mục + thông số khớp); dòng có
  // ứng viên lý lịch nhưng mâu thuẫn chủng loại/thông số -> để trống + Ghi_chu "chưa xác minh model";
  // thiết bị phụ không có trong lý lịch (đĩa khí, tấm lắng, bồn, phao, đồng hồ...) -> để trống.
  // Vi_tri, Ngay_lap_dat, Chu_ky_bao_tri_ngay, Ngay_bao_tri_gan_nhat: không có nguồn -> để TRỐNG — admin bổ sung sau.
  // Tinh_trang seed = HOAT_DONG theo quy tắc seed đã chốt.
  const eqpSheet = createTab('EQUIPMENTS', ['Equipment_ID', 'Ten_thiet_bi', 'He_thong', 'Vi_tri', 'Hang_SX', 'Model', 'So_luong', 'Thong_so', 'Tinh_trang', 'Ngay_lap_dat', 'Chu_ky_bao_tri_ngay', 'Ngay_bao_tri_gan_nhat', 'Ghi_chu']);
  if (eqpSheet.getLastRow() <= 1) {
    // [Equipment_ID, Ten_thiet_bi, He_thong, Hang_SX, Model, So_luong, Thong_so, Ghi_chu]
    const eqpSrc = [
      // Hệ 600 — 16 hạng mục (GPMT Bảng 5.I)
      ['TB-600-01', 'Bơm thu gom và điều hòa', 'He_600', 'EBARA', 'DW VOX-300', 3, 'Bơm chìm, Q=100–180 l/phút, cột áp 15,7–3,6 mH2O, P=2,2kW, inox', 'Lý lịch v2: Q=100–800 l/phút (GPMT ghi 100–180)'],
      ['TB-600-02', 'Bơm bùn bể lắng & bể nén bùn', 'He_600', 'EBARA', 'DW VOX-300', 5, 'Bơm chìm, Q=100–180 l/phút, cột áp 15,7–3,6 mH2O, P=2,2kW, inox', 'Lý lịch v2: Q=100–800 l/phút (GPMT ghi 100–180)'],
      ['TB-600-03', 'Bơm lọc', 'He_600', '', '', 3, 'Bơm chìm, Q=100–180 l/phút, cột áp 15,7–3,6 mH2O, P=2,2kW, inox', 'Chưa xác minh model: lý lịch v2 ghi EBARA 3M/E 40-125/2.2 bơm TRỤC NGANG Q=12–42 m³/h, GPMT ghi bơm CHÌM Q=100–180 l/phút — chủng loại mâu thuẫn'],
      ['TB-600-04', 'Máy thổi khí bể điều hòa', 'He_600', 'ANLET', 'BH-65', 2, 'Root, Q=1,28 m³/phút, cột áp 5100mmAq, P=5,5kW, 1700rpm', 'v5: P=5,5kW theo GPMT + lý lịch (báo cáo T04 ghi 4kW)'],
      ['TB-600-05', 'Máy thổi khí bể hiếu khí có giá thể', 'He_600', 'ANLET', 'BS-80', 3, 'Root, Q=4,06 m³/phút, cột áp 5100mmAq, P=5,5kW, 1300rpm', ''],
      ['TB-600-06', 'Bơm định lượng Chlorine', 'He_600', '', '', 2, 'Bơm màng, Q=30 l/h, cột áp 30 PSI, P=45W', 'Đã xác nhận 16/07/2026: 45W đúng (GPMT ghi 45KW là lỗi đánh máy). Chưa xác minh model: lý lịch v2 chỉ có ORIENTALMOTOR 5IK40GN-ST P=40W (mô tơ, lệch công suất và chủng loại với bơm màng 45W)'],
      ['TB-600-07', 'Máy khuấy hóa chất', 'He_600', 'DOLIN', 'SH 12-12', 1, 'Chân đế, tốc độ 1/15–1/90, P=0,4kW', ''],
      ['TB-600-08', 'Máy khuấy chìm', 'He_600', 'FAGGIOLATI', 'GM-18', 2, 'Root, P=1,3kW, 1370 v/phút', ''],
      ['TB-600-09', 'Đĩa tán khí bể điều hòa', 'He_600', '', '', 16, 'Mịn, Q=5-26 m³/giờ, Ø127mm', ''],
      ['TB-600-10', 'Đĩa phân phối khí', 'He_600', '', '', 67, 'Mịn, Q=0-8 m³/giờ, Ø277mm', ''],
      ['TB-600-11', 'Thiết bị khống chế lưu lượng', 'He_600', '', '', 1, 'Thùng inox, Q=20-30 m³/giờ', ''],
      ['TB-600-12', 'Tấm trợ lắng', 'He_600', '', '', 28, 'Vách nghiêng, 62 m²/m³', 'v5 ghi SL = "28 m³" (đơn vị thể tích, không phải số cái)'],
      ['TB-600-13', 'Ống lắng trung tâm', 'He_600', '', '', 1, 'Q=15-25 m³/h', ''],
      ['TB-600-14', 'Lược rác (song chắn rác)', 'He_600', '', '', 1, 'Q=15-30 m³/h, inox', ''],
      ['TB-600-15', 'Bồn hóa chất', 'He_600', '', '', 2, 'PE 4 lớp, 500L', ''],
      ['TB-600-16', 'Bồn lọc áp lực', 'He_600', '', '', 4, 'Q=20-30m³/h, cát 0,4-1,2mm cao 80cm + sỏi 2-4mm cao 30cm', 'v5 ghi SL = "4 bộ"'],
      // Hệ 220 — 18 hạng mục (17 theo GPMT Bảng 5.II + TB-220-18 bổ sung thực địa, DuLieu v7 mục 3)
      ['TB-220-01', 'Bơm nước thải (nhóm 1)', 'He_220', 'ZENIT', 'DGO200/2/G50V', 3, 'P=1,5kW, cột áp 6,9, Q=25m³/h', 'Lý lịch v2 ghi vị trí "bể điều hòa hệ 600" (giữ nguyên theo hồ sơ — xem DuLieu v2 mục 3)'],
      ['TB-220-02', 'Bơm nước thải (nhóm 2)', 'He_220', 'ZENIT', 'DGO75/2/G50V', 7, 'P=0,55kW, cột áp 6, Q=9,2m³/h', 'GPMT gộp 7 bơm = 3 nhóm lý lịch v2 cùng model (3 điều hòa + 2 hiếu khí + 2 lắng)'],
      ['TB-220-03', 'Bơm lọc', 'He_220', 'EBARA', '3D32-160/2.2', 3, 'P=2,2kW, cột áp 30, Q=12m³/h', 'v5: Q=12m³/h theo GPMT + lý lịch (báo cáo T04 ghi 12–42)'],
      ['TB-220-04', 'Máy khuấy chìm', 'He_220', 'FAGGIOLATI', 'GM17A471T1-4V2KA0', 2, 'P=0,7kW, 380V 3 pha, Ø cánh 176mm', ''],
      ['TB-220-05', 'Máy thổi khí (nhóm 1)', 'He_220', 'TOHIN', 'HC-501S', 2, 'P=2,2kW, cột áp 4, Q=1,36 m³/phút', ''],
      ['TB-220-06', 'Máy thổi khí (nhóm 2)', 'He_220', 'TOHIN', 'HC-100S', 2, 'P=5,5kW, cột áp 4, Q=4,18 m³/phút', ''],
      ['TB-220-07', 'Đĩa thổi khí', 'He_220', '', '', 21, 'Mịn, Q=0-16 m³/giờ', ''],
      ['TB-220-08', 'Thiết bị đo oxy hòa tan', 'He_220', '', '', 1, 'Thang đo 0-20mg/l, độ phân giải 0,01', ''],
      ['TB-220-09', 'Thiết bị đo pH', 'He_220', '', '', 1, 'Thang đo 0-14, độ phân giải 0,01', ''],
      ['TB-220-10', 'Phao đo mức (sóng siêu âm)', 'He_220', '', '', 1, '', 'v5 không ghi thông số'],
      ['TB-220-11', 'Phao đo mức nước', 'He_220', '', '', 6, 'Chịu áp 1 bar', ''],
      ['TB-220-12', 'Mô tơ khuấy hóa chất', 'He_220', 'NORD', 'SK01F-71L4', 2, 'P=0,37kW, 100-150 rpm', 'Lý lịch v2: 120 rpm (GPMT ghi 100-150 rpm)'],
      ['TB-220-13', 'Thiết bị gạt bùn', 'He_220', '', '', 1, 'P=0,37kW, 0,1 rpm', ''],
      ['TB-220-14', 'Bơm định lượng', 'He_220', 'MILTON ROY', 'GM0025 PRIMNN', 6, 'Q=25 l/h, đẩy 12 bar/hút 2 bar', ''],
      ['TB-220-15', 'Đồng hồ đo lưu lượng', 'He_220', '', '', 1, 'PN16, DN50', ''],
      ['TB-220-16', 'Quạt hút mùi', 'He_220', '', '', 1, 'Q=3500 m³/giờ, áp tĩnh 3000Pa, 10HP', 'Chưa xác minh model: lý lịch v2 ghi ĐẠI PHONG QLT-2P05 Q=5.740 m³/h P=3,75kW — lệch lớn với GPMT (Q=3500 m³/giờ, 10HP)'],
      ['TB-220-17', 'Bồn lọc áp lực', 'He_220', '', '', 2, 'Q=9,2m³/h, cát+sỏi như hệ 600', 'v5 ghi SL = "2 bộ"'],
      ['TB-220-18', 'Bơm hố thu gom hệ 220', 'He_220', 'EBARA', 'DW VOX-300', 3, 'Bơm chìm, P=2,2kW', 'Bổ sung theo xác nhận thực địa 16/07/2026 (DuLieu v7 mục 3 — không có trong GPMT Bảng 5/báo cáo T04). Lý lịch v2: Q=100–800 l/phút']
    ];
    eqpSrc.forEach(r => {
      // Vi_tri, Ngay_lap_dat, Chu_ky_bao_tri_ngay, Ngay_bao_tri_gan_nhat: không có nguồn -> để trống
      eqpSheet.appendRow([r[0], r[1], r[2], '', r[3], r[4], r[5], r[6], 'HOAT_DONG', '', '', '', r[7]]);
    });
  }
  
  // 10. Tab EQP_MAINTENANCES — 2 dòng bảo trì thật theo DuLieu-HeThong_v2 mục 4 (v5 mục 3 ghi rõ giữ nguyên v2).
  // Nguồn: "thay phốt + bạc đạn máy thổi khí AB-03 và AB-05 hệ 600 (T04/2026), đã lắp lại hoạt động ổn định".
  // Ngay_bao_tri để TRỐNG: nguồn chỉ ghi tháng 04/2026, không có ngày cụ thể -> không tự chế ngày.
  const maintSheet = createTab('EQP_MAINTENANCES', ['Maint_ID', 'Equipment_ID', 'Ngay_bao_tri', 'Ket_qua', 'Noi_dung_bao_tri', 'Vat_tu_thay_the', 'Tai_lieu_links', 'Ghi_chu', 'Nguoi_tao', 'Ngay_tao']);
  if (maintSheet.getLastRow() <= 1) {
    const now = new Date();
    maintSheet.appendRow([
      'MNT-EQP-202604-0001',
      'TB-600-05',
      '',
      'DAT_YEU_CAU',
      'Thay phốt và bạc đạn máy thổi khí AB-03 hệ 600 (T04/2026). Đã lắp lại, hoạt động ổn định.',
      'Phốt, bạc đạn',
      '',
      'T04/2026. Nguồn: DuLieu-HeThong_v2 mục 4 — chỉ ghi tháng, không có ngày -> Ngay_bao_tri để trống. Mã đơn vị AB-03 theo báo cáo, chưa ánh xạ 1-1 với hạng mục gộp TB-600-05.',
      'SYSTEM',
      now
    ]);
    maintSheet.appendRow([
      'MNT-EQP-202604-0002',
      'TB-600-05',
      '',
      'DAT_YEU_CAU',
      'Thay phốt và bạc đạn máy thổi khí AB-05 hệ 600 (T04/2026). Đã lắp lại, hoạt động ổn định.',
      'Phốt, bạc đạn',
      '',
      'T04/2026. Nguồn: DuLieu-HeThong_v2 mục 4 — chỉ ghi tháng, không có ngày -> Ngay_bao_tri để trống. Mã đơn vị AB-05 theo báo cáo, chưa ánh xạ 1-1 với hạng mục gộp TB-600-05.',
      'SYSTEM',
      now
    ]);
  }
  
  // 11. Tab EQP_INCIDENTS — 8 sự cố THẬT theo DuLieu-HeThong_v2 mục 4 (v5 mục 3 ghi rõ giữ nguyên v2).
  // Đã bỏ toàn bộ dòng bịa trước đây (2 dòng "giả lập" 07/2026 + 1 dòng rò rỉ 10/07/2026 không có nguồn).
  // Equipment_ID ánh xạ về hạng mục gộp v5 gần nhất; nhãn thiết bị gốc giữ nguyên văn trong Mo_ta_su_co.
  const incidentSheet = createTab('EQP_INCIDENTS', ['Incident_ID', 'Equipment_ID', 'Ngay_phat_sinh', 'Mo_ta_su_co', 'Bien_phap_xu_ly', 'Trang_thai', 'Nguoi_khac_phuc', 'Ngay_hoan_thanh', 'Hinh_anh_links', 'Tai_lieu_links', 'Nguoi_tao', 'Ngay_tao']);
  if (incidentSheet.getLastRow() <= 1) {
    const now = new Date();
    const incidentSeeds = [
      // Hệ 600 — 2 sự cố + 1 sự cố hệ 220 (INC-0002, giữ thứ tự thời gian)
      ['INC-EQP-20251122-0001', 'TB-600-02', '2025-11-22', 'Bơm bùn 3 (hệ 600): đế bơm bung mối hàn. Nguyên nhân: bơm rung lâu ngày.', 'Thay bơm dự phòng.', 'DA_XU_LY', '', '', '', '', 'SYSTEM', now],
      ['INC-EQP-20251225-0002', 'TB-220-18', '2025-12-25', 'Bơm nước thải khu B (hệ 220): bơm cháy. Nguyên nhân: bơm bị vô nước. Xác nhận thực địa 16/07/2026: bơm hố thu khu B thuộc hệ 220.', 'Thay bơm dự phòng.', 'DA_XU_LY', '', '', '', '', 'SYSTEM', now],
      ['INC-EQP-20260105-0003', 'TB-600-02', '2026-01-05', 'Bơm bùn 5 (hệ 600): bơm cháy. Nguyên nhân: bơm bị vô nước.', 'Thay bơm dự phòng.', 'DA_XU_LY', '', '', '', '', 'SYSTEM', now],
      // Hệ 220 — 5 sự cố
      ['INC-EQP-20251106-0004', 'TB-220-16', '2025-11-06', 'Quạt hút mùi (hệ 220): kêu to. Nguyên nhân: cánh quạt đứt mối hàn, niểng cánh.', 'Hàn, cân chỉnh cánh (sửa xong 06/11/2025).', 'DA_XU_LY', '', '2025-11-06', '', '', 'SYSTEM', now],
      ['INC-EQP-20251220-0005', 'TB-220-02', '2025-12-20', 'Bơm tuần hoàn 1 (hệ 220): mòn cánh và buồng bơm. Nguyên nhân: vật liệu gang ăn mòn trong nước thải.', 'Thay mới cánh + buồng bơm.', 'DA_XU_LY', '', '', '', '', 'SYSTEM', now],
      ['INC-EQP-20251220-0006', 'TB-220-02', '2025-12-20', 'Bơm tuần hoàn 2 (hệ 220): mòn cánh và buồng bơm. Nguyên nhân: vật liệu gang ăn mòn trong nước thải.', 'Thay mới cánh + buồng bơm.', 'DA_XU_LY', '', '', '', '', 'SYSTEM', now],
      ['INC-EQP-20251220-0007', 'TB-220-02', '2025-12-20', 'Bơm bùn 1 (hệ 220): mòn cánh và buồng bơm. Nguyên nhân: vật liệu gang ăn mòn trong nước thải.', 'Thay mới cánh + buồng bơm.', 'DA_XU_LY', '', '', '', '', 'SYSTEM', now],
      ['INC-EQP-20251220-0008', 'TB-220-02', '2025-12-20', 'Bơm bùn 2 (hệ 220): mòn cánh và buồng bơm. Nguyên nhân: vật liệu gang ăn mòn trong nước thải.', 'Thay mới cánh + buồng bơm.', 'DA_XU_LY', '', '', '', '', 'SYSTEM', now]
    ];
    incidentSeeds.forEach(row => incidentSheet.appendRow(row));
  }
  
  // 12. Tab REPORTS — KHÔNG seed báo cáo mẫu: bản trước là báo cáo giả (số liệu tổng hợp bịa).
  // Báo cáo thật do người dùng tạo qua module Báo cáo (compileReportData đọc dữ liệu thực).
  createTab('REPORTS', ['Report_ID', 'Loai_bao_cao', 'Ten_bao_cao', 'Tu_ngay', 'Den_ngay', 'Trang_thai', 'Noi_dung_json', 'Nguoi_tao', 'Ngay_tao', 'Nguoi_duyet', 'Ngay_duyet', 'Ghi_chu_duyet']);
  
  // 13. Tab ALERTS
  createTab('ALERTS', ['Alert_ID', 'Ngay', 'Loai_canh_bao', 'Muc_do', 'Noi_dung', 'Gia_tri', 'Nguong', 'Trang_thai', 'Nguoi_xu_ly', 'Ngay_cap_nhat', 'Ghi_chu_xu_ly']);
  
  // 14. Tab ALERT_HISTORIES
  createTab('ALERT_HISTORIES', ['History_ID', 'Alert_ID', 'Thoi_gian', 'Nguoi_thuc_hien', 'Trang_thai_moi', 'Ghi_chu']);
  
  // 15. Tab ACCESS_LOGS
  createTab('ACCESS_LOGS', ['Thoi_gian', 'Email', 'Vai_tro', 'Hanh_dong', 'Chi_tiet', 'Ket_qua']);
  
  console.log("=== Đã hoàn thành khởi tạo cơ sở dữ liệu và seed dữ liệu mẫu trạm XLNT ===");
}
