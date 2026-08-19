import { useState } from 'react'
import { navItems } from '../../lib/navigation'
import { Icon } from '../ui/Icon'

export function Shell({ nav, onNavigate, onLogout, children }) {
  const [open, setOpen] = useState(false)
  const current = navItems.find(item => item.id === nav)
  return <div className="app-shell"><aside className={open ? 'sidebar open' : 'sidebar'}><div className="sidebar-top"><div className="logo">K</div><div><b>QLKH</b><span>Kho hàng local</span></div><button className="icon-button mobile-only" onClick={() => setOpen(false)}><Icon name="close" /></button></div><nav>{navItems.map(item => <button key={item.id} className={nav === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { onNavigate(item.id); setOpen(false) }}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><div className="sidebar-bottom"><div className="user-mini"><div className="avatar">A</div><div><b>admin</b><span>Quản trị viên</span></div></div><button className="nav-item" onClick={onLogout}><Icon name="logout" /><span>Đăng xuất</span></button></div></aside><div className="main-area"><header className="topbar"><button className="icon-button mobile-only" onClick={() => setOpen(true)}><span className="hamburger">☰</span></button><div><span className="eyebrow">WORKSPACE</span><strong>{current?.label}</strong></div><div className="topbar-right"><span className="offline-pill"><i /> Local data</span><div className="avatar">A</div></div></header><main className="content">{children}</main></div></div>
}
