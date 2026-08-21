import { useState } from 'react'
import { Icon } from '../ui/Icon'

export function ChangePassword({ store, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async event => {
    event.preventDefault(); setError(''); setMessage('')
    if (form.newPassword !== form.confirmPassword) { setError('Mật khẩu xác nhận chưa khớp.'); return }
    setSaving(true)
    try { await store.changePassword(form.currentPassword, form.newPassword); setMessage('Đã đổi mật khẩu thành công.'); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }) }
    catch (changeError) { setError(changeError.message || 'Không thể đổi mật khẩu.') }
    finally { setSaving(false) }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title"><div className="modal-icon"><Icon name="settings" /></div><h3 id="change-password-title">Đổi mật khẩu</h3><p>Mật khẩu mới cần có ít nhất 6 ký tự.</p><form className="form-grid" onSubmit={submit}><label className="span-2">Mật khẩu hiện tại<input autoFocus required type="password" value={form.currentPassword} onChange={event => setForm({ ...form, currentPassword: event.target.value })} /></label><label>Mật khẩu mới<input required minLength="6" type="password" value={form.newPassword} onChange={event => setForm({ ...form, newPassword: event.target.value })} /></label><label>Nhập lại mật khẩu<input required minLength="6" type="password" value={form.confirmPassword} onChange={event => setForm({ ...form, confirmPassword: event.target.value })} /></label>{error && <div className="alert danger span-2">{error}</div>}{message && <div className="alert success span-2">{message}</div>}<div className="modal-actions span-2"><button type="button" className="button subtle" onClick={onClose}>Đóng</button><button disabled={saving} className="button primary"><Icon name="settings" /> {saving ? 'Đang lưu…' : 'Đổi mật khẩu'}</button></div></form></div></div>
}
