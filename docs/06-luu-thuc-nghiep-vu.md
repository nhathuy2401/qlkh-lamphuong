
# Luồng nghiệp vụ chính (Core Workflows)

> Hạng mục 6/8

## 6.1 Tạo phiếu nhập / xuất kho (end-to-end)
Người dùng → /orders/{inbound|outbound} → "Tạo phiếu" → form: mã phiếu (`order_number`), khách hàng/đối tác, tìm vật tư theo tên/SKU, thêm nhiều dòng số lượng và ghi chú. Với phiếu xuất, chọn khách hàng từ entity `Customer` hoặc bấm **Thêm khách hàng**; lưu `customer_id` và `customer_name` snapshot.

Lưu theo transaction: `Order.create({...form, completed_date: hôm nay})`; với mỗi item, cập nhật `Product.quantity_on_hand` (+quantity cho Inbound, −quantity cho Outbound), tạo `StockMovement` gắn `order_id`, sau đó tạo `Notification`. Toast thành công và reload các nguồn dữ liệu liên quan.

## 6.2 Tìm kiếm phiếu xuất
Ở `/orders/outbound`, bộ lọc phải hỗ trợ đồng thời số phiếu; ngày cụ thể, tháng, năm hoặc khoảng ngày; tên/mã vật tư trong `items[]`; và khách hàng qua `customer_id`/`customer_name`.

Khách hàng mới tạo phải được lưu local, xuất hiện ngay trong danh sách lựa chọn và dùng được để tìm các phiếu xuất đã tạo. Khi chưa có khách hàng, hiển thị nút **Thêm khách hàng**, không dùng danh sách khách hàng hard-code.


## 6.3 Thống kê & tra cứu
Chọn khoảng (from–to) → useMemo rebuild chartData:

Tạo mảng ngày trong khoảng (key YYYY-MM-DD, label DD/MM)
Lặp các `StockMovement` còn tồn tại và hợp lệ: Received → day.inbound += qty, day.inboundValue += qty × price; Shipped → day.outbound += qty, day.outboundValue += qty × price.
day.cashflowDiff = inboundValue − outboundValue → Render MovementChart (bar/line) hoặc CashflowChart → Thẻ tổng theo khoảng
Tra cứu:

Chọn ngày/tháng/năm → filter StockMovement theo created_date
2 card tổng Nhập/Xuất + 2 bảng song song (sticky header, scroll)
Xuất Excel (exportMovementsToExcel)

## 6.4 Xóa phiếu nhập/xuất
`deleteOrderCascade(orderId)` phải chạy atomic trong local database:

1. Đọc Order và toàn bộ `items[]`.
2. Hoàn tác tồn kho: phiếu nhập trừ lượng đã nhập; phiếu xuất cộng lại lượng đã xuất.
3. Xóa mọi `StockMovement` có `order_id = orderId`.
4. Xóa mọi `Notification` có `order_id = orderId`.
5. Xóa bản ghi `Order`.
6. Invalidate/reload Order, Product, StockMovement, Notification và dữ liệu Statistics.

Không được chỉ xóa Order. Nếu còn movement không có Order tương ứng, migration/cleanup phải xóa movement mồ côi trước khi tính biểu đồ. Sau khi xóa thành công, phiếu không được xuất hiện trong tìm kiếm, lịch sử biến động, sao lưu hoặc bất kỳ biểu đồ nào.

## 6.5 Xuất chứng từ in ấn (chỉ Outbound)

Phiên bản local hỗ trợ xuất DOCX và in trực tiếp trên từng phiếu. Template được chọn theo khách hàng: ba xí nghiệp khoáng sản dùng mẫu bàn giao; các đơn vị còn lại dùng mẫu cấp vật tư. Số phiếu, ngày tháng năm, đơn vị nhận và toàn bộ `items[]` được điền tự động.

Phiếu đơn:

Xuất Excel (exportOrderToExcel): 2 sheet
Phiếu VT (exportPhieuWord): 1 .docx từ template
In (printPhieu): window.print
(admin) Xóa
Tất cả:

Xuất Excel (exportOrdersBulkToExcel): 2 sheet, thông tin tra cứu + danh sách vật tư
Xuất Word (exportPhieuWordBulk): gộp nhiều phiếu + page-break
In tất cả (printPhieuBulk)
Loại Word (getSlipType):

`customer_id`/`customer_name` xác định đơn vị nhận; loại phiếu Word được chọn theo cấu hình biểu mẫu của khách hàng, không so sánh với một doanh nghiệp cố định. Template .docx nằm trong assets của ứng dụng; điền số phiếu, đơn vị nhận, căn cứ giao nhận, bảng items (STT/tên/SKU/ĐVT/SL/ghi chú), rebuild bảng chữ ký và nén dòng để vừa 1 trang.

## 6.6 Sao lưu dữ liệu
Chọn khoảng (Tất cả/Ngày/Tháng/Năm) + ngày tương ứng → "Xuất file sao lưu Excel" → tải Product(5000) + Order(5000) + StockMovement(5000) → filter theo created_date nếu !== "all" → exportBackup → .xlsx 4 sheet (Thông tin, Kho hàng, Phiếu nhập xuất, Biến động kho) → Toast


## 6.7 Quản lý nhân viên (admin)
User.list → bảng → chọn role mới (trừ chính mình) → User.update → toast ⚠️ Thêm người = invite (không tạo trực tiếp): base44.users.inviteUser(email, role)


## 6.8 Phân quyền theo role (Sidebar)
admin → thấy tất cả 8 mục + mọi nút xóa warehouse_manager → 5 mục nghiệp vụ (không thấy Staff/History/Backup) staff / user → 5 mục nghiệp vụ (không xóa phiếu)
