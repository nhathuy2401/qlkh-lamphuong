import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { money } from '../../lib/utils'
import { Empty } from '../ui/Empty'
import { Icon } from '../ui/Icon'
import { PageHeader } from '../ui/PageHeader'
import { ProductFormDialog } from './ProductFormDialog'

const emptyProduct = { name: '', unit: 'cái', unitPrice: 0, notes: '' }

export const Inventory = observer(({ store }) => {
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyProduct)
  const [editingProduct, setEditingProduct] = useState(null)
  const products = store.data.products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase()))

  const add = event => {
    event.preventDefault()
    if (!form.name.trim()) return
    store.addProduct(form)
    setForm(emptyProduct)
  }
  const remove = id => { if (confirm('Xóa vật tư này?')) store.removeProduct(id) }
  const saveProduct = values => {
    store.updateProduct(editingProduct.id, values)
    setEditingProduct(null)
  }

  return <>
    <PageHeader eyebrow="KHO VẬT TƯ" title="Danh mục vật tư" description="Theo dõi tồn kho và mức cảnh báo ngay trên thiết bị." />
    <div className="two-col">
      <section className="panel">
        <div className="panel-heading"><div><h3>Thêm vật tư</h3><span>Master data của kho</span></div></div>
        <form className="form-grid" onSubmit={add}>
          <label className="span-2">Tên vật tư<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Dầu nhớt" required /></label>
          <label>DVT<input value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} placeholder="Ví dụ: cái, kg, bộ" required /></label>
          <label>Đơn giá<input type="number" min="0" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice: event.target.value })} /></label>
          <label className="span-2">Ghi chú<input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Ghi chú về vật tư" /></label>
          <button className="button primary span-2"><Icon name="plus" /> Thêm vật tư</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><h3>Danh sách vật tư</h3><span>{store.data.products.length} loại trong kho</span></div>
          <div className="search-box"><Icon name="search" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm tên vật tư" /></div>
        </div>
        <div className="table-wrap">
          <table><thead><tr><th>STT</th><th>Tên vật tư</th><th>DVT</th><th>Số lượng tồn</th><th>Đơn giá</th><th>Ghi chú</th><th /></tr></thead>
            <tbody>{products.map((product, index) => <tr key={product.id}>
              <td>{index + 1}</td><td><b>{product.name}</b><small>{product.sku}</small></td><td>{product.unit}</td><td><b className={product.quantity <= product.reorderPoint ? 'danger-text' : ''}>{product.quantity.toLocaleString('vi-VN')}</b></td><td>{money(product.unitPrice)}</td><td>{product.notes || '—'}</td>
              <td><button className="icon-button" title="Cập nhật vật tư" onClick={() => setEditingProduct({ ...product })}><Icon name="settings" /></button><button className="icon-button danger-hover" title="Xóa vật tư" onClick={() => remove(product.id)}><Icon name="trash" /></button></td>
            </tr>)}</tbody>
          </table>
          {!products.length && <Empty title="Không tìm thấy vật tư" text="Thử từ khóa khác." />}
        </div>
      </section>
    </div>
    {editingProduct && <ProductFormDialog key={editingProduct.id} product={editingProduct} onCancel={() => setEditingProduct(null)} onSave={saveProduct} />}
  </>
})
