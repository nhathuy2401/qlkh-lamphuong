export function Empty({ title, text }) {
  return <div className="empty"><div className="empty-icon">◌</div><b>{title}</b><span>{text}</span></div>
}
