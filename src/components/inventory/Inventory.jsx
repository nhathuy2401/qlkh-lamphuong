import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { money } from '../../lib/utils'
import { Empty } from '../ui/Empty'
import { Icon } from '../ui/Icon'
import { PageHeader } from '../ui/PageHeader'
import { ProductFormDialog } from './ProductFormDialog'
import { UnitField } from './UnitField'

const emptyProduct = { name: '', unit: 'cái', quantity: 0, unitPrice: 0, notes: '' }
const ITEMS_PER_PAGE = 50

export const Inventory = observer(({ store }) => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(emptyProduct)
  const [editingProduct, setEditingProduct] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const products = store.data.products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(products.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const visibleProducts = products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const add = async event => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await store.addProduct(form)
      setForm(emptyProduct)
      setError('')
    } catch (saveError) {
      setError(saveError.message || 'Không thể thêm vật tư.')
    } finally {
      setSaving(false)
    }
  }
  const remove = async id => {
    if (!confirm('Xóa vật tư này?')) return
    try { await store.removeProduct(id); setError('') } catch (removeError) { setError(removeError.message || 'Không thể xóa vật tư.') }
  }
  const saveProduct = async values => {
    try {
      await store.updateProduct(editingProduct.id, values)
      setEditingProduct(null)
      setError('')
    } catch (saveError) { setError(saveError.message || 'Không thể cập nhật vật tư.') }
  }

  return <>
    <PageHeader eyebrow="KHO VẬT TƯ" title="Danh mục vật tư" description="Theo dõi tồn kho và mức cảnh báo realtime." />{error && <div className="alert danger document-alert">{error}</div>}
    <div className="two-col">
      <section className="panel">
        <div className="panel-heading"><div><h3>Thêm vật tư</h3><span>Master data của kho</span></div></div>
        <form className="form-grid" onSubmit={add}>
          <label className="span-2">Tên vật tư<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Dầu nhớt" required /></label>
          <label>Đơn vị tính<UnitField value={form.unit} onChange={unit => setForm({ ...form, unit })} /></label>
          <label>Số lượng ban đầu<input type="number" min="0" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></label>
          <label>Đơn giá<input type="number" min="0" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice: event.target.value })} /></label>
          <label className="span-2">Ghi chú<input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Ghi chú về vật tư" /></label>
          <button disabled={saving} className="button primary span-2"><Icon name="plus" /> {saving ? 'Đang lưu…' : 'Thêm vật tư'}</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><h3>Danh sách vật tư</h3><span>{store.data.products.length.toLocaleString('vi-VN')} loại trong kho</span></div>
          <div className="search-box"><Icon name="search" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm tên vật tư" /></div>
        </div>
        <div className="table-wrap">
          <table><thead><tr><th>STT</th><th>Tên vật tư</th><th>DVT</th><th>Số lượng tồn</th><th>Đơn giá</th><th>Ghi chú</th><th /></tr></thead>
            <tbody>{visibleProducts.map((product, index) => <tr key={product.id}>
              <td>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td><td><b>{product.name}</b><small>{product.sku}</small></td><td>{product.unit}</td><td><b className={product.quantity <= product.reorderPoint ? 'danger-text' : ''}>{product.quantity.toLocaleString('vi-VN')}</b></td><td>{money(product.unitPrice)}</td><td>{product.notes || '—'}</td>
              <td><button className="icon-button" title="Cập nhật vật tư" onClick={() => setEditingProduct({ ...product })}><Icon name="settings" /></button><button className="icon-button danger-hover" title="Xóa vật tư" onClick={() => remove(product.id)}><Icon name="trash" /></button></td>
            </tr>)}</tbody>
          </table>
          {!products.length && <Empty title="Không tìm thấy vật tư" text="Thử từ khóa khác." />}
        </div>
        {products.length > 0 && <div className="pagination"><span>Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, products.length)} / {products.length.toLocaleString('vi-VN')}</span><div><button className="button subtle" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>← Trước</button><b>Trang {currentPage}/{totalPages}</b><button className="button subtle" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Sau →</button></div></div>}
      </section>
    </div>
    {editingProduct && <ProductFormDialog key={editingProduct.id} product={editingProduct} onCancel={() => setEditingProduct(null)} onSave={saveProduct} />}
  </>
})
