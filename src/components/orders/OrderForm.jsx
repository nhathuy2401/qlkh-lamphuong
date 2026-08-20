import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { isoToday } from '../../lib/utils'
import { Icon } from '../ui/Icon'

const orderPrefix = type => type === 'Outbound' ? 'PX' : 'PN'

export const OrderForm = observer(({ type, store }) => {
  const { data } = store
  const [form, setForm] = useState({ orderNumber: `${orderPrefix(type)}-${String(data.orders.length + 1).padStart(4, '0')}`, date: isoToday(), customerId: data.customers.find(c => c.status !== 'Inactive')?.id || '', partnerName: '', notes: '' })
  const [items, setItems] = useState([])
  const [productQuery, setProductQuery] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [showCustomer, setShowCustomer] = useState(false)
  const [error, setError] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const activeCustomers = data.customers.filter(customer => customer.status !== 'Inactive')
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase()
    const matching = data.products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(query))
    return query ? matching.slice(0, 30) : matching.slice(0, 12)
  }, [data.products, productQuery])

  const addCustomer = () => {
    if (!newCustomerName.trim()) return
    const customer = store.addCustomer(newCustomerName)
    setForm(current => ({ ...current, customerId: customer.id }))
    setNewCustomerName('')
    setShowCustomer(false)
  }

  const addItem = () => {
    const quantity = Number(selectedQuantity)
    if (!selectedProductIds.length || quantity <= 0) return
    setItems(current => {
      return selectedProductIds.reduce((result, productId) => {
        const existing = result.find(item => item.productId === productId)
        return existing
          ? result.map(item => item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item)
          : [...result, { productId, quantity }]
      }, current)
    })
    setSelectedQuantity(1)
    setSelectedProductIds([])
    setError('')
  }

  const addOrder = event => {
    event.preventDefault()
    const result = store.createOrder({ type, form, items })
    if (result.error) return setError(result.error)
    setError('')
    setItems([])
    setProductQuery('')
    setSelectedProductIds([])
    setForm(current => ({ ...current, orderNumber: `${orderPrefix(type)}-${String(store.data.orders.length + 1).padStart(4, '0')}`, notes: '' }))
  }

  return <section className="panel order-form">
    <div className="panel-heading"><div><h3>{type === 'Outbound' ? 'Tạo phiếu xuất' : 'Tạo phiếu nhập'}</h3><span>Thêm nhiều vật tư trong cùng một phiếu</span></div></div>
    <form className="form-grid" onSubmit={addOrder}>
      <label>Số phiếu<input required value={form.orderNumber} onChange={e => setForm({ ...form, orderNumber: e.target.value })} /></label>
      <label>Ngày phiếu<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
      {type === 'Outbound' ? <label className="span-2">Khách hàng<div className="inline-control"><select required value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}><option value="">Chọn khách hàng</option>{activeCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><button type="button" className="button subtle" title="Thêm khách hàng" onClick={() => setShowCustomer(!showCustomer)}><Icon name="plus" /></button></div></label> : <label className="span-2">Nhà cung cấp / đối tác<input value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} placeholder="Tên đối tác (không bắt buộc)" /></label>}
      <div className="span-2 item-picker">
        <label>Tìm và chọn nhiều vật tư</label>
        <div className="search-box"><Icon name="search" /><input value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder="Gõ tên hoặc mã vật tư..." /></div>
        <div className="product-picker-list">{filteredProducts.map(product => { const selected = selectedProductIds.includes(product.id); return <button type="button" className={selected ? 'product-picker-row selected' : 'product-picker-row'} key={product.id} onClick={() => setSelectedProductIds(current => selected ? current.filter(id => id !== product.id) : [...current, product.id])}><span className="picker-check">{selected ? '✓' : '＋'}</span><span className="grow"><b>{product.name}</b><small>{product.sku} · tồn {product.quantity.toLocaleString('vi-VN')} {product.unit}</small></span><span>{selected ? 'Đã chọn' : 'Chọn'}</span></button>})}{!filteredProducts.length && <span className="picker-empty">Không tìm thấy vật tư.</span>}</div>
        {productQuery.trim() === '' && data.products.length > filteredProducts.length && <small className="picker-hint">Đang hiển thị {filteredProducts.length} vật tư đầu tiên — hãy gõ để tìm trong {data.products.length.toLocaleString('vi-VN')} vật tư.</small>}
        <div className="inline-control picker-add"><input type="number" min="1" value={selectedQuantity} onChange={e => setSelectedQuantity(e.target.value)} aria-label="Số lượng cho các vật tư đã chọn" /><button type="button" className="button subtle" disabled={!selectedProductIds.length} onClick={addItem}><Icon name="plus" /> Thêm {selectedProductIds.length || ''} vật tư</button></div>
      </div>
      <div className="span-2 selected-items"><div className="selected-items-heading"><b>Vật tư trong phiếu</b><span>{items.length} dòng</span></div>{items.length ? items.map(item => { const product = data.products.find(candidate => candidate.id === item.productId); return <div className="selected-item" key={item.productId}><div className="grow"><b>{product?.name || 'Vật tư không còn tồn tại'}</b><small>{product?.sku} · {product?.unit}</small></div><input type="number" min="1" value={item.quantity} onChange={e => setItems(current => current.map(line => line.productId === item.productId ? { ...line, quantity: e.target.value } : line))} /><button type="button" className="icon-button danger-hover" title="Bỏ vật tư" onClick={() => setItems(current => current.filter(line => line.productId !== item.productId))}><Icon name="trash" /></button></div> }) : <span className="picker-empty">Chưa có vật tư. Tìm và thêm ít nhất một dòng.</span>}</div>
      <label className="span-2">Ghi chú<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ghi chú chung" /></label>
      {error && <div className="alert danger span-2">{error}</div>}
      {showCustomer && type === 'Outbound' && <div className="quick-add span-2"><b>Thêm khách hàng nhanh</b><div className="inline-control"><input placeholder="Tên khách hàng" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} /><button type="button" className="button primary" onClick={addCustomer}>Lưu</button></div></div>}
      <button className="button primary span-2"><Icon name="plus" /> Lưu phiếu</button>
    </form>
  </section>
})
