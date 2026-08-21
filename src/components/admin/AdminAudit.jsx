import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { money } from '../../lib/utils'
import { PageHeader } from '../ui/PageHeader'
import { Empty } from '../ui/Empty'

const hiddenFields = new Set(['id', 'uid', 'createdAt', 'updatedAt', 'createdBy', 'requestId', 'passwordHash'])
const fieldLabels = {
  name: 'Tên', displayName: 'Họ tên', email: 'Email', role: 'Vai trò', disabled: 'Trạng thái khóa',
  quantity: 'Số lượng', reorderPoint: 'Mức cảnh báo', unit: 'Đơn vị tính', unitPrice: 'Đơn giá',
  sku: 'Mã vật tư', notes: 'Ghi chú', status: 'Trạng thái', orderNumber: 'Số phiếu', date: 'Ngày phiếu',
  type: 'Loại phiếu', customerName: 'Khách hàng', partnerName: 'Đối tác', items: 'Chi tiết vật tư',
}
const actionLabels = {
  createProduct: 'Thêm vật tư', updateProduct: 'Cập nhật vật tư', deleteProduct: 'Xóa vật tư',
  createCustomer: 'Thêm khách hàng', setCustomerStatus: 'Đổi trạng thái khách hàng', createOrder: 'Tạo phiếu',
  deleteOrder: 'Xóa phiếu', createAccount: 'Thêm tài khoản', changeAccountRole: 'Đổi vai trò tài khoản',
  setAccountDisabled: 'Đổi trạng thái tài khoản',
}
const dateText = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(value))) : '—'
const label = field => fieldLabels[field] || field

const formatValue = (field, value) => {
  if (value == null || value === '') return '—'
  if (field === 'unitPrice') return money(value)
  if (['quantity', 'reorderPoint'].includes(field) && typeof value === 'number') return value.toLocaleString('vi-VN')
  if (field === 'disabled') return value ? 'Đã khóa' : 'Hoạt động'
  if (field === 'items' && Array.isArray(value)) return value.map(item => `${item.productName || item.productId}: ${Number(item.quantity || 0).toLocaleString('vi-VN')} ${item.unit || ''}`.trim()).join(' · ')
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ')
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${label(key)}: ${formatValue(key, item)}`).join(' · ')
  return String(value)
}

const changeFields = log => {
  const fields = log.changedFields?.length ? log.changedFields : [...new Set([...Object.keys(log.before || {}), ...Object.keys(log.after || {})])]
  return fields.filter(field => !hiddenFields.has(field))
}

const Diff = ({ log }) => <div className="audit-diff-readable">{changeFields(log).map(field => <div className="audit-change" key={field}><strong>{label(field)}</strong><div><span className="audit-before">{formatValue(field, log.before?.[field])}</span><span className="audit-arrow">→</span><span className="audit-after">{formatValue(field, log.after?.[field])}</span></div></div>)}</div>

export const AdminAudit = observer(({ store }) => {
  const [actorRole, setActorRole] = useState('admin')
  const [action, setAction] = useState('')
  const [query, setQuery] = useState('')
  const logs = useMemo(() => store.audit.filter(log => {
    if (actorRole && log.actorRoleAtTime !== actorRole) return false
    if (action && log.action !== action) return false
    if (query && !`${log.actorName} ${log.actorEmail} ${log.targetLabel} ${log.action}`.toLowerCase().includes(query.toLowerCase().trim())) return false
    return true
  }), [store.audit, actorRole, action, query])
  const actions = [...new Set(store.audit.map(log => log.action).filter(Boolean))].sort()
  return <><PageHeader eyebrow="SUPER ADMIN" title="Lịch sử quản trị" description="Theo dõi tài khoản nào đã thêm, sửa hoặc xóa dữ liệu." /><div className="filters panel"><div className="filter-row"><div className="search-box large"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm người thao tác, đối tượng, action…" /></div><select value={actorRole} onChange={e => setActorRole(e.target.value)}><option value="">Tất cả role</option><option value="admin">admin</option><option value="warehouse_manager">warehouse_manager</option><option value="staff">staff</option><option value="user">user</option><option value="super_admin">super_admin</option></select><select value={action} onChange={e => setAction(e.target.value)}><option value="">Tất cả action</option>{actions.map(item => <option key={item} value={item}>{actionLabels[item] || item}</option>)}</select></div></div><section className="panel"><div className="panel-heading"><div><h3>Audit log</h3><span>{logs.length} bản ghi phù hợp</span></div></div>{logs.length ? <div className="audit-list">{logs.map(log => <details className="audit-row" key={log.id}><summary><div><b>{actionLabels[log.action] || log.action}</b><span>{log.targetLabel || log.targetId} · {log.actorName || log.actorEmail}</span></div><time>{dateText(log.createdAt)}</time></summary><div className="audit-detail"><p><b>Người thao tác:</b> {log.actorEmail} ({log.actorRoleAtTime})</p><p><b>Đối tượng:</b> {log.targetLabel || log.targetId}</p><strong>Chi tiết thay đổi</strong><Diff log={log} /></div></details>)}</div> : <Empty title="Chưa có lịch sử" text="Các thay đổi nghiệp vụ sẽ xuất hiện ở đây." />}</section></>
})
