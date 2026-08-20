import { makeAutoObservable } from 'mobx'
import { DATA_KEY, loadSession, saveSession, uid } from '../lib/utils'
import masterMaterials from '../data/materials.json'

const seedData = () => {
  const products = []
  return {
    customers: [], products, orders: [], movements: [], notifications: [], audit: [],
  }
}

const legacyProductSkus = ['DTH-046', 'VB-6205', 'GT-001']
const ensureMasterProducts = data => {
  const products = data.products || []
  const masterNames = new Set(masterMaterials.map(material => material.name))
  if (masterMaterials.every(material => products.some(product => product.name === material.name))) return data

  const legacyBySku = Object.fromEntries(products.filter(product => legacyProductSkus.includes(product.sku)).map(product => [product.sku, product]))
  const masterProducts = masterMaterials.map((material, index) => {
    const existing = products.find(product => product.name === material.name)
    const legacy = legacyBySku[legacyProductSkus[index]]
    return {
      ...material,
      id: existing?.id || legacy?.id || uid('product'),
      sku: existing?.sku || `VT-${String(index + 1).padStart(4, '0')}`,
      quantity: existing?.quantity ?? legacy?.quantity ?? 0,
      reorderPoint: existing?.reorderPoint ?? legacy?.reorderPoint ?? 10,
    }
  })
  const additionalProducts = products.filter(product => !masterNames.has(product.name) && !legacyProductSkus.includes(product.sku))
  return { ...data, products: [...masterProducts, ...additionalProducts] }
}

const loadData = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(DATA_KEY))
    if (stored) {
      const migrated = ensureMasterProducts(stored)
      localStorage.setItem(DATA_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch { /* fallback below */ }
  const initial = ensureMasterProducts(seedData())
  localStorage.setItem(DATA_KEY, JSON.stringify(initial))
  return initial
}

export class AppStore {
  data = loadData()
  session = loadSession()
  nav = 'dashboard'

  constructor() { makeAutoObservable(this) }

  setNav(value) { this.nav = value }
  login(value) { this.session = value; saveSession(value) }
  logout() { this.session = null; saveSession(null) }
  persist() { localStorage.setItem(DATA_KEY, JSON.stringify(this.data)) }
  update(mutator) { this.data = mutator(this.data); this.persist() }

  addProduct(form) {
    this.update(data => {
      let skuNumber = data.products.length + 1
      let sku = `VT-${String(skuNumber).padStart(3, '0')}`
      while (data.products.some(product => product.sku === sku)) {
        skuNumber += 1
        sku = `VT-${String(skuNumber).padStart(3, '0')}`
      }
      return {
        ...data,
        products: [...data.products, { ...form, id: uid('product'), sku, quantity: 0, reorderPoint: 10, unitPrice: Number(form.unitPrice), notes: form.notes?.trim() || '' }],
      }
    })
  }
  updateProduct(id, form) {
    this.update(data => ({
      ...data,
      products: data.products.map(product => product.id === id
        ? { ...product, name: form.name.trim(), unit: form.unit, unitPrice: Number(form.unitPrice), notes: form.notes?.trim() || '' }
        : product),
    }))
  }
  removeProduct(id) { this.update(data => ({ ...data, products: data.products.filter(product => product.id !== id) })) }
  addCustomer(form) {
    const name = typeof form === 'string' ? form : form.name
    const customer = { id: uid('customer'), name: name.trim(), status: 'Active' }
    this.update(data => ({ ...data, customers: [...(data.customers || []), customer] }))
    return customer
  }
  toggleCustomer(id) { this.update(data => ({ ...data, customers: data.customers.map(c => c.id === id ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' } : c) })) }

  createOrder({ type, form, items }) {
    const lines = (items || []).map(line => ({ product: this.data.products.find(item => item.id === line.productId), quantity: Number(line.quantity) })).filter(line => line.product && line.quantity > 0)
    if (!lines.length || (type === 'Outbound' && !form.customerId)) return { error: 'Vui lòng chọn khách hàng và ít nhất một vật tư hợp lệ.' }
    const invalidLine = lines.find(({ product, quantity }) => type === 'Outbound' && quantity > product.quantity)
    if (invalidLine) return { error: `${invalidLine.product.name}: tồn hiện tại chỉ còn ${invalidLine.product.quantity} ${invalidLine.product.unit}.` }
    const customer = this.data.customers.find(item => item.id === form.customerId)
    const order = { id: uid('order'), orderNumber: form.orderNumber, type, customerId: type === 'Outbound' ? form.customerId : '', customerName: type === 'Outbound' ? customer?.name || '' : '', partnerName: type === 'Inbound' ? form.partnerName : '', date: form.date, notes: form.notes, items: lines.map(({ product, quantity }) => ({ productId: product.id, productName: product.name, sku: product.sku, quantity, unit: product.unit, unitPrice: product.unitPrice })) }
    this.update(data => ({
      ...data,
      products: data.products.map(product => { const line = order.items.find(item => item.productId === product.id); return line ? { ...product, quantity: product.quantity + (type === 'Inbound' ? line.quantity : -line.quantity) } : product }),
      orders: [order, ...data.orders],
      movements: [...order.items.map(item => ({ id: uid('movement'), orderId: order.id, productId: item.productId, productName: item.productName, type: type === 'Inbound' ? 'Received' : 'Shipped', quantity: item.quantity, unitPrice: item.unitPrice, date: order.date })), ...data.movements],
      notifications: [{ id: uid('notification'), orderId: order.id, title: `Phiếu ${type === 'Inbound' ? 'nhập' : 'xuất'} mới`, message: order.orderNumber, date: new Date().toISOString() }, ...data.notifications],
      audit: [{ id: uid('audit'), action: `Tạo phiếu ${type === 'Inbound' ? 'nhập' : 'xuất'}`, detail: order.orderNumber, date: new Date().toISOString() }, ...data.audit],
    }))
    return { order }
  }

  deleteOrder(id) {
    const order = this.data.orders.find(item => item.id === id)
    if (!order) return
    this.update(data => ({
      ...data,
      products: data.products.map(product => { const item = order.items.find(line => line.productId === product.id); if (!item) return product; return { ...product, quantity: Math.max(0, product.quantity + (order.type === 'Inbound' ? -item.quantity : item.quantity)) } }),
      orders: data.orders.filter(item => item.id !== id),
      movements: data.movements.filter(item => item.orderId !== id),
      notifications: data.notifications.filter(item => item.orderId !== id),
      audit: [{ id: uid('audit'), action: 'Xóa phiếu', detail: `${order.orderNumber} — đã xóa dữ liệu liên quan`, date: new Date().toISOString() }, ...data.audit],
    }))
  }

  get lowStock() { return this.data.products.filter(product => product.quantity <= product.reorderPoint) }
  get stockValue() { return this.data.products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0) }
  get inboundQuantity() { return this.data.movements.filter(m => m.type === 'Received').reduce((sum, m) => sum + m.quantity, 0) }
  get outboundQuantity() { return this.data.movements.filter(m => m.type === 'Shipped').reduce((sum, m) => sum + m.quantity, 0) }
  get cashIn() { return this.data.movements.filter(m => m.type === 'Received').reduce((sum, m) => sum + m.quantity * m.unitPrice, 0) }
  get cashOut() { return this.data.movements.filter(m => m.type === 'Shipped').reduce((sum, m) => sum + m.quantity * m.unitPrice, 0) }
}

export const appStore = new AppStore()
