import React from 'react';
import { X, Copy } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gasUrl: string;
  setGasUrl: (url: string) => void;
}

const GAS_CODE = `// MÃ GOOGLE APPS SCRIPT (GAS) - PHIÊN BẢN CHỐNG GHI ĐÈ (CONCURRENCY SAFE)
function doGet(e) {
  return handleResponse(e);
}

function doPost(e) {
  // Sử dụng LockService để ngăn chặn việc ghi đè khi nhiều người gửi cùng lúc
  var lock = LockService.getPublicLock();
  // Chờ tối đa 30 giây để lấy quyền ghi
  try {
    if (lock.tryLock(30000)) {
      return handleResponse(e);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Hệ thống đang bận do có quá nhiều người truy cập cùng lúc. Vui lòng thử lại sau vài giây."
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
  var sheetTeacherList = ss.getSheetByName("TeacherList") || ss.insertSheet("TeacherList");
  var sheetRoomData = ss.getSheetByName("RoomData") || ss.insertSheet("RoomData");
  var sheetAssignment = ss.getSheetByName("AssignmentData") || ss.insertSheet("AssignmentData");
  var sheetAdmin = ss.getSheetByName("TaiKhoanQuanTri") || ss.insertSheet("TaiKhoanQuanTri");

  if (e.postData) {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';

    if (action === 'sync') {
      if (data.teacherList) saveToSheet(sheetTeacherList, data.teacherList);
      if (data.roomData) saveToSheet(sheetRoomData, data.roomData);
      if (data.assignmentData) saveToSheet(sheetAssignment, data.assignmentData);
      if (data.originalData) saveToSheet(sheetOriginal, data.originalData);
      
      // ... same for phach
    }
    // ... logic for append/updateStatus/delete (keep existing or update headers)
  }

  var result = {
    teacherList: getSheetData(sheetTeacherList),
    roomData: getSheetData(sheetRoomData),
    assignmentData: getSheetData(sheetAssignment),
    originalData: getSheetData(sheetOriginal),
    adminAccounts: getSheetData(sheetAdmin)
  };
  // ... loop Phach_
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
  
  // Lấy dữ liệu từ tất cả các sheet Phach_
  var allSheets = ss.getSheets();
  allSheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name.indexOf("Phach_") === 0) {
      result[name] = getSheetData(sheet);
    }
  });

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function saveToSheet(sheet, data) {
  sheet.clear();
  if (data.length === 0) return;
  var headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  var rows = data.map(function(item) {
    return headers.map(function(h) { 
      var val = item[h] || "";
      if (h === "Số điện thoại" && val !== "" && String(val).charAt(0) !== "'") {
        return "'" + val;
      }
      return val;
    });
  });
  
  var phoneColIndex = headers.indexOf("Số điện thoại");
  if (phoneColIndex !== -1) {
    sheet.getRange(2, phoneColIndex + 1, rows.length, 1).setNumberFormat("@");
  }
  
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
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[i][j];
    }
    data.push(obj);
  }
  return data;
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
