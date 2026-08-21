const admin = require('firebase-admin')
const { setGlobalOptions } = require('firebase-functions/v2')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onValueCreated } = require('firebase-functions/v2/database')

const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'project-ad668'
admin.initializeApp({
  databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
})

const db = admin.database()
const auth = admin.auth()
const REGION = process.env.FUNCTIONS_REGION || 'asia-southeast1'
const WAREHOUSE_PATH = 'warehouses/default'
const ROLES = ['super_admin', 'admin', 'warehouse_manager', 'staff', 'user']
const ACCOUNT_ROLES = ['admin', 'warehouse_manager', 'staff', 'user']

setGlobalOptions({ region: REGION, maxInstances: 10 })

const numberValue = value => Number.isFinite(Number(value)) ? Number(value) : 0
const textValue = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback
const now = () => admin.database.ServerValue.TIMESTAMP

function requestIdOf(data) {
  return textValue(data?.requestId) || db.ref('operations').push().key
}

function contextOf(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập.')
  return {
    uid: request.auth.uid,
    email: request.auth.token.email || '',
    name: request.auth.token.name || request.auth.token.email || 'Người dùng',
    role: request.auth.token.role || 'user',
  }
}

function requireSuperAdmin(request) {
  const context = contextOf(request)
  if (context.role !== 'super_admin') throw new HttpsError('permission-denied', 'Chỉ super admin được thực hiện thao tác này.')
  return context
}

async function valueAt(path) {
  const snapshot = await db.ref(path).once('value')
  return snapshot.val()
}

async function beginOperation(requestId, context) {
  const operationRef = db.ref(`operations/${requestId}`)
  const result = await operationRef.transaction(current => current || {
    status: 'processing',
    actorUid: context.uid,
    createdAt: Date.now(),
  })
  const current = result.snapshot.val()
  if (!result.committed) {
    if (current?.status === 'completed') return { replay: true, result: current.result || {} }
    throw new HttpsError('already-exists', 'Yêu cầu đang được xử lý hoặc đã tồn tại.')
  }
  return { replay: false, result: null }
}

function completeOperation(updates, requestId, result) {
  updates[`operations/${requestId}`] = {
    status: 'completed',
    result,
    completedAt: now(),
  }
}

function auditUpdate(context, requestId, action, targetType, targetId, targetLabel, before, after, changedFields = []) {
  const auditId = db.ref('auditOutbox').push().key
  return {
    [`auditOutbox/${auditId}`]: {
      id: auditId,
      requestId,
      action,
      actorUid: context.uid,
      actorEmail: context.email,
      actorName: context.name,
      actorRoleAtTime: context.role,
      targetType,
      targetId,
      targetLabel,
      changedFields,
      before: before || null,
      after: after || null,
      metadata: { source: 'web', warehouseId: 'default' },
      createdAt: now(),
    },
  }
}

function safeProduct(product, quantity) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    unit: product.unit,
    quantity: numberValue(quantity ?? product.quantity),
    reorderPoint: numberValue(product.reorderPoint ?? 10),
    unitPrice: numberValue(product.unitPrice),
    notes: product.notes || '',
  }
}

function changedFields(before, after, fields) {
  return fields.filter(field => JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field]))
}

async function warehouseSnapshot() {
  return (await valueAt(WAREHOUSE_PATH)) || {}
}

exports.createProduct = onCall(async request => {
  const context = contextOf(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const warehouse = await warehouseSnapshot()
  const products = warehouse.products || {}
  const name = textValue(data.name)
  if (!name) throw new HttpsError('invalid-argument', 'Tên vật tư không được để trống.')
  const productId = db.ref(`${WAREHOUSE_PATH}/products`).push().key
  let skuNumber = Object.keys(products).length + 1
  let sku = `VT-${String(skuNumber).padStart(4, '0')}`
  const existingSkus = new Set(Object.values(products).map(product => product.sku))
  while (existingSkus.has(sku)) sku = `VT-${String(++skuNumber).padStart(4, '0')}`
  const product = {
    id: productId,
    sku,
    name,
    unit: textValue(data.unit, 'cái'),
    reorderPoint: Math.max(0, numberValue(data.reorderPoint ?? 10)),
    unitPrice: Math.max(0, numberValue(data.unitPrice)),
    notes: textValue(data.notes),
    status: 'active',
    createdAt: now(),
    createdBy: context.uid,
    updatedAt: now(),
    updatedBy: context.uid,
    version: 1,
  }
  const quantity = Math.max(0, numberValue(data.quantity))
  const updates = {
    [`${WAREHOUSE_PATH}/products/${productId}`]: product,
    [`${WAREHOUSE_PATH}/inventoryBalances/${productId}`]: { quantity, updatedAt: now(), updatedBy: context.uid, version: 1 },
  }
  Object.assign(updates, auditUpdate(context, requestId, 'PRODUCT_CREATED', 'product', productId, `${sku} - ${name}`, null, safeProduct(product, quantity), Object.keys(product)))
  const result = { id: productId }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.updateProduct = onCall(async request => {
  const context = contextOf(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const warehouse = await warehouseSnapshot()
  const current = warehouse.products?.[data.id]
  if (!current) throw new HttpsError('not-found', 'Không tìm thấy vật tư.')
  const oldQuantity = numberValue(warehouse.inventoryBalances?.[data.id]?.quantity ?? current.quantity)
  const after = {
    ...current,
    name: textValue(data.name, current.name),
    unit: textValue(data.unit, current.unit),
    unitPrice: Math.max(0, numberValue(data.unitPrice)),
    notes: textValue(data.notes),
    updatedAt: now(),
    updatedBy: context.uid,
    version: numberValue(current.version || 0) + 1,
  }
  if (!after.name) throw new HttpsError('invalid-argument', 'Tên vật tư không được để trống.')
  const quantity = Math.max(0, numberValue(data.quantity))
  const updates = {
    [`${WAREHOUSE_PATH}/products/${data.id}`]: after,
    [`${WAREHOUSE_PATH}/inventoryBalances/${data.id}`]: { quantity, updatedAt: now(), updatedBy: context.uid, version: numberValue(warehouse.inventoryBalances?.[data.id]?.version || 0) + 1 },
  }
  const beforeSafe = safeProduct({ ...current, id: data.id }, oldQuantity)
  const afterSafe = safeProduct({ ...after, id: data.id }, quantity)
  Object.assign(updates, auditUpdate(context, requestId, 'PRODUCT_UPDATED', 'product', data.id, `${current.sku} - ${current.name}`, beforeSafe, afterSafe, changedFields(beforeSafe, afterSafe, ['name', 'unit', 'quantity', 'reorderPoint', 'unitPrice', 'notes'])))
  const result = { id: data.id }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.deleteProduct = onCall(async request => {
  const context = contextOf(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const warehouse = await warehouseSnapshot()
  const current = warehouse.products?.[data.id]
  if (!current) throw new HttpsError('not-found', 'Không tìm thấy vật tư.')
  const orderItems = warehouse.orderItems || {}
  const referenced = Object.values(orderItems).some(items => Object.values(items || {}).some(item => item.productId === data.id))
  if (referenced) throw new HttpsError('failed-precondition', 'Không thể xóa vật tư đã phát sinh trong phiếu.')
  const updates = {
    [`${WAREHOUSE_PATH}/products/${data.id}`]: null,
    [`${WAREHOUSE_PATH}/inventoryBalances/${data.id}`]: null,
  }
  Object.assign(updates, auditUpdate(context, requestId, 'PRODUCT_DELETED', 'product', data.id, `${current.sku} - ${current.name}`, safeProduct({ ...current, id: data.id }, warehouse.inventoryBalances?.[data.id]?.quantity), null, ['product']))
  const result = { id: data.id }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.createCustomer = onCall(async request => {
  const context = requireSuperAdmin(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const name = textValue(data.name)
  if (!name) throw new HttpsError('invalid-argument', 'Tên khách hàng không được để trống.')
  const warehouse = await warehouseSnapshot()
  const duplicate = Object.values(warehouse.customers || {}).some(customer => customer.name?.trim().toLowerCase() === name.toLowerCase())
  if (duplicate) throw new HttpsError('already-exists', 'Khách hàng đã tồn tại.')
  const id = db.ref(`${WAREHOUSE_PATH}/customers`).push().key
  const customer = { id, name, status: 'Active', createdAt: now(), createdBy: context.uid, updatedAt: now(), updatedBy: context.uid }
  const updates = { [`${WAREHOUSE_PATH}/customers/${id}`]: customer }
  Object.assign(updates, auditUpdate(context, requestId, 'CUSTOMER_CREATED', 'customer', id, name, null, customer, ['name', 'status']))
  const result = { id, name }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.updateCustomer = onCall(async request => {
  const context = contextOf(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const warehouse = await warehouseSnapshot()
  const current = warehouse.customers?.[data.id]
  if (!current) throw new HttpsError('not-found', 'Không tìm thấy khách hàng.')
  const after = { ...current, name: textValue(data.name, current.name), updatedAt: now(), updatedBy: context.uid }
  if (!after.name) throw new HttpsError('invalid-argument', 'Tên khách hàng không được để trống.')
  const updates = { [`${WAREHOUSE_PATH}/customers/${data.id}`]: after }
  Object.assign(updates, auditUpdate(context, requestId, 'CUSTOMER_UPDATED', 'customer', data.id, current.name, { name: current.name }, { name: after.name }, ['name']))
  const result = { id: data.id }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.setCustomerStatus = onCall(async request => {
  const context = contextOf(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const warehouse = await warehouseSnapshot()
  const current = warehouse.customers?.[data.id]
  if (!current) throw new HttpsError('not-found', 'Không tìm thấy khách hàng.')
  const status = data.status === 'Inactive' ? 'Inactive' : 'Active'
  const after = { ...current, status, updatedAt: now(), updatedBy: context.uid }
  const updates = { [`${WAREHOUSE_PATH}/customers/${data.id}`]: after }
  Object.assign(updates, auditUpdate(context, requestId, 'CUSTOMER_STATUS_CHANGED', 'customer', data.id, current.name, { status: current.status }, { status }, ['status']))
  const result = { id: data.id, status }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.createOrder = onCall(async request => {
  const context = contextOf(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const type = data.type === 'Inbound' ? 'Inbound' : data.type === 'Outbound' ? 'Outbound' : null
  if (!type) throw new HttpsError('invalid-argument', 'Loại phiếu không hợp lệ.')
  const form = data.form || {}
  const warehouse = await warehouseSnapshot()
  const products = warehouse.products || {}
  const customers = warehouse.customers || {}
  const requestedOrderNumber = textValue(form.orderNumber)
  if (requestedOrderNumber && Object.values(warehouse.orders || {}).some(order => order.orderNumber === requestedOrderNumber)) throw new HttpsError('already-exists', 'Số phiếu đã tồn tại, vui lòng dùng số khác.')
  const lines = (data.items || []).map(line => ({ productId: textValue(line.productId), quantity: numberValue(line.quantity) })).filter(line => line.productId && line.quantity > 0)
  if (!lines.length) throw new HttpsError('invalid-argument', 'Phiếu phải có ít nhất một vật tư.')
  const missingProduct = lines.find(line => !products[line.productId])
  if (missingProduct) throw new HttpsError('invalid-argument', 'Phiếu chứa vật tư không tồn tại.')
  if (type === 'Outbound') {
    const customer = customers[form.customerId]
    if (!customer || customer.status === 'Inactive') throw new HttpsError('invalid-argument', 'Vui lòng chọn khách hàng đang hoạt động.')
  }
  const duplicateProduct = new Set()
  if (lines.some(line => duplicateProduct.has(line.productId) || !duplicateProduct.add(line.productId))) throw new HttpsError('invalid-argument', 'Một vật tư chỉ được xuất hiện một lần trong phiếu.')
  const balanceRef = db.ref(`${WAREHOUSE_PATH}/inventoryBalances`)
  let stockError = ''
  const transaction = await balanceRef.transaction(currentBalances => {
    const next = { ...(currentBalances || {}) }
    for (const line of lines) {
      const product = products[line.productId]
      if (!product) return
      const row = { ...(next[line.productId] || {}) }
      const currentQuantity = numberValue(row.quantity ?? product.quantity)
      const nextQuantity = currentQuantity + (type === 'Inbound' ? line.quantity : -line.quantity)
      if (nextQuantity < 0) {
        stockError = `Vật tư "${product.name}" không đủ tồn kho.`
        return
      }
      row.quantity = nextQuantity
      next[line.productId] = row
    }
    return next
  })
  if (stockError) throw new HttpsError('failed-precondition', stockError)
  if (!transaction.committed) throw new HttpsError('aborted', 'Tồn kho vừa thay đổi, vui lòng thử lại.')
  const orderId = db.ref(`${WAREHOUSE_PATH}/orders`).push().key
  const orderItems = {}
  const movements = {}
  const orderIndexes = {}
  const itemSnapshots = []
  for (const line of lines) {
    const product = products[line.productId]
    const itemId = db.ref(`${WAREHOUSE_PATH}/orderItems/${orderId}`).push().key
    const item = {
      id: itemId,
      productId: line.productId,
      productName: product.name,
      sku: product.sku,
      quantity: line.quantity,
      unit: product.unit,
      unitPrice: numberValue(product.unitPrice),
    }
    orderItems[itemId] = item
    itemSnapshots.push(item)
    const movementId = db.ref(`${WAREHOUSE_PATH}/stockMovements`).push().key
    movements[movementId] = {
      id: movementId,
      orderId,
      productId: line.productId,
      productName: product.name,
      sku: product.sku,
      type: type === 'Inbound' ? 'Received' : 'Shipped',
      quantity: line.quantity,
      unitPrice: numberValue(product.unitPrice),
      date: textValue(form.date, new Date().toISOString().slice(0, 10)),
      createdAt: now(),
      createdBy: context.uid,
    }
    orderIndexes[`indexes/ordersByProduct/${line.productId}/${orderId}`] = true
  }
  const customer = customers[form.customerId]
  const order = {
    id: orderId,
    orderNumber: requestedOrderNumber || `${type === 'Inbound' ? 'PN' : 'PX'}-${Date.now()}`,
    type,
    customerId: type === 'Outbound' ? form.customerId : '',
    customerName: type === 'Outbound' ? customer.name : '',
    partnerName: type === 'Inbound' ? textValue(form.partnerName) : '',
    date: textValue(form.date, new Date().toISOString().slice(0, 10)),
    notes: textValue(form.notes),
    itemCount: itemSnapshots.length,
    status: 'completed',
    createdAt: now(),
    createdBy: context.uid,
    createdByName: context.name,
  }
  if (type === 'Outbound') orderIndexes[`indexes/ordersByCustomer/${form.customerId}/${orderId}`] = true
  const notificationId = db.ref(`${WAREHOUSE_PATH}/notifications`).push().key
  const updates = {
    [`${WAREHOUSE_PATH}/orders/${orderId}`]: order,
    [`${WAREHOUSE_PATH}/orderItems/${orderId}`]: orderItems,
    [`${WAREHOUSE_PATH}/notifications/${notificationId}`]: { id: notificationId, orderId, title: `Phiếu ${type === 'Inbound' ? 'nhập' : 'xuất'} mới`, message: order.orderNumber, createdAt: now() },
  }
  for (const [movementId, movement] of Object.entries(movements)) updates[`${WAREHOUSE_PATH}/stockMovements/${movementId}`] = movement
  for (const [path, value] of Object.entries(orderIndexes)) updates[path] = value
  for (const line of lines) updates[`${WAREHOUSE_PATH}/inventoryBalances/${line.productId}/updatedAt`] = now()
  Object.assign(updates, auditUpdate(context, requestId, type === 'Inbound' ? 'INBOUND_CREATED' : 'OUTBOUND_CREATED', 'order', orderId, order.orderNumber, null, order, ['order']))
  const result = { id: orderId, orderNumber: order.orderNumber }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.deleteOrder = onCall(async request => {
  const context = contextOf(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const order = await valueAt(`${WAREHOUSE_PATH}/orders/${data.id}`)
  if (!order) throw new HttpsError('not-found', 'Không tìm thấy phiếu.')
  const warehouse = await warehouseSnapshot()
  const storedItems = warehouse.orderItems?.[data.id] || {}
  const items = Object.values(storedItems)
  const balanceRef = db.ref(`${WAREHOUSE_PATH}/inventoryBalances`)
  let invalid = false
  const transaction = await balanceRef.transaction(currentBalances => {
    const next = { ...(currentBalances || {}) }
    for (const item of items) {
      const product = warehouse.products?.[item.productId]
      if (!product) continue
      const row = { ...(next[item.productId] || {}) }
      const currentQuantity = numberValue(row.quantity ?? product.quantity)
      const nextQuantity = currentQuantity + (order.type === 'Inbound' ? -item.quantity : item.quantity)
      if (nextQuantity < 0) { invalid = true; return }
      row.quantity = nextQuantity
      next[item.productId] = row
    }
    return next
  })
  if (invalid || !transaction.committed) throw new HttpsError('aborted', 'Không thể hoàn tác tồn kho, vui lòng thử lại.')
  const updates = {
    [`${WAREHOUSE_PATH}/orders/${data.id}`]: null,
    [`${WAREHOUSE_PATH}/orderItems/${data.id}`]: null,
  }
  for (const movementId of Object.keys(warehouse.stockMovements || {}).filter(id => warehouse.stockMovements[id].orderId === data.id)) updates[`${WAREHOUSE_PATH}/stockMovements/${movementId}`] = null
  for (const notificationId of Object.keys(warehouse.notifications || {}).filter(id => warehouse.notifications[id].orderId === data.id)) updates[`${WAREHOUSE_PATH}/notifications/${notificationId}`] = null
  for (const item of items) updates[`indexes/ordersByProduct/${item.productId}/${data.id}`] = null
  if (order.customerId) updates[`indexes/ordersByCustomer/${order.customerId}/${data.id}`] = null
  Object.assign(updates, auditUpdate(context, requestId, 'ORDER_DELETED', 'order', data.id, order.orderNumber, order, null, ['order', 'items', 'stock']))
  const result = { id: data.id }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

async function listSuperAdmins() {
  const result = await auth.listUsers(1000)
  return result.users.filter(user => user.customClaims?.role === 'super_admin')
}

exports.listAccounts = onCall(async request => {
  requireSuperAdmin(request)
  const users = await auth.listUsers(1000)
  const profiles = (await valueAt('profiles')) || {}
  return {
    accounts: users.users.map(user => ({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || profiles[user.uid]?.displayName || '',
      role: user.customClaims?.role || profiles[user.uid]?.role || 'user',
      disabled: Boolean(user.disabled),
      createdAt: user.metadata.creationTime || null,
      lastSignInAt: user.metadata.lastSignInTime || null,
    })),
  }
})

exports.createAccount = onCall(async request => {
  const context = requireSuperAdmin(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const email = textValue(data.email).toLowerCase()
  const password = typeof data.password === 'string' ? data.password : ''
  const displayName = textValue(data.displayName, email)
  const role = ACCOUNT_ROLES.includes(data.role) ? data.role : 'user'
  if (!email || !email.includes('@')) throw new HttpsError('invalid-argument', 'Email không hợp lệ.')
  if (password.length < 6) throw new HttpsError('invalid-argument', 'Mật khẩu phải có ít nhất 6 ký tự.')
  const user = await auth.createUser({ email, password, displayName, disabled: Boolean(data.disabled) })
  await auth.setCustomUserClaims(user.uid, { role })
  const profile = { uid: user.uid, email, displayName, role, disabled: Boolean(data.disabled), createdAt: now(), createdBy: context.uid, updatedAt: now(), updatedBy: context.uid }
  const updates = { [`profiles/${user.uid}`]: profile }
  Object.assign(updates, auditUpdate(context, requestId, 'ACCOUNT_CREATED', 'account', user.uid, email, null, { email, displayName, role, disabled: profile.disabled }, ['email', 'displayName', 'role', 'disabled']))
  const result = { uid: user.uid, email, displayName, role }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.changeAccountRole = onCall(async request => {
  const context = requireSuperAdmin(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  if (!ROLES.includes(data.role)) throw new HttpsError('invalid-argument', 'Role không hợp lệ.')
  const user = await auth.getUser(data.uid)
  const beforeRole = user.customClaims?.role || 'user'
  if (data.uid === context.uid && data.role !== 'super_admin') throw new HttpsError('failed-precondition', 'Không thể tự hạ role của phiên đang đăng nhập.')
  if (beforeRole === 'super_admin' && data.role !== 'super_admin' && (await listSuperAdmins()).length <= 1) throw new HttpsError('failed-precondition', 'Không thể hạ role của super admin cuối cùng.')
  await auth.setCustomUserClaims(data.uid, { ...(user.customClaims || {}), role: data.role })
  const updates = { [`profiles/${data.uid}/role`]: data.role, [`profiles/${data.uid}/updatedAt`]: now(), [`profiles/${data.uid}/updatedBy`]: context.uid }
  Object.assign(updates, auditUpdate(context, requestId, 'ACCOUNT_ROLE_CHANGED', 'account', data.uid, user.email || data.uid, { role: beforeRole }, { role: data.role }, ['role']))
  const result = { uid: data.uid, role: data.role }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.setAccountDisabled = onCall(async request => {
  const context = requireSuperAdmin(request)
  const data = request.data || {}
  const requestId = requestIdOf(data)
  const operation = await beginOperation(requestId, context)
  if (operation.replay) return operation.result
  const user = await auth.getUser(data.uid)
  const disabled = Boolean(data.disabled)
  const role = user.customClaims?.role || 'user'
  if (disabled && data.uid === context.uid) throw new HttpsError('failed-precondition', 'Không thể tự khóa tài khoản đang sử dụng.')
  if (disabled && role === 'super_admin' && (await listSuperAdmins()).length <= 1) throw new HttpsError('failed-precondition', 'Không thể khóa super admin cuối cùng.')
  await auth.updateUser(data.uid, { disabled })
  const updates = { [`profiles/${data.uid}/disabled`]: disabled, [`profiles/${data.uid}/updatedAt`]: now(), [`profiles/${data.uid}/updatedBy`]: context.uid }
  Object.assign(updates, auditUpdate(context, requestId, disabled ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED', 'account', data.uid, user.email || data.uid, { disabled: user.disabled }, { disabled }, ['disabled']))
  const result = { uid: data.uid, disabled }
  completeOperation(updates, requestId, result)
  await db.ref().update(updates)
  return result
})

exports.processAuditOutbox = onValueCreated('auditOutbox/{auditId}', async event => {
  const audit = event.data.val()
  if (!audit) return null
  const auditRef = db.ref(`auditLogs/${event.params.auditId}`)
  const existing = await auditRef.once('value')
  if (!existing.exists()) await auditRef.set(audit)
  await event.data.ref.remove()
  return null
})
