import { dateText } from '../../lib/utils'

export function MiniChart({ movements }) {
  const days = Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (13 - index)); return date.toISOString().slice(0, 10) })
  const values = days.map(date => movements.filter(movement => movement.date === date).reduce((sum, movement) => sum + (movement.type === 'Shipped' ? movement.quantity : -movement.quantity), 0))
  const max = Math.max(1, ...values.map(value => Math.abs(value)))
  return <div className="chart"><div className="bars">{values.map((value, index) => <div className="bar-wrap" key={days[index]} title={`${dateText(days[index])}: ${value}`}><div className={value >= 0 ? 'bar positive' : 'bar negative'} style={{ height: `${Math.max(5, Math.abs(value) / max * 76)}px` }} /></div>)}</div><div className="chart-labels"><span>14 ngày trước</span><span>Hôm nay</span></div></div>
}
