import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { isoToday } from '../../lib/utils'
import { Icon } from '../ui/Icon'

export const OrderForm = observer(({ type, store }) => {
  const { data } = store
  const [form, setForm] = useState({ orderNumber: `${type === 'Outbound' ? 'PX' : 'PN'}-${String(data.orders.length + 1).padStart(4, '0')}`, date: isoToday(), customerId: data.customers.find(c => c.status === 'Active')?.id || '', partnerName: '', notes: '', productId: data.products[0]?.id || '', quantity: 1 })
  const [showCustomer, setShowCustomer] = useState(false)
  const [error, setError] = useState('')
  const [newCustomer, setNewCustomer] = useState({ name: '', code: '' })
  const activeCustomers = data.customers.filter(customer => customer.status === 'Active')
  const addCustomer = () => { if (!newCustomer.name.trim()) return; const customer = store.addCustomer({ ...newCustomer, phone: '', address: '' }); setForm(current => ({ ...current, customerId: customer.id })); setNewCustomer({ name: '', code: '' }); setShowCustomer(false) }
  const addOrder = (event) => {
    event.preventDefault()
    const result = store.createOrder({ type, form })
    if (result.error) return setError(result.error)
    setError('')
    setForm(current => ({ ...current, orderNumber: `${type === 'Outbound' ? 'PX' : 'PN'}-${String(store.data.orders.length + 1).padStart(4, '0')}`, notes: '', quantity: 1 }))
  }
  return <section className="panel order-form"><div className="panel-heading"><div><h3>{type === 'Outbound' ? 'Tạo phiếu xuất' : 'Tạo phiếu nhập'}</h3><span>Thao tác được lưu trực tiếp trên thiết bị</span></div></div><form className="form-grid" onSubmit={addOrder}><label>Số phiếu<input required value={form.orderNumber} onChange={e => setForm({ ...form, orderNumber: e.target.value })} /></label><label>Ngày phiếu<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>{type === 'Outbound' ? <label className="span-2">Khách hàng<div className="inline-control"><select required value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}><option value="">Chọn khách hàng</option>{activeCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.code ? ` · ${customer.code}` : ''}</option>)}</select><button type="button" className="button subtle" onClick={() => setShowCustomer(!showCustomer)}><Icon name="plus" /></button></div></label> : <label className="span-2">Nhà cung cấp / đối tác<input value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} placeholder="Tên đối tác" /></label>}<label className="span-2">Vật tư<select value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}>{data.products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.sku} · tồn {product.quantity}</option>)}</select></label><label>Số lượng<input type="number" min="1" required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></label><label className="span-2">Ghi chú<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ghi chú chung" /></label>{error && <div className="alert danger span-2">{error}</div>}{showCustomer && <div className="quick-add span-2"><b>Thêm khách hàng nhanh</b><div className="inline-control"><input placeholder="Tên khách hàng" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} /><input placeholder="Mã KH" value={newCustomer.code} onChange={e => setNewCustomer({ ...newCustomer, code: e.target.value })} /><button type="button" className="button primary" onClick={addCustomer}>Lưu</button></div></div>}<button className="button primary span-2"><Icon name="plus" /> Lưu phiếu</button></form></section>
})
