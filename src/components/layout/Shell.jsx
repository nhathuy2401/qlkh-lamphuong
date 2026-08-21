import { useState } from 'react'
import { navItems } from '../../lib/navigation'
import { Icon } from '../ui/Icon'

const roleLabels = {
  super_admin: 'Super admin',
  admin: 'Quản trị viên',
  warehouse_manager: 'Quản lý kho',
  staff: 'Nhân viên',
  user: 'Người dùng',
}

export function Shell({ nav, onNavigate, onLogout, children, session, connected, error }) {
  const [open, setOpen] = useState(false)
  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(session?.role))
  const current = navItems.find(item => item.id === nav)
  const displayName = session?.displayName || session?.email || 'Người dùng'
  const avatar = displayName.slice(0, 1).toUpperCase()
  return <div className="app-shell"><aside className={open ? 'sidebar open' : 'sidebar'}><div className="sidebar-top"><div className="logo">K</div><div><b>QLKH</b><span>Kho hàng Firebase</span></div><button className="icon-button mobile-only" onClick={() => setOpen(false)}><Icon name="close" /></button></div><nav>{visibleItems.map(item => <button key={item.id} className={nav === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { onNavigate(item.id); setOpen(false) }}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{avatar}</div><div><b>{displayName}</b><span>{roleLabels[session?.role] || session?.role}</span></div></div><button className="nav-item" onClick={onLogout}><Icon name="logout" /><span>Đăng xuất</span></button></div></aside><div className="main-area"><header className="topbar"><button className="icon-button mobile-only" onClick={() => setOpen(true)}><span className="hamburger">☰</span></button><div><span className="eyebrow">WORKSPACE</span><strong>{current?.label || 'Tổng quan'}</strong></div><div className="topbar-right"><span className="offline-pill"><i className={connected ? 'online' : 'offline'} /> {connected ? 'Online' : 'Offline'}</span><div className="avatar">{avatar}</div></div></header>{error && <div className="alert danger global-alert">{error}</div>}<main className="content">{children}</main></div></div>
}
