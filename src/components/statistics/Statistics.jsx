import { observer } from 'mobx-react-lite'
import { money } from '../../lib/utils'
import { PageHeader } from '../ui/PageHeader'
import { Stat } from '../ui/Stat'
import { LineChart } from './LineChart'

const recentDays = () => Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (13 - index)); return date.toISOString().slice(0, 10) })

export const Statistics = observer(({ store }) => {
  const { data } = store
  const days = recentDays()
  const orderCount = (type, day) => data.orders.filter(order => order.type === type && order.date === day).length
  const moneyTotal = (movementType, day) => data.movements.filter(movement => movement.type === movementType && movement.date === day).reduce((sum, movement) => sum + movement.quantity * movement.unitPrice, 0)
  const orderSeries = [{ label: 'Nhập kho', color: '#2c9a70', values: days.map(day => orderCount('Inbound', day)) }, { label: 'Xuất kho', color: '#3c72b8', values: days.map(day => orderCount('Outbound', day)) }]
  const cashSeries = [{ label: 'Tiền nhập', color: '#2c9a70', values: days.map(day => moneyTotal('Received', day)) }, { label: 'Tiền xuất', color: '#d36b60', values: days.map(day => moneyTotal('Shipped', day)) }]
  return <><PageHeader eyebrow="PHÂN TÍCH" title="Thống kê kho" description="Biểu đồ luôn lấy dữ liệu hiện tại sau mỗi lần thêm hoặc xóa phiếu." /><div className="stats-grid"><Stat label="Tổng nhập" value={store.inboundQuantity.toLocaleString('vi-VN')} hint="Số lượng" tone="green" /><Stat label="Tổng xuất" value={store.outboundQuantity.toLocaleString('vi-VN')} hint="Số lượng" tone="blue" /><Stat label="Tiền nhập" value={money(store.cashIn)} hint="Theo đơn giá snapshot" /><Stat label="Tiền xuất" value={money(store.cashOut)} hint="Theo đơn giá snapshot" tone="purple" /></div><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Số phiếu nhập — xuất</h3><span>14 ngày gần nhất · biểu đồ đường</span></div></div><LineChart days={days} series={orderSeries} /></section><section className="panel"><div className="panel-heading"><div><h3>Dòng tiền nhập — xuất</h3><span>14 ngày gần nhất · theo đơn giá tại thời điểm lập phiếu</span></div></div><LineChart days={days} series={cashSeries} currency /></section></div></>
})
