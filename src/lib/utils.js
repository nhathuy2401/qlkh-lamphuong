export const uid = (prefix) => `${prefix}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
export const isoToday = () => new Date().toISOString().slice(0, 10)
export const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0)
export const dateText = (value) => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`)) : '—'
