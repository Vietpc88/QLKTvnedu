// MÃ GOOGLE APPS SCRIPT (GAS) - BẢN ĐẦY ĐỦ 100% + FIX JSON COI THI
// Bản này giữ nguyên 100% logic Đăng nhập, Append, Delete của bạn.

function doGet(e) {
  return handleResponse(e);
}

function doPost(e) {
  var lock = LockService.getPublicLock();
  try {
    if (lock.tryLock(30000)) {
      return handleResponse(e);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Hệ thống đang bận. Vui lòng thử lại sau."
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": "Lỗi hệ thống: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function handleResponse(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetOriginal = ss.getSheetByName("OriginalData") || ss.insertSheet("OriginalData");
  var sheetAssignment = ss.getSheetByName("AssignmentData") || ss.insertSheet("AssignmentData");
  var sheetAdmin = ss.getSheetByName("TaiKhoanQuanTri") || ss.insertSheet("TaiKhoanQuanTri");
  var sheetTeachers = ss.getSheetByName("DanhSachGV") || ss.insertSheet("DanhSachGV");
  var sheetRooms = ss.getSheetByName("DanhSachPhong") || ss.insertSheet("DanhSachPhong");
  var sheetSchoolInfo = ss.getSheetByName("ThongTinTruong") || ss.insertSheet("ThongTinTruong");
  var sheetMarkingSubjects = ss.getSheetByName("DanhSachMon") || ss.insertSheet("DanhSachMon");
  var sheetExamSchedule = ss.getSheetByName("LichThi") || ss.insertSheet("LichThi");
  
  // Sheet cho cấu hình (Lưu JSON)
  var sheetConfig = ss.getSheetByName("Config_JSON") || ss.insertSheet("Config_JSON");
  var sheetResult = ss.getSheetByName("KetQuaPhanCong") || ss.insertSheet("KetQuaPhanCong");

  if (e.postData) {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';

    // --- LOGIC APPEND ---
    if (action === 'append') {
      var rows = data.assignmentData;
      if (rows && rows.length > 0) {
        var headers = [ "Khối", "Môn", "Giáo viên", "Số điện thoại", "Mã túi", "STT", "Phòng", "Ngày giờ nhập", "Trạng thái", "color","ID"];
        if (sheetAssignment.getLastRow() === 0) sheetAssignment.appendRow(headers);

        var currentData = getSheetData(sheetAssignment);
        var existingKeys = {};
        currentData.forEach(function(r) {
          existingKeys[r["Khối"] + "_" + r["Môn"] + "_" + r["Mã túi"]] = true;
        });

        var duplicates = [];
        var successRows = [];
        rows.forEach(function(row) {
          var key = row["Khối"] + "_" + row["Môn"] + "_" + row["Mã túi"];
          if (existingKeys[key]) { duplicates.push(row["Mã túi"]); } 
          else { successRows.push(row); existingKeys[key] = true; }
        });

        if (successRows.length > 0) {
          var startRow = sheetAssignment.getLastRow() + 1;
          var rowsData = successRows.map(function(row) {
            return headers.map(function(h) { 
              var val = row[h] || "";
              if (h === "Số điện thoại" && val !== "" && String(val).charAt(0) !== "'") return "'" + val;
              return val;
            });
          });
          sheetAssignment.getRange(startRow, 1, rowsData.length, headers.length).setValues(rowsData);
          var phoneColIdx = headers.indexOf("Số điện thoại");
          if (phoneColIdx !== -1) sheetAssignment.getRange(startRow, phoneColIdx + 1, rowsData.length, 1).setNumberFormat("@");
        }

        return ContentService.createTextOutput(JSON.stringify({
          "status": duplicates.length > 0 ? "partial" : "success",
          "message": duplicates.length > 0 ? "Bị trùng túi: " + duplicates.join(", ") : "Thành công",
          "duplicates": duplicates
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } 
    
    // --- LOGIC UPDATE STATUS ---
    else if (action === 'updateStatus') {
      var updatedRows = data.assignmentData;
      var currentData = sheetAssignment.getDataRange().getValues();
      var headers = currentData[0];
      var idIdx = headers.indexOf("ID");
      var statusIdx = headers.indexOf("Trạng thái");
      if (idIdx !== -1 && statusIdx !== -1) {
        updatedRows.forEach(function(updatedRow) {
          for (var i = 1; i < currentData.length; i++) {
            if (currentData[i][idIdx] == updatedRow["ID"]) {
              sheetAssignment.getRange(i + 1, statusIdx + 1).setValue(updatedRow["Trạng thái"]);
              break;
            }
          }
        });
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // --- LOGIC DELETE ---
    else if (action === 'delete') {
      var rowsToDelete = data.assignmentData;
      var currentData = sheetAssignment.getDataRange().getValues();
      var headers = currentData[0];
      var idIdx = headers.indexOf("ID");
      if (idIdx !== -1) {
        var idsToDelete = rowsToDelete.map(function(r) { return r["ID"]; });
        for (var i = currentData.length - 1; i >= 1; i--) {
          if (idsToDelete.indexOf(currentData[i][idIdx]) !== -1) sheetAssignment.deleteRow(i + 1);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // --- LOGIC CẬP NHẬT ĐIỂM NÓI (CONCURRENCY SAFE) ---
    else if (action === 'updateSpeakingScore') {
      var updates = data.updates;
      if (!updates || updates.length === 0) return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
      
      // Nhóm updates theo môn thi
      var updatesBySubject = {};
      updates.forEach(function(u) {
        var key = "Phach_" + u.subject;
        if (!updatesBySubject[key]) updatesBySubject[key] = [];
        updatesBySubject[key].push(u);
      });
      
      for (var sheetName in updatesBySubject) {
        var sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          var sbdToUpdates = {};
          updatesBySubject[sheetName].forEach(function(u) {
             sbdToUpdates[u.sbd] = u.speakingScore;
          });
          
          var sheetData = sheet.getDataRange().getValues();
          var headers = sheetData[0] || [];
          var sbdIdx = headers.indexOf("SBD");
          
          if (sbdIdx !== -1) {
            var scoreIdx = headers.indexOf("Điểm Nói");
            // Nếu chưa có cột Điểm Nói thì tạo mới ở cuối
            if (scoreIdx === -1) {
              scoreIdx = headers.length;
              sheet.getRange(1, scoreIdx + 1).setValue("Điểm Nói");
            }
            
            for (var i = 1; i < sheetData.length; i++) {
              var rowSbd = sheetData[i][sbdIdx];
              if (sbdToUpdates[rowSbd] !== undefined) {
                // Điền vào ô cụ thể thay vì ghi đè cả hàng
                sheet.getRange(i + 1, scoreIdx + 1).setValue(sbdToUpdates[rowSbd]);
              }
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // --- LOGIC SYNC (TÍCH HỢP JSON STORE) ---
    else {
      if (data.originalData) saveToSheet(sheetOriginal, data.originalData);
      if (data.assignmentData) saveToSheet(sheetAssignment, data.assignmentData);
      if (data.teacherList) saveToSheet(sheetTeachers, data.teacherList);
      if (data.roomData) saveToSheet(sheetRooms, data.roomData);
      if (data.schoolInfo) {
        var schoolArray = [data.schoolInfo];
        saveToSheet(sheetSchoolInfo, schoolArray);
      }
      if (data.markingSubjects) {
        var subjectObjects = data.markingSubjects
          .filter(function(s) { 
             var l = (s || '').toString().toLowerCase().trim();
             return l && l !== '' && l.indexOf('empty') === -1 && l.indexOf('_') !== 0; 
          })
          .map(function(s) { return {"Môn": s}; });
        saveToSheet(sheetMarkingSubjects, subjectObjects);
      }
      if (data.examSchedule) saveToSheet(sheetExamSchedule, data.examSchedule);
      
      // Xử lý lưu trữ theo hàng (Key-Value) để tránh hoàn toàn việc ghi đè chéo
      if (data.invigilationStore) {
        var newStore = JSON.parse(data.invigilationStore);
        var configRange = sheetConfig.getDataRange();
        var configData = configRange.getValues();
        
        // Tạo map để tra cứu dòng cho nhanh
        var keyToRowMap = {};
        for (var i = 1; i < configData.length; i++) {
          keyToRowMap[configData[i][0]] = i + 1;
        }
        
        // Đảm bảo có Tiêu đề nếu sheet trống
        if (sheetConfig.getLastRow() === 0) {
          sheetConfig.appendRow(["Key", "Value"]);
        }

        // Lặp qua từng khóa dữ liệu mới và cập nhật vào hàng riêng biệt
        for (var key in newStore) {
          var valString = typeof newStore[key] === 'object' ? JSON.stringify(newStore[key]) : newStore[key];
          if (keyToRowMap[key]) {
            // Đã có hàng -> Cập nhật dứt khoát hàng đó
            sheetConfig.getRange(keyToRowMap[key], 2).setValue(valString);
          } else {
            // Chưa có -> Thêm hàng mới
            sheetConfig.appendRow([key, valString]);
          }
        }
        
        // Xuất kết quả ma trận ra sheet để xem (Nếu có cập nhật invigilationAssignments)
        if (newStore.invigilationAssignments) {
          saveMatrixToSheet(sheetResult, newStore.invigilationAssignments);
        }

        // --- DỌN DẸP DỮ LIỆU DƯ THỪA TRONG CONFIG_JSON ---
        // Xóa những hàng đã có Sheet riêng để tránh dữ liệu cũ ghi đè dữ liệu mới khi load
        var keysToPrune = ['roomData', 'markingSubjects', 'examSchedule', 'schoolInfo', 'teacherList', 'adminAccounts'];
        for (var i = configData.length - 1; i >= 1; i--) {
          var k = configData[i][0];
          if (keysToPrune.indexOf(k) !== -1) {
            sheetConfig.deleteRow(i + 1);
          }
        }
      }

      // Logic đồng bộ các sheet Phach_
      if (data.syncPhach) {
        var allSheets = ss.getSheets();
        var phachSheets = {};
        allSheets.forEach(function(sheet) {
          var name = sheet.getName();
          if (name.indexOf("Phach_") === 0) phachSheets[name] = sheet;
        });
        for (var key in data) {
          if (key.indexOf("Phach_") === 0) {
            var sheet = ss.getSheetByName(key) || ss.insertSheet(key);
            saveToSheet(sheet, data[key]);
            if (phachSheets[key]) delete phachSheets[key];
          }
        }
        for (var name in phachSheets) phachSheets[name].clear();
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // --- PHẢN HỒI GET DATA ---
  var result = {
    originalData: getSheetData(sheetOriginal),
    assignmentData: getSheetData(sheetAssignment),
    teacherList: getSheetData(sheetTeachers),
    roomData: getSheetData(sheetRooms),
    schoolInfo: getSheetData(sheetSchoolInfo)[0] || null,
    markingSubjects: getSheetData(sheetMarkingSubjects).map(function(r) { return r["Môn"]; }),
    examSchedule: getSheetData(sheetExamSchedule),
    adminAccounts: getSheetData(sheetAdmin)
  };
  
  // Tải dữ liệu từ hệ thống lưu trữ hàng (Hợp nhất tất cả các phím thành một JSON Store)
  if (sheetConfig && sheetConfig.getLastRow() > 1) {
    var configRows = sheetConfig.getDataRange().getValues();
    var consolidatedStore = {};
    for (var i = 1; i < configRows.length; i++) {
      var key = configRows[i][0];
      var rawVal = configRows[i][1];
      if (!key) continue;
      
      try {
        consolidatedStore[key] = JSON.parse(rawVal);
      } catch(e) {
        consolidatedStore[key] = rawVal;
      }
    }
    result.invigilationStore = JSON.stringify(consolidatedStore);
  }
  
  var allSheets = ss.getSheets();
  allSheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name.indexOf("Phach_") === 0) result[name] = getSheetData(sheet);
  });

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function saveMatrixToSheet(sheet, assignments) {
  sheet.clear();
  if (!assignments || assignments.length === 0) return;
  var sample = assignments[0];
  var sessionKeys = Object.keys(sample.sessions).sort();
  var headers = ["TT", "Họ và tên giáo viên"].concat(sessionKeys).concat(["Tổng"]);
  sheet.appendRow(headers);
  var rows = assignments.map(function(asg, idx) {
    var row = [idx + 1, asg.teacherName];
    sessionKeys.forEach(function(key) { row.push(asg.sessions[key] || ""); });
    row.push(asg.total);
    return row;
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.getRange(1, 1, 1, headers.length).setBackground("#f3f3f3").setFontWeight("bold");
}

function saveToSheet(sheet, data) {
  sheet.clear();
  if (!data || data.length === 0) return;
  var headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  var rows = data.map(function(item) {
    return headers.map(function(h) { 
      var val = item[h] || "";
      if ((h === "Số điện thoại" || h === "date" || h === "Ngày" || h === "Ngày sinh") && val !== "" && String(val).charAt(0) !== "'") return "'" + val;
      return val;
    });
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function getSheetData(sheet) {
  if (!sheet) return [];
  var range = sheet.getDataRange();
  if (range.getLastRow() < 1) return [];
  var values = range.getValues();
  var headers = values[0];
  var data = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) { obj[headers[j]] = values[i][j]; }
    data.push(obj);
  }
  return data;
}
