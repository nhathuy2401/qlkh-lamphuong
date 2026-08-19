
# Phân quyền & Bảo mật (RLS)

> Hạng mục 7/8

## 7.1 Ma trận RLS tổng hợp
Quy ước: `chủ` = người tạo bản ghi; QM = warehouse_manager; S = staff; U = user.

| Entity | Tạo | Sửa | Xóa | Đọc |
|---|---|---|---|---|
| Product | chủ,admin,QM,S,U | chủ,admin,QM,S,U | chủ,admin,QM | mở |
| Order | chủ,admin,QM,S,U | chủ,admin,QM,S,U | chủ,admin,QM | mở |
| StockMovement | chủ,admin,QM,S,U | chủ,admin,QM | chủ,admin,QM | mở |
| WarehouseLocation | chủ,admin,QM | chủ,admin,QM | chủ,admin,QM | mở |
| Notification | chủ,admin,QM,S | chủ,admin,QM,S | chủ,admin,QM | **chỉ role `user`** |

## 7.2 Giải thích
- **Tạo/Sửa rộng:** Product/Order/StockMovement cho phép mọi role (kể cả staff/user) → phù hợp luồng tạo phiếu hằng ngày.
- **Xóa chặt:** Xóa chỉ cho người tạo hoặc admin/QM → tránh nhân viên xoá phiếu/vật tư sai.
- **WarehouseLocation:** hẹp nhất — chỉ admin/QM (quản trị vị trí vật lý).
- **Notification đọc:** đặc thù hạn chế role `user` (cần xem lại nếu muốn thông báo cho mọi role).

## 7.3 Quyền ứng dụng (front-end)
`src/lib/permissions.js`:
- `ROLE_LABELS`: admin→Quản trị viên, warehouse_manager→Quản lý kho, staff/user→Nhân viên
- `ROLE_OPTIONS`: 3 lựa chọn cho select (admin / warehouse_manager / staff) — không cho set "user" trực tiếp
- `canApproveOrders(role)`: admin || warehouse_manager
- `canManageStaff(role)`: admin — điều khiển hiển thị 3 mục Sidebar (Staff/History/Backup) + quyền xem trang
- `isFullAccess(role)`: admin || warehouse_manager

## 7.4 User entity
- Built-in, chỉ tùy chỉnh `role`
- Không tạo/sửa trực tiếp record — thay đổi role qua StaffManagement (User.update)
- Thêm người qua **invite** (base44.users.inviteUser)

## 7.5 Auth flow bảo mật
- loginViaEmailPassword → hard redirect theo `returnTo` (mặc định `/`)
- loginWithProvider("google", fromUrl) — OAuth
- register → (chưa login) → verifyOtp → setToken → redirect (không loginViaEmailPassword sau register)
- resetPassword (token + new pass) → redirect /login
- Tất cả hard redirect (window.location.href)