
| Màn hình | Chức năng | Entity tương tác | Helper lib |
|---|---|---|---|
| **Dashboard** | ① 4 thẻ chỉ số (tổng SL, tổng giá trị, tồn thấp, tổng phiếu) ② Bảng cảnh báo tồn ≤ reorder_point (top 5) ③ Đơn hàng gần đây ④ Line hoạt động (StockMovement 10 mới nhất) | Product, Order, WarehouseLocation, StockMovement (đọc) | moment, StatCard, StatusBadge |
| **Inventory** | ① Bảng vật tư (tên/SKU/ĐVT/SL/đơn giá) ② Tìm tên/SKU ③ Thêm/sửa dialog ④ Xóa ⑤ Tô đỏ SL thấp | Product (CRUD) | ProductFormDialog |
| **Orders (Inbound)** | ① Danh sách phiếu type=Inbound ② Tìm theo mã/đối tác ③ Lọc ngày (5 chế độ) ④ Tạo phiếu → tự trừ/cộng tồn + tạo StockMovement + Notification ⑤ Xóa (admin) ⑥ Xuất Excel từng/tất cả | Order, Product, StockMovement, Notification | OrderFormDialog, exportOrder |
| **Orders (Outbound)** | Như Inbound + tìm/lọc theo số phiếu, ngày/tháng/năm, khoảng ngày, vật tư và khách hàng động ⑦ Thêm khách hàng ⑧ Xuất Word (cap/banGiao) + In + In tất cả ⑨ Xóa cascade phiếu và toàn bộ dữ liệu liên quan | Order, Customer, Product, StockMovement, Notification | + customerStore, deleteOrderCascade, exportWord, printSlip |
| **Statistics** | ① Biểu đồ Xuất–nhập (recharts) ② Biểu đồ Chênh lệch dòng tiền ③ Chọn khoảng ngày ④ Thẻ thống kê khoảng ⑤ Tra cứu ngày/tháng/năm → 2 bảng Nhập/Xuất ⑥ Chỉ thống kê movement còn tồn tại và hợp lệ ⑦ Xuất Excel biến động | StockMovement, Product (đọc) | MovementChart, CashflowChart, exportOrder.exportMovementsToExcel |
| **StaffManagement** | ① Liệt kê User ② Đổi role (select, trừ chính mình) ③ Toast phản hồi | User (đọc/sửa) | permissions (ROLE_LABELS, ROLE_OPTIONS) |
| **History** | ① Gộp lịch sử Order+StockMovement+Product ② Sắp xếp mới nhất ③ Lọc user + ngày/tháng/năm ④ Tìm ⑤ Bảng badge màu theo hành động | Order, StockMovement, Product, User (đọc) | moment |
| **Backup** | ① Chọn khoảng ② Xuất Excel 4 sheet | Product, Order, StockMovement (đọc) | exportBackup |
| Login/Register/Forgot/Reset | Đăng nhập, đăng ký+OTP, quên/đặt lại mật khẩu | 
