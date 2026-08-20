
# Cơ sở dữ liệu — Entities (Schema & RLS)

> Hạng mục 2/8

Dữ liệu local gồm các entity nghiệp vụ và `User/Profile`.
Mỗi bản ghi có các trường hệ thống: `id`, `created_date`, `updated_date`, `created_by_id`.

Quy ước viết tắt quyền: `chủ` = người tạo bản ghi; `QM` = warehouse_manager.

---

## 2.1 Product (Vật tư / Hàng tồn kho)
"Master data" cốt lõi — vật tư trong kho.

| Trường | Kiểu | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `name` | string | ✔ | — | Tên vật tư |
| `sku` | string | ✔ | — | Mã số / SKU |
| `unit` | string | – | "cái" | Chọn từ danh sách đơn vị phổ biến hoặc nhập tùy chỉnh |
| `quantity_on_hand` | number | – | 0 | Tồn kho hiện tại — bị cập nhật tự động khi tạo phiếu |
| `reorder_point` | number | – | 10 | Ngưỡng cảnh báo tồn thấp |
| `unit_price` | number | – | 0 | Đơn giá — dùng tính giá trị kho & dòng tiền |
| `notes` | string | – | — | Ghi chú |
| `image_url` | string | – | — | Ảnh vật tư (tùy chọn) |

**RLS:**
- Tạo: chủ + admin + QM + staff + user
- Sửa: chủ + admin + QM + staff + user
- Xóa: chủ + admin + QM
- Đọc: mở (null)

---

## 2.2 Order (Phiếu nhập / Phiếu xuất)
Một phiếu vận động kho. Cùng entity, phân biệt qua `type`.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `order_number` | string | ✔ | Mã phiếu |
| `type` | enum | ✔ | `Inbound` \| `Outbound` |
| `partner_name` | string | – | Đối tác/nhà cung cấp của phiếu nhập; giữ tương thích dữ liệu cũ |
| `customer_id` | string | – | FK Customer; bắt buộc với phiếu xuất |
| `customer_name` | string | – | Tên khách hàng snapshot tại thời điểm tạo phiếu xuất |
| `items[]` | array | – | Danh sách vật tư |
| ↳ `product_id` | string | – | FK Product |
| ↳ `product_name` | string | – | Tên (snapshot) |
| ↳ `sku` | string | – | Mã (snapshot) |
| ↳ `unit` | string | – | ĐVT (snapshot) |
| ↳ `quantity` | number | – | Số lượng |
| ↳ `unit_price` | number | – | Đơn giá (mặc định 0) |
| ↳ `notes` | string | – | Ghi chú từng dòng |
| `notes` | string | – | Ghi chú chung |
| `expected_date` | date | – | Ngày dự kiến |
| `completed_date` | date | – | Ngày hoàn thành (tự gán = hôm nay khi tạo) |

**RLS:** Tạo/Sửa: chủ + admin + QM + staff + user; Xóa: chủ + admin + QM; Đọc: mở.

> **Tác động phụ khi tạo phiếu** (xem mục 6.1): cập nhật `quantity_on_hand` Product + tạo `StockMovement` + tạo `Notification`.

## 2.3 Customer (Khách hàng)
Danh mục khách hàng động, không dùng danh sách cố định. Giao diện chỉ yêu cầu và lưu tên khách hàng.

| Trường | Kiểu | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `name` | string | ✔ | — | Tên khách hàng |
| `id` | string | ✔ | — | Mã local |

Khách hàng mặc định được nạp từ `src/data/customers.json`. Khách hàng mới được lưu local và xuất hiện ngay trong form tạo phiếu xuất cũng như bộ lọc tìm kiếm; dữ liệu mới được giữ cùng danh sách mặc định.

**Quyền local:** admin hoặc warehouse_manager được tạo/sửa/xóa; các role nghiệp vụ được đọc danh sách khách hàng.

---

## 2.4 StockMovement (Biến động kho)
Nhật ký lưu động tồn — nguồn cho Statistics & History.

| Trường | Kiều | Bắt buộc | Ghi chú |
|---|---|---|---|
| `product_id` | string | – | FK Product |
| `product_name` | string | ✔ | Tên (snapshot) |
| `sku` | string | – | Mã (snapshot) |
| `movement_type` | enum | ✔ | `Received` \| `Shipped` \| `Adjusted` \| `Transferred` \| `Returned` |
| `quantity` | number | ✔ | Số lượng |
| `from_location` | string | – | Vị trí nguồn |
| `to_location` | string | – | Vị trí đích |
| `order_id` | string | – | FK Order phát sinh; bắt buộc với movement do phiếu tạo |
| `notes` | string | – | Ghi chú |

**Alias hiển thị (MOVEMENT_LABELS):** Received→Nhập kho, Shipped→Xuất kho, Adjusted→Điều chỉnh, Transferred→Chuyển vị trí, Returned→Trả hàng.

**RLS:** Tạo: chủ + admin + QM + staff + user; Sửa/Xóa: chủ + admin + QM; Đọc: mở.

Mọi `StockMovement` phát sinh từ phiếu phải có `order_id`. Khi xóa phiếu, toàn bộ movement có `order_id` tương ứng phải được xóa cùng trong một transaction local; không được để movement mồ côi vì Statistics dùng entity này làm nguồn dữ liệu.

---

## 2.5 WarehouseLocation (Vị trí kho)
Vị trí lưu trữ vật lý (khu/gian/rack/bin).

| Trường | Kiểu | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `zone` | string | ✔ | — | Khu |
| `aisle` | string | – | — | Gian |
| `rack` | string | – | — | Giá/kệ |
| `bin` | string | – | — | Ngăn |
| `label` | string | ✔ | — | Nhãn vị trí |
| `type` | enum | – | Storage | Storage \| Receiving \| Shipping \| Staging \| Returns |
| `capacity` | number | – | 100 | Sức chứa |
| `current_utilization` | number | – | 0 | Mức sử dụng |
| `status` | enum | – | Available | Available \| Full \| Reserved \| Maintenance |

**RLS:** Tạo/Sửa/Xóa: chủ + admin + QM; Đọc: mở. (Hạn chế nhất — cấp quản lý kho.)

---

## 2.6 Notification (Thông báo)
Thông báo phiếu mới — hiển thị qua NotificationBell.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `title` | string | ✔ | Tiêu đề |
| `message` | string | ✔ | Nội dung |
| `type` | enum | – | `inbound` \| `outbound` |
| `order_id` | string | – | FK Order |
| `order_number` | string | – | Mã phiếu |
| `read` | boolean | – | false | Đã đọc |

**RLS:** Tạo/Sửa: chủ + admin + QM + staff; Xóa: chủ + admin + QM; **Đọc: chỉ role `user`** (hạn chế đặc thù).

---

## 2.7 User (Người dùng — local)
- Trường tùy chỉnh duy nhất: `role` (enum: admin / warehouse_manager / staff / user)
- Readonly: `id`, `created_date`, `full_name`, `email`
- **Không tạo trực tiếp** — thêm qua cơ chế **mời (invite)**.

## ERD dạng văn bản
