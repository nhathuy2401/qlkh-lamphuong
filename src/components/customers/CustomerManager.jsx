import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '../ui/PageHeader'
import { Icon } from '../ui/Icon'

export const CustomerManager = observer(({ store }) => {
  const [name, setName] = useState('')
  const add = async event => { event.preventDefault(); if (!name.trim()) return; try { await store.addCustomer(name); setName('') } catch (error) { setError(error.message || 'Không thể thêm khách hàng.') } }
  const [error, setError] = useState('')
  return <><PageHeader eyebrow="DANH MỤC" title="Khách hàng" description="Danh sách dùng trong phiếu xuất và bộ lọc realtime." />{error && <div className="alert danger document-alert">{error}</div>}<div className="two-col">{store.canCreateCustomer() ? <section className="panel"><div className="panel-heading"><div><h3>Thêm khách hàng</h3><span>Chỉ super admin được thêm mới</span></div></div><form className="form-grid" onSubmit={add}><label className="span-2">Tên khách hàng<input required value={name} onChange={e => setName(e.target.value)} placeholder="Công ty / đơn vị nhận hàng" /></label><button className="button primary span-2"><Icon name="plus" /> Lưu khách hàng</button></form></section> : <section className="panel"><div className="panel-heading"><div><h3>Danh sách dùng chung</h3><span>Bạn có thể chọn khách hàng đã có khi lập phiếu. Liên hệ super admin nếu cần thêm mới.</span></div></div></section>}<section className="panel"><div className="panel-heading"><div><h3>Danh sách khách hàng</h3><span>{store.data.customers.length} khách hàng</span></div></div><div className="customer-list">{store.data.customers.map(customer => <div className="customer-row" key={customer.id}><div className="avatar soft">{customer.name.slice(0, 1).toUpperCase()}</div><div className="grow"><b>{customer.name}</b><span>{customer.status === 'Inactive' ? 'Đã ngừng dùng' : 'Khách hàng'}</span></div></div>)}</div></section></div></>
})
