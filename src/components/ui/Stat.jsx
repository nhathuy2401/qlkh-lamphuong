export function Stat({ label, value, hint, tone = 'teal' }) {
  return <div className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>
}
