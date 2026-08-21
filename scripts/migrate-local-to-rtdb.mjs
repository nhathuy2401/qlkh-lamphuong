#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const args = new Set(process.argv.slice(2))
const inputIndex = process.argv.indexOf('--input')
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : ''
const migrationId = process.env.MIGRATION_ID || `local-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`
const execute = args.has('--execute')

if (!inputPath) {
  console.error('Usage: node scripts/migrate-local-to-rtdb.mjs --input ./local-data.json [--execute]')
  process.exit(1)
}

const sourceText = await readFile(inputPath, 'utf8')
const source = JSON.parse(sourceText)
const checksum = createHash('sha256').update(sourceText).digest('hex')
const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'project-ad668'

const idOf = (value, prefix) => value?.id || `${prefix}_${Math.random().toString(36).slice(2)}`
const products = source.products || []
const customers = source.customers || []
const orders = source.orders || []
const movements = source.movements || []
const notifications = source.notifications || []
const updates = {}

for (const product of products) {
  const id = idOf(product, 'product')
  const { quantity, quantity_on_hand, ...productMeta } = product
  updates[`warehouses/default/products/${id}`] = {
    ...productMeta,
    id,
    createdBy: product.createdBy || 'migration',
    updatedBy: product.updatedBy || 'migration',
    migratedAt: admin.database.ServerValue.TIMESTAMP,
  }
  updates[`warehouses/default/inventoryBalances/${id}`] = {
    quantity: Number(product.quantity ?? product.quantity_on_hand) || 0,
    updatedBy: 'migration',
    updatedAt: admin.database.ServerValue.TIMESTAMP,
    version: 1,
  }
}

for (const customer of customers) {
  const id = idOf(customer, 'customer')
  updates[`warehouses/default/customers/${id}`] = { ...customer, id, createdBy: customer.createdBy || 'migration', updatedBy: customer.updatedBy || 'migration', migratedAt: admin.database.ServerValue.TIMESTAMP }
}

for (const order of orders) {
  const id = idOf(order, 'order')
  const items = Object.fromEntries((order.items || []).map(item => {
    const itemId = idOf(item, 'item')
    return [itemId, { ...item, id: itemId, productId: item.productId || item.product_id }]
  }))
  const { items: ignoredItems, ...orderMeta } = order
  updates[`warehouses/default/orders/${id}`] = { ...orderMeta, id, itemCount: Object.keys(items).length, createdBy: order.createdBy || 'migration', migratedAt: admin.database.ServerValue.TIMESTAMP }
  updates[`warehouses/default/orderItems/${id}`] = items
  for (const item of Object.values(items)) {
    if (item.productId) updates[`indexes/ordersByProduct/${item.productId}/${id}`] = true
  }
  if (order.customerId) updates[`indexes/ordersByCustomer/${order.customerId}/${id}`] = true
}

for (const movement of movements) {
  const id = idOf(movement, 'movement')
  updates[`warehouses/default/stockMovements/${id}`] = { ...movement, id, type: movement.type || movement.movementType, createdBy: movement.createdBy || 'migration', migratedAt: admin.database.ServerValue.TIMESTAMP }
}

for (const notification of notifications) {
  const id = idOf(notification, 'notification')
  updates[`warehouses/default/notifications/${id}`] = { ...notification, id, migratedAt: admin.database.ServerValue.TIMESTAMP }
}

const report = {
  migrationId,
  checksum,
  counts: { products: products.length, customers: customers.length, orders: orders.length, movements: movements.length, notifications: notifications.length },
  updatePaths: Object.keys(updates).length,
  mode: execute ? 'execute' : 'dry-run',
}
console.log(JSON.stringify(report, null, 2))

if (!execute) {
  console.log('Dry-run only. Add --execute after reviewing the report to write to RTDB.')
  process.exit(0)
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
}, 'migration')
const db = admin.app('migration').database()
const migrationRef = db.ref(`migrations/${migrationId}`)
const existing = await migrationRef.once('value')
if (existing.exists()) {
  console.error(`Migration ${migrationId} already exists; refusing to write twice.`)
  process.exit(1)
}
updates[`migrations/${migrationId}`] = { ...report, completedAt: admin.database.ServerValue.TIMESTAMP, source: 'localStorage' }
await db.ref().update(updates)
console.log(`Migration completed: ${migrationId}`)
