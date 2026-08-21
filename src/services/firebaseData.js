import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  runTransaction, setDoc, updateDoc,
} from 'firebase/firestore'
import { firestore, firebaseConfigured } from '../lib/firebase'
import { uid } from '../lib/utils'

const COLLECTIONS = ['products', 'customers', 'orders', 'movements', 'notifications']
const assertFirestore = () => { if (!firebaseConfigured || !firestore) throw new Error('Firestore chưa được cấu hình.') }
const numberValue = value => Number.isFinite(Number(value)) ? Number(value) : 0
const now = () => Date.now()
const changedFields = (before, after) => [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
const actorData = actor => ({ actorUid: actor?.uid || 'anonymous', actorEmail: actor?.email || 'anonymous', actorName: actor?.displayName || actor?.email || 'Anonymous', actorRoleAtTime: actor?.role || 'user' })
const readCollection = snapshot => snapshot.docs.map(item => ({ id: item.id, ...item.data() }))

const writeAudit = async (actor, action, targetType, targetId, targetLabel, before, after) => {
  const id = uid('audit')
  await setDoc(doc(firestore, 'auditLogs', id), { id, ...actorData(actor), action, targetType, targetId, targetLabel, before: before || null, after: after || null, changedFields: changedFields(before, after), createdAt: now() })
}

export const hashPassword = async password => {
  const bytes = new TextEncoder().encode(password)
  const buffer = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export const findUserByEmail = async email => {
  assertFirestore()
  const snapshot = await getDocs(query(collection(firestore, 'users')))
  return readCollection(snapshot).find(user => user.email?.toLowerCase() === email.trim().toLowerCase()) || null
}

export const subscribeWarehouse = (onData, onError) => {
  assertFirestore()
  const state = { products: [], customers: [], orders: [], movements: [], notifications: [], audit: [] }
  const emit = () => onData({ ...state, orders: [...state.orders].sort((a, b) => numberValue(b.createdAt) - numberValue(a.createdAt)) })
  const unsubs = COLLECTIONS.map(name => onSnapshot(collection(firestore, name), snapshot => {
    state[name] = readCollection(snapshot).map(item => name === 'products' ? { ...item, quantity: numberValue(item.quantity), reorderPoint: numberValue(item.reorderPoint ?? 10), unitPrice: numberValue(item.unitPrice) } : item)
    emit()
  }, onError))
  return () => unsubs.forEach(unsubscribe => unsubscribe())
}

export const subscribeConnection = (onConnection, onError) => {
  try {
    const update = () => onConnection(navigator.onLine)
    update(); window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  } catch (error) { onError?.(error); return () => {} }
}

export const subscribeAudit = (onData, onError) => {
  assertFirestore()
  return onSnapshot(query(collection(firestore, 'auditLogs'), orderBy('createdAt', 'desc'), limit(500)), snapshot => onData(readCollection(snapshot)), onError)
}

export const resetData = () => ({ products: [], customers: [], orders: [], movements: [], notifications: [], audit: [] })

const productPayload = form => ({ name: String(form.name || '').trim(), sku: form.sku || `VT-${String(Math.floor(Math.random() * 900000) + 100000)}`, unit: form.unit || 'cái', quantity: Math.max(0, numberValue(form.quantity)), reorderPoint: numberValue(form.reorderPoint ?? 10), unitPrice: Math.max(0, numberValue(form.unitPrice)), notes: form.notes || '', updatedAt: now() })

const mutation = async (name, payload, actor) => {
  assertFirestore()
  if (name === 'createProduct') {
    const id = uid('product'); const after = { id, ...productPayload(payload), createdAt: now() }
    await setDoc(doc(firestore, 'products', id), after); await writeAudit(actor, name, 'product', id, after.name, null, after); return after
  }
  if (name === 'updateProduct') {
    const target = doc(firestore, 'products', payload.id); const snapshot = await getDoc(target); if (!snapshot.exists()) throw new Error('Không tìm thấy vật tư.')
    const before = { id: snapshot.id, ...snapshot.data() }; const after = { ...before, ...productPayload(payload), id: before.id, createdAt: before.createdAt }
    await setDoc(target, after); await writeAudit(actor, name, 'product', before.id, after.name, before, after); return after
  }
  if (name === 'deleteProduct') {
    const target = doc(firestore, 'products', payload.id); const snapshot = await getDoc(target); if (!snapshot.exists()) throw new Error('Không tìm thấy vật tư.')
    const before = { id: snapshot.id, ...snapshot.data() }; await deleteDoc(target); await writeAudit(actor, name, 'product', before.id, before.name, before, null); return { id: before.id }
  }
  if (name === 'createCustomer') {
    const id = uid('customer'); const after = { id, name: String(payload.name || '').trim(), status: 'Active', createdAt: now(), updatedAt: now() }; if (!after.name) throw new Error('Tên khách hàng không được để trống.')
    await setDoc(doc(firestore, 'customers', id), after); await writeAudit(actor, name, 'customer', id, after.name, null, after); return after
  }
  if (name === 'setCustomerStatus') {
    const target = doc(firestore, 'customers', payload.id); const snapshot = await getDoc(target); if (!snapshot.exists()) throw new Error('Không tìm thấy khách hàng.')
    const before = { id: snapshot.id, ...snapshot.data() }; const after = { ...before, status: payload.status, updatedAt: now() }; await updateDoc(target, { status: after.status, updatedAt: after.updatedAt }); await writeAudit(actor, name, 'customer', before.id, before.name, before, after); return after
  }
  throw new Error(`Action chưa hỗ trợ: ${name}`)
}

const createOrder = async (payload, actor) => {
  assertFirestore(); const orderId = uid('order'); const inbound = payload.type === 'Inbound'; const lines = (payload.items || []).map(item => ({ productId: item.productId, quantity: numberValue(item.quantity) })).filter(item => item.productId && item.quantity > 0); if (!lines.length) throw new Error('Phiếu phải có ít nhất một vật tư.')
  const orderRef = doc(firestore, 'orders', orderId)
  const result = await runTransaction(firestore, async transaction => {
    const products = await Promise.all(lines.map(line => transaction.get(doc(firestore, 'products', line.productId)))); const orderItems = []; const updates = []
    products.forEach((snapshot, index) => {
      if (!snapshot.exists()) throw new Error('Một vật tư không còn tồn tại.')
      const product = { id: snapshot.id, ...snapshot.data() }; const line = lines[index]; const nextQuantity = numberValue(product.quantity) + (inbound ? line.quantity : -line.quantity); if (nextQuantity < 0) throw new Error(`Không đủ tồn kho cho ${product.name}.`)
      updates.push({ ref: snapshot.ref, data: { ...product, quantity: nextQuantity, updatedAt: now() }}); orderItems.push({ productId: product.id, productName: product.name, sku: product.sku, unit: product.unit, quantity: line.quantity, unitPrice: numberValue(product.unitPrice) })
    })
    const after = { id: orderId, type: payload.type, orderNumber: payload.form?.orderNumber || orderId, date: payload.form?.date || new Date().toISOString().slice(0, 10), customerId: payload.form?.customerId || '', customerName: payload.form?.customerName || '', partnerName: payload.form?.partnerName || '', notes: payload.form?.notes || '', items: orderItems, createdAt: now(), createdBy: actor?.uid || 'anonymous' }
    updates.forEach(item => transaction.set(item.ref, item.data)); transaction.set(orderRef, after)
    lines.forEach((line, index) => { const movementId = uid('movement'); transaction.set(doc(firestore, 'movements', movementId), { id: movementId, orderId, orderNumber: after.orderNumber, type: inbound ? 'Received' : 'Shipped', productId: line.productId, productName: orderItems[index].productName, quantity: line.quantity, unitPrice: orderItems[index].unitPrice, date: after.date, createdAt: now() }) })
    const notificationId = uid('notification'); transaction.set(doc(firestore, 'notifications', notificationId), { id: notificationId, type: inbound ? 'Received' : 'Shipped', orderId, message: `${after.orderNumber} đã được tạo`, createdAt: now(), read: false }); return after
  })
  await writeAudit(actor, 'createOrder', 'order', result.id, result.orderNumber, null, result); return result
}

const deleteOrder = async (id, actor) => {
  const target = doc(firestore, 'orders', id); const snapshot = await getDoc(target); if (!snapshot.exists()) throw new Error('Không tìm thấy phiếu.')
  const before = { id: snapshot.id, ...snapshot.data() }
  await runTransaction(firestore, async transaction => {
    const products = await Promise.all((before.items || []).map(item => transaction.get(doc(firestore, 'products', item.productId))))
    products.forEach((productSnapshot, index) => { if (!productSnapshot.exists()) return; const product = productSnapshot.data(); const item = before.items[index]; const nextQuantity = numberValue(product.quantity) + (before.type === 'Inbound' ? -item.quantity : item.quantity); transaction.update(productSnapshot.ref, { quantity: Math.max(0, nextQuantity), updatedAt: now() }) }); transaction.delete(target)
  })
  const movements = await getDocs(collection(firestore, 'movements')); await Promise.all(movements.docs.filter(item => item.data().orderId === id).map(item => deleteDoc(item.ref))); await writeAudit(actor, 'deleteOrder', 'order', id, before.orderNumber, before, null); return { id }
}

const listAccounts = async () => { const snapshot = await getDocs(collection(firestore, 'users')); return readCollection(snapshot).map(user => ({ ...user, uid: user.id, passwordHash: undefined })) }

export const callFunction = async (name, payload = {}, actor = null) => {
  assertFirestore()
  if (name === 'createOrder') return createOrder(payload, actor)
  if (name === 'deleteOrder') return deleteOrder(payload.id, actor)
  if (name === 'listAccounts') return listAccounts()
  if (name === 'changePassword') {
    if (!actor?.uid) throw new Error('Phiên đăng nhập không hợp lệ.')
    const target = doc(firestore, 'users', actor.uid); const snapshot = await getDoc(target); if (!snapshot.exists()) throw new Error('Không tìm thấy tài khoản.')
    const before = { uid: snapshot.id, ...snapshot.data() }
    if (before.passwordHash !== await hashPassword(payload.currentPassword || '')) throw new Error('Mật khẩu hiện tại chưa đúng.')
    if (String(payload.newPassword || '').length < 6) throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.')
    const passwordHash = await hashPassword(payload.newPassword); const after = { ...before, passwordHash, updatedAt: now() }
    await updateDoc(target, { passwordHash, updatedAt: after.updatedAt })
    await writeAudit(actor, name, 'user', target.id, after.email, { ...before, passwordHash: '[hidden]' }, { ...after, passwordHash: '[hidden]' })
    return { ok: true }
  }
  if (name === 'createAccount') {
    const id = uid('user'); const after = { uid: id, displayName: payload.displayName, email: payload.email.trim().toLowerCase(), passwordHash: await hashPassword(payload.password), role: payload.role || 'user', disabled: Boolean(payload.disabled), createdAt: now(), updatedAt: now() }
    await setDoc(doc(firestore, 'users', id), after); await writeAudit(actor, name, 'user', id, after.email, null, { ...after, passwordHash: '[hidden]' }); return { ...after, passwordHash: undefined }
  }
  if (name === 'changeAccountRole' || name === 'setAccountDisabled') {
    const target = doc(firestore, 'users', payload.uid); const snapshot = await getDoc(target); if (!snapshot.exists()) throw new Error('Không tìm thấy tài khoản.')
    const before = { uid: snapshot.id, ...snapshot.data() }; const after = { ...before, role: name === 'changeAccountRole' ? payload.role : before.role, disabled: name === 'setAccountDisabled' ? Boolean(payload.disabled) : before.disabled, updatedAt: now() }
    if (name === 'setAccountDisabled' && before.role === 'super_admin') throw new Error('Không thể khóa tài khoản super admin.')
    await updateDoc(target, { role: after.role, disabled: after.disabled, updatedAt: after.updatedAt }); await writeAudit(actor, name, 'user', target.id, after.email, { ...before, passwordHash: '[hidden]' }, { ...after, passwordHash: '[hidden]' }); return { ...after, passwordHash: undefined }
  }
  return mutation(name, payload, actor)
}
