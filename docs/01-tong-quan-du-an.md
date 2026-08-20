
# QLKH — Hệ thống Quản lý Kho Vật Tư

> Tài liệu tổng quan dự án — Hạng mục 1/8

## 1. Thông tin định danh
- **Tên hệ thống:** QLKH (Quản lý Kho Hàng)
- **Loại ứng dụng:** Ứng dụng quản lý nghiệp vụ đa nền tảng (web/PWA/mobile app)
- **Ngôn ngữ giao diện:** Tiếng Việt (100%)
- **Nền tảng xây dựng:** React + Progressive Web App (PWA)
- **Stack kỹ thuật:** React + Tailwind CSS + Vite + shadcn/ui
- **Lưu trữ dữ liệu:** Local-first, dữ liệu được lưu trực tiếp trên thiết bị; không sử dụng backend
- **Trạng thái:** Đang chuyển đổi từ phiên bản Base44 sang React/PWA dùng dữ liệu local

## 2. Mục đích nghiệp vụ
Số hóa toàn bộ nghiệp vụ **quản lý kho vật tư** cho nhiều loại hình doanh nghiệp. Phiên bản hiện tại tập trung vào kho, vật tư, phiếu nhập/xuất và khách hàng; không còn màn hình hoặc luồng quản lý tổ chức/doanh nghiệp/nhà máy cố định.

Mục tiêu cụ thể:
1. Theo dõi tồn kho vật tư theo thời gian thực
2. Cảnh báo vật tư tồn thấp (≤ mức đặt lại)
3. Quản lý phiếu nhập / phiếu xuất kho
4. Tự động trừ/cộng tồn khi tạo phiếu
5. Thống kê biểu đồ xuất–nhập và chênh lệch dòng tiền
6. Tra cứu lịch sử biến động theo ngày/tháng/năm
7. Lưu vết thao tác người dùng (audit log)
8. Xuất chứng từ Excel / Word / in ấn theo biểu mẫu hành chính
9. Sao lưu dữ liệu ra Excel
10. Phân quyền theo vai trò (RBAC)
11. Thêm nhiều vật tư trong cùng một phiếu nhập hoặc xuất
12. Làm việc trên trình duyệt và cài đặt như ứng dụng trên máy tính hoặc thiết bị di động
13. Hỗ trợ làm việc offline với dữ liệu đã lưu trên thiết bị
14. Quản lý danh sách khách hàng động (chỉ tên) và tìm phiếu xuất theo khách hàng
15. Khi xóa phiếu, xóa toàn bộ dữ liệu phát sinh liên quan và cập nhật lại tồn kho/thống kê

## 3. Vai trò người dùng (Roles)
| Mã role | Nhãn | Mô tả quyền |
|---|---|---|
| `admin` | Quản trị viên | Toàn quyền + quản lý nhân viên + lịch sử + sao lưu + xóa phiếu |
| `warehouse_manager` | Quản lý kho | Nghiệp vụ kho đầy đủ; không xem Nhân viên/Lịch sử/Sao lưu |
| `staff` | Nhân viên | Tạo/sửa vật tư + tạo phiếu; không xóa phiếu |
| `user` | Nhân viên | Tương đương staff (chỉ khác về quyền đọc Notification) |

> Chỉ `admin` thấy 3 mục **Quản lý nhân viên / Lịch sử / Sao lưu** trên Sidebar.

## 4. Tổng quan kiến trúc
- **Ứng dụng:** React (ESM, Vite) triển khai dưới dạng PWA, có thể cài đặt trên desktop và thiết bị di động.
- **Giao diện:** Tailwind CSS, shadcn/ui, lucide-react, moment, recharts (biểu đồ), react-router-dom.
- **Dữ liệu:** Không có backend/API bắt buộc. Dữ liệu nghiệp vụ được lưu local trên thiết bị, ưu tiên IndexedDB cho dữ liệu có cấu trúc và localStorage cho cấu hình nhẹ.
- **Phạm vi hiện tại:** Không hiển thị module Tổ chức; các nghiệp vụ thao tác trực tiếp trên danh mục vật tư, phiếu và khách hàng.
- **Xác thực và phân quyền:** Hồ sơ/ngữ cảnh người dùng được quản lý local; RBAC áp dụng trong phạm vi ứng dụng và thiết bị đang sử dụng.
- **Offline/PWA:** Service Worker lưu cache tài nguyên ứng dụng, hỗ trợ khởi chạy và thao tác với dữ liệu đã có khi không có mạng.
- **Xuất file:** `xlsx` (Excel), `pizzip` + DOMParser (Word .docx từ template), `window.print` (in).

## 5. Số lượng thành phần
- **12 route** (4 auth + 8 ứng dụng) + PageNotFound
- **Các entity nghiệp vụ cốt lõi:** Customer, Product, Order, StockMovement, Notification và User/Profile (local)
- **8 trang chức năng** chính
- **4 thư viện xuất/in** (exportOrder, exportWord, printSlip, exportBackup)
- **~10 shared compound components** (PageHeader, StatCard, StatusBadge, EmptyState, ProductFormDialog, OrderFormDialog, MovementChart, CashflowChart, NotificationBell, AppLayout, Sidebar, ProtectedRoute)
