import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '../ui/PageHeader'
import { Icon } from '../ui/Icon'

const roles = ['admin', 'warehouse_manager', 'staff', 'user']

export const AccountManager = observer(({ store }) => {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', role: 'admin', disabled: false })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    store.fetchAccounts().catch(loadError => setError(loadError.message || 'Không thể tải tài khoản.'))
  }, [store])

  const submit = async event => {
    event.preventDefault(); setLoading(true); setError(''); setMessage('')
    try { await store.createAccount(form); setForm({ displayName: '', email: '', password: '', role: 'admin', disabled: false }); setMessage('Đã tạo tài khoản.') }
    catch (createError) { setError(createError.message || 'Không thể tạo tài khoản.') }
    finally { setLoading(false) }
  }

  const changeRole = async (account, role) => {
    try { await store.changeAccountRole(account.uid, role); setMessage(`Đã đổi role cho ${account.email}.`) }
    catch (changeError) { setError(changeError.message || 'Không thể đổi role.') }
  }

  const toggleDisabled = async account => {
    if (account.role === 'super_admin') return
    try { await store.setAccountDisabled(account.uid, !account.disabled); setMessage(account.disabled ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.') }
    catch (changeError) { setError(changeError.message || 'Không thể đổi trạng thái tài khoản.') }
  }

  return <>
    <PageHeader eyebrow="QUẢN TRỊ HỆ THỐNG" title="Quản lý tài khoản" description="Chỉ super admin được tạo tài khoản, đổi role và khóa/mở người dùng." />
    {(error || message) && <div className={error ? 'alert danger document-alert' : 'alert success document-alert'}>{error || message}</div>}
    <div className="two-col admin-layout">
      <section className="panel"><div className="panel-heading"><div><h3>Thêm tài khoản</h3><span>Tài khoản mới sẽ nhận role nghiệp vụ</span></div></div>
        <form className="form-grid" onSubmit={submit}><label className="span-2">Họ tên<input required value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></label><label className="span-2">Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Mật khẩu tạm<input required minLength="6" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label><label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(role => <option key={role} value={role}>{role}</option>)}</select></label><label className="check-field span-2"><input type="checkbox" checked={form.disabled} onChange={e => setForm({ ...form, disabled: e.target.checked })} /> Tạo ở trạng thái khóa</label><button disabled={loading} className="button primary span-2"><Icon name="plus" /> {loading ? 'Đang tạo…' : 'Tạo tài khoản'}</button></form>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Danh sách tài khoản</h3><span>{store.accounts.length} tài khoản</span></div></div><div className="table-wrap"><table><thead><tr><th>Người dùng</th><th>Role</th><th>Trạng thái</th><th /></tr></thead><tbody>{store.accounts.map(account => <tr key={account.uid}><td><b>{account.displayName || account.email}</b><small>{account.email}</small></td><td>{account.role === 'super_admin' ? <span className="badge purple">super_admin</span> : <select value={account.role} onChange={e => changeRole(account, e.target.value)}>{roles.map(role => <option key={role} value={role}>{role}</option>)}</select>}</td><td><span className={account.disabled ? 'badge gray' : 'badge green'}>{account.disabled ? 'Đã khóa' : 'Hoạt động'}</span></td><td>{account.role === 'super_admin' ? <span className="muted">Không thể khóa</span> : <button className="button subtle" onClick={() => toggleDisabled(account)}>{account.disabled ? 'Mở khóa' : 'Khóa'}</button>}</td></tr>)}</tbody></table></div></section>
    </div>
  </>
})
