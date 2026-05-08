import * as XLSX from 'xlsx';

/**
 * Generates and downloads an Excel template for Teacher List
 */
export const downloadTeacherTemplate = () => {
  const data = [
    { "Họ và tên": "Nguyễn Văn A", "Số điện thoại": "0901234567" },
    { "Họ và tên": "Trần Thị B", "Số điện thoại": "0912345678" }
  ];
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Danh sach GV");
  
  // Set column widths
  ws['!cols'] = [{ wch: 25 }, { wch: 20 }];
  
  XLSX.writeFile(wb, "Mau_Danh_Sach_Giao_Vien.xlsx");
};

/**
 * Generates and downloads an Excel template for Room and Subject Data
 */
export const downloadRoomTemplate = () => {
  const data = [
    { "STT": "1", "Phòng - Khối": "Phòng 01 - K6", "Toán": "Goi 1, Goi 2", "Ngữ văn": "Goi 3, Goi 4" },
    { "STT": "2", "Phòng - Khối": "Phòng 02 - K6", "Toán": "Goi 5", "Ngữ văn": "Goi 6" }
  ];
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Danh sach Phong");
  
  // Set column widths
  ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
  
  XLSX.writeFile(wb, "Mau_Phong_Va_Mon_Thi.xlsx");
};
