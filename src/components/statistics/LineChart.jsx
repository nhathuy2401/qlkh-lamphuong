import { dateText, money } from '../../lib/utils'

export function LineChart({ days, series, currency = false }) {
  const width = 760
  const height = 250
  const padding = { top: 16, right: 18, bottom: 34, left: 48 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const max = Math.max(1, ...series.flatMap(item => item.values))
  const x = index => padding.left + (days.length === 1 ? chartWidth / 2 : (index / (days.length - 1)) * chartWidth)
  const y = value => padding.top + chartHeight - (value / max) * chartHeight
  const valueText = value => currency ? money(value) : value.toLocaleString('vi-VN')
  const gridValues = [0, max / 2, max]

  return <div className="line-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ đường">
      {gridValues.map(value => <g key={value}><line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} className="chart-grid-line" /><text x={padding.left - 8} y={y(value) + 4} textAnchor="end" className="chart-axis-label">{currency ? `${Math.round(value / 1000000)}tr` : Math.round(value)}</text></g>)}
      {series.map(item => <g key={item.label}><polyline points={item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{item.values.map((value, index) => <circle key={`${item.label}-${days[index]}`} cx={x(index)} cy={y(value)} r="4" fill="white" stroke={item.color} strokeWidth="2"><title>{`${item.label} · ${dateText(days[index])}: ${valueText(value)}`}</title></circle>)}</g>)}
      {days.map((day, index) => (index === 0 || index === Math.floor(days.length / 2) || index === days.length - 1) && <text key={day} x={x(index)} y={height - 10} textAnchor="middle" className="chart-axis-label">{dateText(day)}</text>)}
    </svg>
    <div className="chart-legend">{series.map(item => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}</div>
  </div>
}
