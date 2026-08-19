export const DATA_KEY = 'qlkh-local-data-v1'
export const SESSION_KEY = 'qlkh-local-session-v1'

export const uid = (prefix) => `${prefix}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
export const isoToday = () => new Date().toISOString().slice(0, 10)
export const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0)
export const dateText = (value) => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`)) : '—'

export const loadSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null } catch { return null }
}

export const saveSession = (session) => {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}
