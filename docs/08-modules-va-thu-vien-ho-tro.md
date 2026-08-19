
# Modules & Thư viện hỗ trợ

> Hạng mục 8/8

## 8.1 Logic modules (`src/lib/`)

### permissions.js
- `ROLES` (const), `ROLE_LABELS`, `ROLE_OPTIONS`
- `canApproveOrders`, `canManageStaff`, `isFullAccess`

### constants.js
- Chỉ chứa các enum/nhãn dùng chung; không chứa danh sách khách hàng cố định.
- Danh sách khách hàng được đọc/ghi từ entity local `Customer`.

### customerStore.js
- `listCustomers()` — lấy khách hàng đang hoạt động, sắp xếp theo tên.
- `createCustomer(data)` / `updateCustomer(id, data)` — quản lý khách hàng local.
- `findCustomerOrders(customerId)` — tìm phiếu xuất theo `customer_id`.

### deleteOrderCascade.js
- `deleteOrderCascade(orderId)` — transaction xóa Order, StockMovement liên quan, Notification liên quan và hoàn tác tồn Product.
- Bắt buộc invalidate/reload toàn bộ dữ liệu phụ thuộc để Dashboard, Statistics, History và Backup không dùng dữ liệu cũ.

### exportOrder.js (XLSX)
- `exportMovementsToExcel(movements, {searchDate, searchMode, searchInbound, searchOutbound})` — 2 sheet (Thông tin tra cứu + Danh sách biến động)
- `exportOrderToExcel(order)` — 2 sheet (Thông tin đơn + Danh sách mặt hàng)
- `exportOrdersBulkToExcel(orders, orderType, filters)` — 2 sheet (Thông tin tra cứu + Danh sách vật tư)
- `MOVEMENT_LABELS` — map enum → tiếng Việt

### exportWord.js (PizZip + DOMParser)
- `TEMPLATES` — 2 template .docx (`cap`, `banGiao`) trong assets local của ứng dụng
- `getSlipType(order)` — xác định loại theo partner_name
- `exportPhieuWord(order)` — điền & tải 1 phiếu
- `exportPhieuWordBulk(orders)` — gộp nhiều phiếu + page-break
- `getLogoUrl()` — trích logo từ template
- Helper nội bộ: fillDocument, rebuildSignatureTable, setParaFont (nén 13pt vừa 1 trang), pageBreakParagraph

### printSlip.js
- `printPhieu(order)`, `printPhieuBulk(orders)` — window.print

### exportBackup.js (XLSX)
- `exportBackup({products, orders, movements, dateMode, searchDate})` — 4 sheet (Thông tin, Kho hàng, Phiếu nhập xuất, Biến động kho)

## 8.2 Shared components (`src/components/`)
**layout/**
- `AppLayout` — Outlet wrap, Sidebar + NotificationBell + max-w-7xl
- `Sidebar` — nav theo role, mobile drawer, logout
- `NotificationBell` — badge thông báo góc phải

**shared/**
- `PageHeader` — tiêu đề + phụ đề + action slot
- `StatCard` — thẻ chỉ số (label, value, icon, color, subtitle)
- `StatusBadge` — badge Inbound/Outbound/movement_type
- `EmptyState` — icon + title + description + children

**inventory/**
- `ProductFormDialog` — modal thêm/sửa Product

**orders/**
- `OrderFormDialog` — modal tạo phiếu (chọn Product, qty, ghi chú)

**stats/**
- `MovementChart` — recharts xuất–nhập theo ngày
- `CashflowChart` — recharts chênh lệch dòng tiền

**Auth scaffold**
- `ProtectedRoute` — guard (fallback, unauthenticatedElement)
- `AuthContext` (lib) — useAuth (user, isLoadingAuth, navigateToLogin)
- `UserNotRegisteredError`, `ScrollToTop`

## 8.3 Gói npm đã cài (liên quan)
react, tailwindcss, shadcn/ui, lucide-react, moment, recharts, react-router-dom, xlsx, pizzip, date-fns, lodash, react-markdown, @tanstack/react-query, framer-motion.

## 8.4 Entry
- `src/App.jsx` — AuthProvider → QueryClientProvider → Router → AuthenticatedApp (loading/authError gating) → Routes
- `src/main.jsx` — mount #root
- `index.html` — head/title/meta (+ runtime script injection)
