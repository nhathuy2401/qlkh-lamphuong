import { useState } from 'react'
import { Icon } from '../ui/Icon'

export function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    const username = form.username.trim().toLowerCase()
    const password = form.password.trim()
    if (username === 'admin' && password === 'admin') {
      setError('')
      onLogin({ username: 'admin', role: 'admin' })
    } else setError('Tài khoản hoặc mật khẩu chưa đúng. Dùng admin / admin.')
  }
  return <main className="login-page"><div className="login-card"><div className="brand-mark">K</div><p className="eyebrow">QLKH · LOCAL-FIRST PWA</p><h1>Quản lý kho, gọn hơn mỗi ngày.</h1><p className="muted">Dữ liệu lưu trên thiết bị. Bản thử nghiệm dùng tài khoản tạm.</p><form onSubmit={submit} className="stack"><label>Tài khoản<input autoFocus autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="admin" /></label><label>Mật khẩu<input type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="admin" /></label>{error && <div className="alert danger">{error}</div>}<button type="submit" className="button primary wide">Đăng nhập <Icon name="arrow" /></button></form><div className="demo-note">Tài khoản demo: <b>admin / admin</b></div></div></main>
}
