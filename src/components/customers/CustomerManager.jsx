import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '../ui/PageHeader'
import { Icon } from '../ui/Icon'

export const CustomerManager = observer(({ store }) => {
  const [name, setName] = useState('')
  const add = (event) => { event.preventDefault(); if (!name.trim()) return; store.addCustomer(name); setName('') }
  return <><PageHeader eyebrow="DANH MỤC" title="Khách hàng" description="Chỉ cần lưu tên khách hàng để dùng trong phiếu xuất và bộ lọc." /><div className="two-col"><section className="panel"><div className="panel-heading"><div><h3>Thêm khách hàng</h3><span>Không có danh sách cố định</span></div></div><form className="form-grid" onSubmit={add}><label className="span-2">Tên khách hàng<input required value={name} onChange={e => setName(e.target.value)} placeholder="Công ty / đơn vị nhận hàng" /></label><button className="button primary span-2"><Icon name="plus" /> Lưu khách hàng</button></form></section><section className="panel"><div className="panel-heading"><div><h3>Danh sách khách hàng</h3><span>Thêm xong có thể lọc phiếu ngay</span></div></div><div className="customer-list">{store.data.customers.map(customer => <div className="customer-row" key={customer.id}><div className="avatar soft">{customer.name.slice(0, 1).toUpperCase()}</div><div className="grow"><b>{customer.name}</b><span>Khách hàng</span></div></div>)}</div></section></div></>
})
