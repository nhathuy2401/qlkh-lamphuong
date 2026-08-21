export const navItems = [
  { id: 'dashboard', label: 'Tổng quan', icon: 'grid' },
  { id: 'inventory', label: 'Kho vật tư', icon: 'box' },
  { id: 'outbound', label: 'Xuất kho', icon: 'arrow' },
  { id: 'inbound', label: 'Nhập kho', icon: 'arrow' },
  { id: 'statistics', label: 'Thống kê', icon: 'chart' },
  { id: 'customers', label: 'Khách hàng', icon: 'users' },
  { id: 'accounts', label: 'Quản lý tài khoản', icon: 'users', roles: ['super_admin'] },
  { id: 'admin-audit', label: 'Lịch sử quản trị', icon: 'chart', roles: ['super_admin'] },
]
