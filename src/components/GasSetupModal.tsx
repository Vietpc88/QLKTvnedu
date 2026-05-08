import React from 'react';
import { X, Copy } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gasUrl: string;
  setGasUrl: (url: string) => void;
}

const GAS_CODE = `// MÃ GOOGLE APPS SCRIPT (GAS) - BẢN TỐI ƯU HÓA SHEET & TỰ ĐỘNG DỌN DẸP
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
  
  var sheetConfig = ss.getSheetByName("Config_JSON") || ss.insertSheet("Config_JSON");
  var sheetResult = ss.getSheetByName("KetQuaPhanCong") || ss.insertSheet("KetQuaPhanCong");

  if (e.postData) {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';

    if (action === 'append') {
      var rows = data.assignmentData;
      if (rows && rows.length > 0) {
        var headers = [ "Khối", "Môn", "Giáo viên", "Số điện thoại", "Mã túi", "STT", "Phòng", "Ngày giờ nhập", "Trạng thái", "color","ID"];
        if (sheetAssignment.getLastRow() === 0) sheetAssignment.appendRow(headers);
        var currentData = getSheetData(sheetAssignment);
        var existingKeys = {};
        currentData.forEach(function(r) { existingKeys[r["Khối"] + "_" + r["Môn"] + "_" + r["Mã túi"]] = true; });

        var successRows = rows.filter(function(row) { 
          return !existingKeys[row["Khối"] + "_" + row["Môn"] + "_" + row["Mã túi"]];
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
        }
        return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
      }
    } 
    else if (action === 'sync') {
      if (data.originalData) saveToSheet(sheetOriginal, data.originalData);
      if (data.assignmentData) saveToSheet(sheetAssignment, data.assignmentData);
      if (data.teacherList) saveToSheet(sheetTeachers, data.teacherList);
      if (data.roomData) saveToSheet(sheetRooms, data.roomData);
      if (data.schoolInfo) saveToSheet(sheetSchoolInfo, [data.schoolInfo]);
      if (data.markingSubjects) saveToSheet(sheetMarkingSubjects, data.markingSubjects.map(function(s) { return {"Môn": s}; }));
      if (data.examSchedule) saveToSheet(sheetExamSchedule, data.examSchedule);
      
      if (data.invigilationStore) {
        var newStore = JSON.parse(data.invigilationStore);
        var configRange = sheetConfig.getDataRange();
        var configData = configRange.getValues();
        var keyToRowMap = {};
        for (var i = 1; i < configData.length; i++) { keyToRowMap[configData[i][0]] = i + 1; }
        
        if (sheetConfig.getLastRow() === 0) sheetConfig.appendRow(["Key", "Value"]);

        for (var key in newStore) {
          var valString = typeof newStore[key] === 'object' ? JSON.stringify(newStore[key]) : newStore[key];
          if (keyToRowMap[key]) {
            sheetConfig.getRange(keyToRowMap[key], 2).setValue(valString);
          } else {
            sheetConfig.appendRow([key, valString]);
          }
        }
        
        // DỌN DẸP: Xóa các phím đã có sheet riêng khỏi Config_JSON
        var keysToPrune = ['roomData', 'markingSubjects', 'examSchedule', 'schoolInfo', 'teacherList', 'adminAccounts'];
        for (var i = configData.length - 1; i >= 1; i--) {
          if (keysToPrune.indexOf(configData[i][0]) !== -1) sheetConfig.deleteRow(i + 1);
        }

        if (newStore.invigilationAssignments) saveMatrixToSheet(sheetResult, newStore.invigilationAssignments);
      }

      if (data.syncPhach) {
        for (var key in data) {
          if (key.indexOf("Phach_") === 0) {
            var sheet = ss.getSheetByName(key) || ss.insertSheet(key);
            saveToSheet(sheet, data[key]);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
  }

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
  
  if (sheetConfig && sheetConfig.getLastRow() > 1) {
    var configRows = sheetConfig.getDataRange().getValues();
    var consolidatedStore = {};
    for (var i = 1; i < configRows.length; i++) {
      try { consolidatedStore[configRows[i][0]] = JSON.parse(configRows[i][1]); } 
      catch(e) { consolidatedStore[configRows[i][0]] = configRows[i][1]; }
    }
    result.invigilationStore = JSON.stringify(consolidatedStore);
  }
  
  ss.getSheets().forEach(function(s) {
    if (s.getName().indexOf("Phach_") === 0) result[s.getName()] = getSheetData(s);
  });

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function saveToSheet(sheet, data) {
  sheet.clear();
  if (!data || data.length === 0) return;
  var headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  var rows = data.map(function(item) {
    return headers.map(function(h) { 
      var val = item[h] || "";
      if ((h.indexOf("điện thoại") !== -1 || h === "Ngày") && val !== "" && String(val).charAt(0) !== "'") return "'" + val;
      return val;
    });
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function getSheetData(sheet) {
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

function saveMatrixToSheet(sheet, assignments) {
  sheet.clear();
  if (!assignments || assignments.length === 0) return;
  var sessions = Object.keys(assignments[0].sessions).sort();
  sheet.appendRow(["Họ và tên"].concat(sessions).concat(["Tổng"]));
  var rows = assignments.map(function(asg) {
    var r = [asg.teacherName];
    sessions.forEach(function(s) { r.push(asg.sessions[s] || ""); });
    r.push(asg.total);
    return r;
  });
  sheet.getRange(2, 1, rows.length, sessions.length + 2).setValues(rows);
}
`;

export const GasSetupModal: React.FC<Props> = ({ isOpen, onClose, gasUrl, setGasUrl }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Cấu hình Google Apps Script (GAS)</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800 rounded-md hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL Web App của Google Apps Script
            </label>
            <input
              type="text"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-2 text-sm text-gray-500">
              Dán URL Web App của bạn vào đây để đồng bộ dữ liệu với Google Sheets.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">Hướng dẫn cài đặt:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Tạo một Google Sheet mới.</li>
              <li>Vào <strong>Tiện ích mở rộng</strong> &gt; <strong>Apps Script</strong>.</li>
              <li>Xóa mã cũ và dán đoạn mã bên dưới vào.</li>
              <li>Nhấn <strong>Triển khai (Deploy)</strong> &gt; <strong>Tùy chọn triển khai mới (New deployment)</strong>.</li>
              <li>Chọn loại: <strong>Ứng dụng web (Web app)</strong>.</li>
              <li>Quyền truy cập: <strong>Bất kỳ ai (Anyone)</strong>.</li>
              <li>Sao chép URL Web app và dán vào ô bên trên.</li>
            </ol>

            <div className="relative mt-4">
              <div className="absolute top-2 right-2">
                <button 
                  onClick={() => navigator.clipboard.writeText(GAS_CODE)}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs font-mono">
                {GAS_CODE}
              </pre>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
