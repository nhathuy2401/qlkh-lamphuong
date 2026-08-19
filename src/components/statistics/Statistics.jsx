import { observer } from 'mobx-react-lite'
import { money } from '../../lib/utils'
import { PageHeader } from '../ui/PageHeader'
import { Stat } from '../ui/Stat'
import { MiniChart } from './MiniChart'

export const Statistics = observer(({ store }) => {
  const { data } = store
  return <><PageHeader eyebrow="PHÂN TÍCH" title="Thống kê kho" description="Biểu đồ luôn lấy dữ liệu hiện tại sau mỗi lần thêm hoặc xóa phiếu." /><div className="stats-grid"><Stat label="Tổng nhập" value={store.inboundQuantity.toLocaleString('vi-VN')} hint="Số lượng" tone="green" /><Stat label="Tổng xuất" value={store.outboundQuantity.toLocaleString('vi-VN')} hint="Số lượng" tone="blue" /><Stat label="Tiền nhập" value={money(store.cashIn)} hint="Theo đơn giá snapshot" /><Stat label="Tiền xuất" value={money(store.cashOut)} hint="Theo đơn giá snapshot" tone="purple" /></div><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Xuất — nhập theo ngày</h3><span>14 ngày gần nhất · movement hợp lệ</span></div></div><MiniChart movements={data.movements} /></section><section className="panel"><div className="panel-heading"><div><h3>Kiểm tra dữ liệu</h3><span>Đảm bảo cascade xóa hoạt động</span></div></div><div className="check-list"><div><span>Phiếu đang lưu</span><b>{data.orders.length}</b></div><div><span>Biến động đang lưu</span><b>{data.movements.length}</b></div><div><span>Thông báo đang lưu</span><b>{data.notifications.length}</b></div><div><span>Log thao tác</span><b>{data.audit.length}</b></div></div></section></div></>
})
