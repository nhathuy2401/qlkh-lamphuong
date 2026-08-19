import { useState } from 'react'
import { Icon } from '../ui/Icon'

export function ProductFormDialog({ product, onCancel, onSave }) {
  const [form, setForm] = useState({
    name: product.name,
    unit: product.unit,
    unitPrice: product.unitPrice,
    notes: product.notes || '',
  })

  const update = (field, value) => setForm(current => ({ ...current, [field]: value }))
  const submit = event => {
    event.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}>
    <div className="modal" style={{ width: 'min(560px, 100%)' }} role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
      <div className="modal-icon"><Icon name="settings" /></div>
      <h3 id="edit-product-title">Cập nhật vật tư</h3>
      <p>Chỉnh sửa thông tin vật tư trong danh mục kho.</p>
      <form className="form-grid" onSubmit={submit}>
        <label className="span-2">Tên vật tư<input required value={form.name} onChange={event => update('name', event.target.value)} /></label>
        <label>DVT<input required value={form.unit} onChange={event => update('unit', event.target.value)} /></label>
        <label>Đơn giá<input type="number" min="0" value={form.unitPrice} onChange={event => update('unitPrice', event.target.value)} /></label>
        <label className="span-2">Ghi chú<input value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Ghi chú về vật tư" /></label>
        <div className="modal-actions span-2"><button type="button" className="button subtle" onClick={onCancel}>Hủy</button><button className="button primary"><Icon name="settings" /> Lưu thay đổi</button></div>
      </form>
    </div>
  </div>
}
