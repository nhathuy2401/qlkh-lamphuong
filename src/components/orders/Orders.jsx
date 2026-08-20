import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { exportOrderDocx, printOrder } from '../../lib/documentExport'
import { Empty } from '../ui/Empty'
import { PageHeader } from '../ui/PageHeader'
import { DeleteOrderDialog } from './DeleteOrderDialog'
import { OrderCard } from './OrderCard'
import { OrderFilters } from './OrderFilters'
import { OrderForm } from './OrderForm'

export const Orders = observer(({ type, store }) => {
  const { data } = store
  const [filters, setFilters] = useState({ query: '', dateMode: 'all', date: '', from: '', to: '', customerId: '', product: '' })
  const [confirmId, setConfirmId] = useState(null)
  const [documentError, setDocumentError] = useState('')
  const exportDocument = async order => {
    try { setDocumentError(''); await exportOrderDocx(order) } catch (error) { setDocumentError(error.message || 'Không thể xuất file.') }
  }
  const printDocument = order => {
    try { setDocumentError(''); printOrder(order) } catch (error) { setDocumentError(error.message || 'Không thể mở bản in.') }
  }
  const orders = useMemo(() => data.orders.filter(order => {
    if (order.type !== type) return false
    const query = filters.query.toLowerCase().trim()
    const searchable = `${order.orderNumber} ${order.customerName} ${order.partnerName} ${order.items.map(item => `${item.productName} ${item.sku}`).join(' ')}`.toLowerCase()
    if (query && !searchable.includes(query)) return false
    if (filters.customerId && order.customerId !== filters.customerId) return false
    if (filters.product && !order.items.some(item => `${item.productName} ${item.sku}`.toLowerCase().includes(filters.product.toLowerCase().trim()))) return false
    if (filters.dateMode === 'date' && order.date !== filters.date) return false
    if (filters.dateMode === 'month' && !order.date.startsWith(filters.date)) return false
    if (filters.dateMode === 'year' && !order.date.startsWith(filters.date)) return false
    if (filters.dateMode === 'range' && ((filters.from && order.date < filters.from) || (filters.to && order.date > filters.to))) return false
    return true
  }), [data.orders, filters, type])
  return <><PageHeader eyebrow={type === 'Outbound' ? 'OUTBOUND' : 'INBOUND'} title={type === 'Outbound' ? 'Phiếu xuất kho' : 'Phiếu nhập kho'} description="Tìm kiếm nhanh và kiểm soát toàn bộ lịch sử phiếu." /><OrderFilters type={type} filters={filters} setFilters={setFilters} customers={data.customers} />{documentError && <div className="alert danger document-alert">{documentError}</div>}<div className="orders-layout"><OrderForm type={type} store={store} /><section className="panel"><div className="panel-heading"><div><h3>Kết quả tìm kiếm</h3><span>{orders.length} phiếu phù hợp</span></div></div>{orders.length ? <div className="order-cards">{orders.map(order => <OrderCard key={order.id} order={order} onDelete={setConfirmId} onExport={exportDocument} onPrint={printDocument} />)}</div> : <Empty title="Không có phiếu phù hợp" text="Thử điều chỉnh bộ lọc hoặc tạo phiếu mới." />}</section></div><DeleteOrderDialog open={Boolean(confirmId)} onCancel={() => setConfirmId(null)} onConfirm={() => { store.deleteOrder(confirmId); setConfirmId(null) }} /></>
})
