import { dateText } from '../../lib/utils'
import { Icon } from '../ui/Icon'

export function OrderCard({ order, onDelete, onExport, onPrint }) {
  return <div className="order-card"><div className="order-card-top"><div><span className="badge blue">{order.orderNumber}</span><h3>{order.customerName || order.partnerName || 'Không có đối tác'}</h3><span className="muted">{dateText(order.date)} · {order.items.length} dòng vật tư</span></div><button className="icon-button danger-hover" title="Xóa phiếu" onClick={() => onDelete(order.id)}><Icon name="trash" /></button></div><div className="chips">{order.items.map(item => <span className="chip" key={`${order.id}-${item.productId}`}>{item.productName} × {item.quantity}</span>)}</div>{order.notes && <p className="order-note">{order.notes}</p>}<div className="order-actions"><button className="button subtle" onClick={() => onExport(order)}>Xuất DOCX</button><button className="button subtle" onClick={() => onPrint(order)}>In phiếu</button></div></div>
}
