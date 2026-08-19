import { makeAutoObservable } from 'mobx'
import { DATA_KEY, isoToday, loadSession, saveSession, uid } from '../lib/utils'

const seedData = () => {
  const businessId = uid('business')
  const facilityId = uid('facility')
  const warehouseId = uid('warehouse')
  const products = [
    { id: uid('product'), name: 'Dầu thủy lực 46', sku: 'DTH-046', unit: 'Can', quantity: 42, reorderPoint: 10, unitPrice: 850000 },
    { id: uid('product'), name: 'Vòng bi 6205', sku: 'VB-6205', unit: 'Cái', quantity: 18, reorderPoint: 8, unitPrice: 120000 },
    { id: uid('product'), name: 'Găng tay bảo hộ', sku: 'GT-001', unit: 'Đôi', quantity: 120, reorderPoint: 30, unitPrice: 28000 },
  ]
  const customer = { id: uid('customer'), name: 'Khách hàng mẫu', code: 'KH-001', phone: '', address: '', status: 'Active' }
  const order = { id: uid('order'), orderNumber: 'PX-0001', type: 'Outbound', customerId: customer.id, customerName: customer.name, partnerName: '', date: isoToday(), notes: 'Phiếu mẫu có thể xóa.', items: [{ productId: products[0].id, productName: products[0].name, sku: products[0].sku, quantity: 3, unit: products[0].unit, unitPrice: products[0].unitPrice }] }
  return {
    businesses: [{ id: businessId, name: 'Doanh nghiệp mẫu', code: 'DN-001' }],
    facilities: [{ id: facilityId, businessId, name: 'Đơn vị mẫu' }],
    warehouses: [{ id: warehouseId, facilityId, name: 'Kho chính' }],
    customers: [customer], products, orders: [order],
    movements: [{ id: uid('movement'), orderId: order.id, productId: products[0].id, productName: products[0].name, type: 'Shipped', quantity: 3, unitPrice: products[0].unitPrice, date: order.date }],
    notifications: [], audit: [{ id: uid('audit'), action: 'Tạo phiếu xuất', detail: order.orderNumber, date: new Date().toISOString() }],
  }
}

const loadData = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(DATA_KEY))
    if (stored) return stored
  } catch { /* fallback below */ }
  const initial = seedData()
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
    this.update(data => ({ ...data, products: [...data.products, { ...form, id: uid('product'), quantity: Number(form.quantity), reorderPoint: Number(form.reorderPoint), unitPrice: Number(form.unitPrice) }] }))
  }
  removeProduct(id) { this.update(data => ({ ...data, products: data.products.filter(product => product.id !== id) })) }
  addCustomer(form) { const customer = { ...form, id: uid('customer'), status: 'Active' }; this.update(data => ({ ...data, customers: [...data.customers, customer] })); return customer }
  toggleCustomer(id) { this.update(data => ({ ...data, customers: data.customers.map(c => c.id === id ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' } : c) })) }

  createOrder({ type, form }) {
    const product = this.data.products.find(item => item.id === form.productId)
    const qty = Number(form.quantity)
    if (!product || qty <= 0 || (type === 'Outbound' && !form.customerId)) return { error: 'Vui lòng chọn đủ thông tin phiếu.' }
    if (type === 'Outbound' && qty > product.quantity) return { error: `Tồn hiện tại chỉ còn ${product.quantity} ${product.unit}.` }
    const customer = this.data.customers.find(item => item.id === form.customerId)
    const order = { id: uid('order'), orderNumber: form.orderNumber, type, customerId: type === 'Outbound' ? form.customerId : '', customerName: type === 'Outbound' ? customer?.name || '' : '', partnerName: type === 'Inbound' ? form.partnerName : '', date: form.date, notes: form.notes, items: [{ productId: product.id, productName: product.name, sku: product.sku, quantity: qty, unit: product.unit, unitPrice: product.unitPrice }] }
    this.update(data => ({
      ...data,
      products: data.products.map(item => item.id === product.id ? { ...item, quantity: item.quantity + (type === 'Inbound' ? qty : -qty) } : item),
      orders: [order, ...data.orders],
      movements: [{ id: uid('movement'), orderId: order.id, productId: product.id, productName: product.name, type: type === 'Inbound' ? 'Received' : 'Shipped', quantity: qty, unitPrice: product.unitPrice, date: order.date }, ...data.movements],
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

  addBusiness(name) { this.update(data => ({ ...data, businesses: [...data.businesses, { id: uid('business'), name, code: '' }] })) }
  addFacility(businessId, name) { this.update(data => ({ ...data, facilities: [...data.facilities, { id: uid('facility'), businessId, name }] })) }

  get lowStock() { return this.data.products.filter(product => product.quantity <= product.reorderPoint) }
  get stockValue() { return this.data.products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0) }
  get inboundQuantity() { return this.data.movements.filter(m => m.type === 'Received').reduce((sum, m) => sum + m.quantity, 0) }
  get outboundQuantity() { return this.data.movements.filter(m => m.type === 'Shipped').reduce((sum, m) => sum + m.quantity, 0) }
  get cashIn() { return this.data.movements.filter(m => m.type === 'Received').reduce((sum, m) => sum + m.quantity * m.unitPrice, 0) }
  get cashOut() { return this.data.movements.filter(m => m.type === 'Shipped').reduce((sum, m) => sum + m.quantity * m.unitPrice, 0) }
}

export const appStore = new AppStore()
