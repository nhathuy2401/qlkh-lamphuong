
# Mô tả chi tiết từng màn hình & luồng

> Hạng mục 5/8

## 5.1 Dashboard (`/` — Tổng quan)
**Tải dữ liệu local:** Product (toàn bộ) · Order · StockMovement · Customer; không còn nguồn dữ liệu tổ chức/nhà máy.

**Thẻ chỉ số (StatCard):**
- *Tổng số lượng*: Σ quantity_on_hand, phụ đề "{n} vật tư"
- *Tổng giá trị kho*: Σ (qoh × unit_price), hiển thị triệu đ + gốc
- *Tồn kho thấp*: count(qoh ≤ reorder_point); màu đỏ khi >0, xám khi =0
- *Tổng số phiếu*: orders.length

**Các panel:**
- *Cảnh báo tồn thấp*: 5 vật tư thấp nhất + link "/inventory"
- *Đơn hàng gần đây*: 5 phiếu + badge Inbound/Outbound + moment.fromNow()
- *Hoạt động gần đây*: 10 StockMovement + badge movement_type + tên vật tư + SL (chiếm 2 cột)

**Trạng thái:** spinner khi loading; empty "Mức tồn kho đều ổn định" / "Chưa có đơn hàng" / "Chưa có hoạt động".

## 5.2 Inventory (`/inventory` — Kho hàng)
**Bảng:** Tên+SKU · ĐVT · Số lượng tồn (mặc định 0, đỏ nếu ≤ reorder_point) · Đơn giá · Ghi chú · cột [sửa][xóa].
**Tìm kiếm:** theo name/SKU (client filter).
**Thêm/Sửa:** ProductFormDialog modal → Product.create/update → toast → reload.
**Xóa:** Product.delete → toast → reload.
**Empty:** EmptyState + nút "Thêm vật tư" khi không có search.
**Responsive:** cột đơn giá ẩn < lg, ghi chú ẩn < md.

## 5.3 Orders (`/orders/inbound` & `/orders/outbound`)
Cùng component `Orders`, prop `type` quyết định nhãn + hành vi.

**Tạo phiếu:**
1. Chọn/tìm vật tư theo tên hoặc SKU, thêm nhiều dòng vật tư và số lượng.
2. Order.create({...form, items, completed_date: hôm nay})
3. applyCompletion — cho mỗi item:
   - Product.get → tính delta (+q nếu Inbound / −q nếu Outbound) → Product.update; phiếu xuất không bị chặn khi tồn không đủ, tồn có thể âm.
   - StockMovement.create (Received | Shipped) gắn order_id
4. Notification.create (inbound | outbound)
5. Toast + reload

**Tìm kiếm và lọc (đặc biệt đầy đủ ở Outbound):**
- Tìm tự do theo số phiếu, tên/mã vật tư, tên khách hàng/đối tác.
- Lọc ngày theo 5 chế độ: Tất cả / Ngày / Tháng / Năm / Khoảng; khoảng ngày gồm `rangeFrom` và `rangeTo`.
- Lọc theo vật tư trong `items[]`.
- Lọc theo khách hàng từ entity `Customer`, không dùng danh sách khách hàng cố định. Khách hàng vừa thêm phải xuất hiện ngay trong bộ lọc và tìm được các phiếu đã tạo.
- Nếu chưa có khách hàng, hiển thị trạng thái rỗng kèm nút **Thêm khách hàng**; không tạo lựa chọn khách hàng giả.

**Toolbar xuất (chỉ hiện khi có kết quả):**
- *Xuất Excel tất cả* (exportOrdersBulkToExcel): sheet thông tin + sheet vật tư
- *(Outbound)* *Xuất Word tất cả* (exportPhieuWordBulk): gộp + page-break
- *(Outbound)* *In tất cả* (printPhieuBulk)

**Mỗi card phiếu:** mã + khách hàng/đối tác + ngày + dự kiến; chip "tên ×SL"; ghi chú. Nút: Xuất Excel đơn · (Outbound) Phiếu VT (Word) · In · (admin) Xóa.

> **Phân quyền xóa:** chỉ user.role === 'admin'.

**Xóa phiếu — bắt buộc cascade và hoàn tác tồn kho:**
1. Hiển thị xác nhận, nêu rõ phiếu, số dòng vật tư và dữ liệu liên quan sẽ bị xóa.
2. Hoàn tác tồn kho theo chiều ngược lại: phiếu nhập trừ số lượng đã cộng; phiếu xuất cộng lại số lượng đã trừ.
3. Xóa tất cả `StockMovement` có `order_id` bằng id phiếu.
4. Xóa tất cả `Notification` có `order_id` bằng id phiếu.
5. Xóa bản ghi `Order`.
6. Làm mới cache/query của Order, Product, StockMovement và Notification; biểu đồ phải render lại từ dữ liệu mới.

Các bước phải chạy trong một transaction của local store. Nếu một bước lỗi thì rollback, không được để phiếu đã xóa nhưng movement vẫn còn. Statistics chỉ nhận movement hợp lệ còn tồn tại; movement mồ côi từ dữ liệu cũ phải được dọn khi khởi tạo/migrate dữ liệu.

## 5.4 Statistics (`/statistics`)
**Tải:** StockMovement 500 + Product 2000.
**Khoảng biểu đồ:** mặc định 7 ngày gần nhất; chọn from/to.
**2 chế độ biểu đồ:**
- *Xuất nhập kho* → 4 thẻ (Tổng nhập, Tổng xuất, Chênh lệch, Tổng giá trị kho) + MovementChart
- *Chênh lệch dòng tiền* → 3 thẻ (Tiền nhập, Tiền xuất, Chênh lệch) + CashflowChart
- Build mảng ngày: chỉ lặp movement còn tồn tại, có `order_id` hợp lệ hoặc là movement điều chỉnh độc lập; Received→inbound, Shipped→outbound; × unit_price = giá trị.

**Tra cứu** (segmented ngày/tháng/năm): 2 card (Nhập xanh/Xuất xanh dương) + 2 bảng song song (scroll, header sticky) + Xuất Excel.

**Empty:** "Không có dữ liệu" khi khoảng không có biến động.

## 5.5 StaffManagement (`/staff` — admin)
**Danh sách:** User.list sort created_date. Mỗi dòng: avatar chữ đầu, tên ("(Bạn)" nếu chính mình), email, badge role.
**Đổi role:** Select; bản thân = "Không thể thay đổi". Lỗi → toast destructive.
**Badge màu:** admin=tím, warehouse_manager=xanh dương, còn lại=xám.

## 5.6 History (`/history` — admin)
**Gộp nguồn:** Order (Tạo phiếu nhập/xuất) + StockMovement (Nhập/Xuất kho) + Product (Thêm vật tư + cập nhật khi updated_date≠created_date).
**Ánh xạ người dùng:** created_by_id → tên (qua User.list).
**Sắp xếp:** giảm dần thời gian.
**Lọc:** search (tên/user/mã) + filter user + filter ngày/tháng/năm.
**Bảng:** Thời gian · Người dùng · Hành động (badge màu — 6 kiểu) · Chi tiết (+ extra đối tác/SL/SKU). Scroll max 600px, header sticky.

**actionStyles:** Tạo phiếu nhập/xuất (emerald/blue), Nhập/Xuất kho (emerald/blue), Thêm vật tư (purple), Cập nhật vật tư (amber).

## 5.7 Backup (`/backup` — admin)
**Card đơn:** chọn khoảng (Tất cả/Ngày/Tháng/Năm) + picker + preview "Sẽ xuất dữ liệu: …".
**Nút xuất:** exportBackup → 4 sheet
1. Thông tin (loại, hình thức, thời gian, ngày xuất, count, lưu ý)
2. Kho hàng — tồn đầy đủ, **không lọc ngày** (SKU/tên/ĐVT/ghi chú/tồn/reorder/đơn giá/giá trị tồn)
3. Phiếu nhập xuất — lọc ngày (mã/loại/ngày/đối tác/tên vật tư/SKU/ĐVT/SL/đơn giá/thành tiền)
4. Biến động kho — lọc ngày (ngày/loại/sản phẩm/SKU/SL/ghi chú)
Toast thành công/lỗi.

## 5.8 Trang xác thực
**Login:** email+pass, Google, link forgot → loginViaEmailPassword / loginWithProvider.
**Register:** email+pass+confirm + Google → register (chưa login) → OTP → verifyOtp → setToken → redirect.
**ForgotPassword:** email → resetPasswordRequest → generic success.
**ResetPassword:** ?token= + new pass + confirm → resetPassword → redirect /login.
