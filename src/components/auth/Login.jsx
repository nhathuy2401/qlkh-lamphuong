import { useState } from 'react'
import { firebaseConfigured } from '../../lib/firebase'
import { Icon } from '../ui/Icon'

export function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(form)
    } catch (loginError) {
      const messages = {
        'auth/invalid-credential': 'Email hoặc mật khẩu chưa đúng.',
        'auth/user-disabled': 'Tài khoản đã bị khóa.',
        'auth/too-many-requests': 'Có quá nhiều lần thử. Vui lòng thử lại sau.',
      }
      setError(messages[loginError.code] || loginError.message || 'Không thể đăng nhập.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="login-page"><div className="login-card"><div className="brand-mark">K</div><p className="eyebrow">QLKH · FIRESTORE</p><h1>Quản lý kho, gọn hơn mỗi ngày.</h1><p className="muted">Đăng nhập để sử dụng dữ liệu kho được đồng bộ trên các thiết bị.</p>{!firebaseConfigured && <div className="alert danger">Chưa cấu hình Firestore. Tạo `.env.local` từ `.env.example` trước khi chạy.</div>}<form onSubmit={submit} className="stack"><label>Email<input autoFocus autoComplete="username" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@qlkh.local" /></label><label>Mật khẩu<input type="password" autoComplete="current-password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mật khẩu" /></label>{error && <div className="alert danger">{error}</div>}<button disabled={loading || !firebaseConfigured} type="submit" className="button primary wide">{loading ? 'Đang đăng nhập…' : 'Đăng nhập'} <Icon name="arrow" /></button></form></div></main>
}
