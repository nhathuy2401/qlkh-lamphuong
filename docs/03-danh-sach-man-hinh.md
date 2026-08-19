
## A. Trang xác thực (public)
| # | Tên (file) | Route | Chức năng |
|---|---|---|---|
| 1 | Login (`@/pages/Login`) | `/login` | Đăng nhập email+pass, Google OAuth, link quên mật khẩu |
| 2 | Register (`@/pages/Register`) | `/register` | Đăng ký → OTP → verifyOtp → đăng nhập |
| 3 | ForgotPassword (`@/pages/ForgotPassword`) | `/forgot-password` | Gửi yêu cầu đặt lại mật khẩu (generic success) |
| 4 | ResetPassword (`@/pages/ResetPassword`) | `/reset-password?token=` | Nhập mật khẩu mới từ token |

## B. Trang ứng dụng (ProtectedRoute + AppLayout)
| # | Tên (file) | Route | Chức năng tóm tắt |
|---|---|---|---|
| 5 | Dashboard (`@/pages/Dashboard`) | `/` | Tổng quan, 4 thẻ chỉ số + bảng cảnh báo + activity feed |
| 6 | Inventory (`@/pages/Inventory`) | `/inventory` | Bảng vật tư, tìm kiếm, thêm/sửa/xóa |
| 7 | Orders — Inbound (`@/pages/Orders`) | `/orders/inbound` | Phiếu nhập kho (type="Inbound") |
| 8 | Orders — Outbound (`@/pages/Orders`) | `/orders/outbound` | Phiếu xuất kho (type="Outbound") |
| 9 | Statistics (`@/pages/Statistics`) | `/statistics` | Biểu đồ xuất/nhập + dòng tiền + tra cứu |
| 10 | StaffManagement (`@/pages/StaffManagement`) | `/staff` | Quản lý nhân viên & đổi role (admin) |
| 11 | History (`@/pages/History`) | `/history` | Lịch sử hoạt động người dùng (admin) |
| 12 | Backup (`@/pages/Backup`) | `/backup` | Xuất dữ liệu sao lưu Excel (admin) |
| — | PageNotFound (`@/lib/PageNotFound`) | `*` | 404 |

## Layout dùng chung
`AppLayout` (`@/components/layout/AppLayout`):
- Sidebar trái (desktop, w-60 sticky) / drawer (mobile, hamburger)
- `NotificationBell` góc trên phải
- Nội dung giới hạn `max-w-7xl mx-auto`, padding `lg:p-8 p-4 pt-16 lg:pt-8`
- Background `bg-slate-50/50`

## Sidebar items (theo role)
| Mục | Route | Ai thấy |
|---|---|---|
| Tổng quan | `/` | Tất cả |
| Kho hàng | `/inventory` | Tất cả |
| Nhập kho | `/orders/inbound` | Tất cả |
| Xuất kho | `/orders/outbound` | Tất cả |
| Thống kê | `/statistics` | Tất cả |
| Quản lý nhân viên | `/staff` | chỉ admin |
| Lịch sử | `/history` | chỉ admin |
| Sao lưu | `/backup` | chỉ admin |
| Đăng xuất | (logout → /login) | Tất cả |