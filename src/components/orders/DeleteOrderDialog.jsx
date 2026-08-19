import { Icon } from '../ui/Icon'

export function DeleteOrderDialog({ open, onCancel, onConfirm }) {
  if (!open) return null
  return <div className="modal-backdrop"><div className="modal"><div className="modal-icon danger"><Icon name="trash" /></div><h3>Xóa toàn bộ phiếu?</h3><p>Thao tác này sẽ xóa phiếu, biến động kho và thông báo liên quan; đồng thời hoàn tác tồn kho để biểu đồ không còn thống kê phiếu này.</p><div className="modal-actions"><button className="button subtle" onClick={onCancel}>Hủy</button><button className="button danger" onClick={onConfirm}>Xóa phiếu</button></div></div></div>
}
