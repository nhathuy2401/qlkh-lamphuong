import { makeAutoObservable, runInAction } from 'mobx'
import { firebaseConfigured } from '../lib/firebase'
import { callFunction, findUserByEmail, hashPassword, resetData, subscribeAudit, subscribeConnection, subscribeWarehouse } from '../services/firebaseData'
import { uid } from '../lib/utils'

const SESSION_KEY = 'qlkh-firestore-session-v1'

export class AppStore {
  data = resetData(); audit = []; accounts = []; session = null; nav = 'dashboard'; authReady = false; loading = false; connected = false; error = ''
  unsubscribeWarehouse = null; unsubscribeAudit = null; unsubscribeConnection = null

  constructor() { makeAutoObservable(this, { unsubscribeWarehouse: false, unsubscribeAudit: false, unsubscribeConnection: false }) }

  initializeAuth() {
    if (!firebaseConfigured) { this.authReady = true; this.error = 'Firestore chưa được cấu hình. Hãy tạo file .env.local từ .env.example.'; return () => {} }
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
      if (saved?.uid && !saved.disabled) { this.session = saved; this.startSync() }
    } catch { localStorage.removeItem(SESSION_KEY) }
    this.authReady = true
    return () => {}
  }

  startSync() {
    this.stopSync()
    this.unsubscribeWarehouse = subscribeWarehouse(value => { this.data = value }, error => { this.error = error.message || 'Không thể đọc dữ liệu Firestore.' })
    this.unsubscribeConnection = subscribeConnection(value => { this.connected = value }, () => { this.connected = false })
    if (this.isSuperAdmin) this.unsubscribeAudit = subscribeAudit(value => { this.audit = value }, error => { this.error = error.message || 'Không thể đọc lịch sử quản trị.' })
  }

  stopSync() { this.unsubscribeWarehouse?.(); this.unsubscribeAudit?.(); this.unsubscribeConnection?.(); this.unsubscribeWarehouse = null; this.unsubscribeAudit = null; this.unsubscribeConnection = null }
  setNav(value) { this.nav = value }

  async login({ email, password }) {
    if (!firebaseConfigured) throw new Error('Firestore chưa được cấu hình.')
    const user = await findUserByEmail(email); if (!user || user.passwordHash !== await hashPassword(password)) throw new Error('Email hoặc mật khẩu chưa đúng.')
    if (user.disabled) throw new Error('Tài khoản đã bị khóa.')
    this.session = { uid: user.id, email: user.email, displayName: user.displayName || user.email, role: user.role || 'user', disabled: false }
    localStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); this.error = ''; this.startSync()
  }

  async logout() { this.stopSync(); this.session = null; this.data = resetData(); this.audit = []; this.accounts = []; localStorage.removeItem(SESSION_KEY) }
  async changePassword(currentPassword, newPassword) { return callFunction('changePassword', { currentPassword, newPassword, requestId: uid('request') }, this.actor()) }
  get isSuperAdmin() { return this.session?.role === 'super_admin' }
  canCreateCustomer() { return this.isSuperAdmin }
  canAccessAdminPages() { return this.isSuperAdmin }
  actor() { return this.session }

  async addProduct(form) { return callFunction('createProduct', { ...form, requestId: uid('request') }, this.actor()) }
  async updateProduct(id, form) { return callFunction('updateProduct', { id, ...form, requestId: uid('request') }, this.actor()) }
  async removeProduct(id) { return callFunction('deleteProduct', { id, requestId: uid('request') }, this.actor()) }
  async addCustomer(form) { if (!this.canCreateCustomer()) throw new Error('Chỉ super admin được thêm khách hàng.'); return callFunction('createCustomer', { name: typeof form === 'string' ? form : form.name, requestId: uid('request') }, this.actor()) }
  async toggleCustomer(id, status = 'Inactive') { return callFunction('setCustomerStatus', { id, status, requestId: uid('request') }, this.actor()) }
  async createOrder({ type, form, items }) {
    const lines = (items || []).map(line => ({ productId: line.productId, quantity: Number(line.quantity) })).filter(line => line.productId && line.quantity > 0)
    if (!lines.length || (type === 'Outbound' && !form.customerId)) return { error: 'Vui lòng chọn khách hàng và ít nhất một vật tư hợp lệ.' }
    const customer = this.data.customers.find(item => item.id === form.customerId)
    return callFunction('createOrder', { type, form: { ...form, customerName: customer?.name || '' }, items: lines, requestId: uid('request') }, this.actor())
  }
  async deleteOrder(id) { return callFunction('deleteOrder', { id, requestId: uid('request') }, this.actor()) }
  async fetchAccounts() { if (!this.isSuperAdmin) throw new Error('Bạn không có quyền xem tài khoản.'); this.accounts = await callFunction('listAccounts', {}, this.actor()); return this.accounts }
  async createAccount(form) { const result = await callFunction('createAccount', { ...form, requestId: uid('request') }, this.actor()); await this.fetchAccounts(); return result }
  async changeAccountRole(uidValue, role) { const result = await callFunction('changeAccountRole', { uid: uidValue, role, requestId: uid('request') }, this.actor()); await this.fetchAccounts(); return result }
  async setAccountDisabled(uidValue, disabled) { const result = await callFunction('setAccountDisabled', { uid: uidValue, disabled, requestId: uid('request') }, this.actor()); await this.fetchAccounts(); return result }

  get lowStock() { return this.data.products.filter(product => product.quantity <= product.reorderPoint) }
  get stockValue() { return this.data.products.reduce((sum, product) => sum + product.quantity * product.unitPrice, 0) }
  get inboundQuantity() { return this.data.movements.filter(m => m.type === 'Received').reduce((sum, m) => sum + m.quantity, 0) }
  get outboundQuantity() { return this.data.movements.filter(m => m.type === 'Shipped').reduce((sum, m) => sum + m.quantity, 0) }
  get cashIn() { return this.data.movements.filter(m => m.type === 'Received').reduce((sum, m) => sum + m.quantity * m.unitPrice, 0) }
  get cashOut() { return this.data.movements.filter(m => m.type === 'Shipped').reduce((sum, m) => sum + m.quantity * m.unitPrice, 0) }
}

export const appStore = new AppStore()
