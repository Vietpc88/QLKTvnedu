# HỆ THỐNG QUẢN LÝ PHÂN CÔNG & GỘP PHÁCH THI

Chào mừng bạn đến với hệ thống quản lý thi chuyên nghiệp. Ứng dụng này giúp tối ưu hóa quy trình phân công giáo viên chấm thi, quản lý mã túi và gộp phách một cách chính xác, nhanh chóng.

## 🌟 Chức năng chính

### 1. Dành cho Quản trị viên (Admin)
*   **Quản lý dữ liệu gốc:** Tải lên danh sách phòng thi từ file Excel hoặc đồng bộ trực tiếp từ Google Sheets.
*   **Phân công chấm thi:**
    *   Phân công giáo viên theo Khối, Môn và Mã túi.
    *   Tự động gán màu sắc riêng biệt cho từng giáo viên để dễ dàng theo dõi.
    *   Hỗ trợ nhập nhiều mã túi cùng lúc (cách nhau bởi dấu phẩy).
*   **Quản lý Phách:** Nhập và quản lý mã phách tương ứng với từng mã túi.
*   **Xuất dữ liệu:** Xuất bảng phân công ra file Excel theo mẫu chuẩn.
*   **Đồng bộ đám mây:** Lưu trữ và tải dữ liệu an toàn thông qua Google Apps Script (GAS).

### 2. Dành cho Giáo viên (Teacher)
*   **Tra cứu cá nhân:** Xem danh sách các túi thi mình được phân công.
*   **Nhập phách:** Cập nhật mã phách cho các túi thi được giao (nếu được phép).
*   **Thống kê:** Theo dõi tiến độ và số lượng túi thi đã hoàn thành.

### 3. Gộp phách & Tra cứu
*   **Gộp phách tự động:** Kết nối dữ liệu phân công và dữ liệu phách để tạo ra bảng tổng hợp cuối cùng.
*   **Tra cứu nhanh:** Tìm kiếm thông tin theo mã túi hoặc tên giáo viên.

---

## 🚀 Hướng dẫn sử dụng nhanh

### Bước 1: Cấu hình hệ thống
1.  Truy cập vào mục **Cài đặt** (biểu tượng bánh răng).
2.  Nhập **GAS URL** (đường dẫn Google Apps Script) để kích hoạt tính năng lưu trữ đám mây.
3.  Thiết lập mật khẩu quản trị nếu cần.

### Bước 2: Tải dữ liệu gốc
1.  Tại tab **PHÂN CÔNG**, chọn **Tải Excel** hoặc **Tải từ Sheets**.
2.  File Excel cần có các cột tối thiểu: `STT`, `Phòng - Khối`, và các cột tên môn học.

### Bước 3: Thực hiện phân công
1.  Chọn **Khối** và **Môn học**.
2.  Chọn **Giáo viên** từ danh sách hoặc nhập tên mới.
3.  Nhập các **Mã túi** (Ví dụ: `DKZ, YBK, ...`).
4.  Nhấn **Thêm phân công**.

### Bước 4: Quản lý Phách & Gộp phách
1.  Chuyển sang tab **GỘP PHÁCH & TRA CỨU**.
2.  Nhập mã phách cho từng mã túi trong danh sách.
3.  Sử dụng bộ lọc để kiểm tra các túi còn thiếu hoặc đã hoàn thành.

---

## 📋 Lưu ý quan trọng
*   **Mã túi:** Cần nhập chính xác mã túi như trong dữ liệu gốc. Hệ thống phân biệt chữ hoa/thường tùy theo dữ liệu bạn nhập.
*   **Lưu dữ liệu:** Luôn nhấn nút **Lưu lên Sheets** sau khi thực hiện các thay đổi quan trọng để tránh mất dữ liệu khi làm mới trang.
*   **Xóa dữ liệu:** Tính năng **Làm mới kì thi** sẽ xóa sạch toàn bộ dữ liệu hiện tại. Hãy cẩn trọng và sao lưu (Xuất Excel) trước khi thực hiện.

---
*Chúc bạn có một kì thi diễn ra suôn sẻ và hiệu quả!*
