import fs from 'node:fs'
import { initializeApp } from 'firebase/app'
import { doc, getFirestore, writeBatch } from 'firebase/firestore'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)] }))
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID })
const db = getFirestore(app)
const materials = JSON.parse(fs.readFileSync('src/data/materials.json', 'utf8'))
const customers = JSON.parse(fs.readFileSync('src/data/customers.json', 'utf8'))
const writes = []
for (const [index, item] of materials.entries()) writes.push(['products', `product_${index + 1}`, { ...item, id: `product_${index + 1}`, sku: `VT-${String(index + 1).padStart(4, '0')}`, quantity: 0, reorderPoint: 10, notes: item.notes || '', createdAt: Date.now(), updatedAt: Date.now() }])
for (const [index, item] of customers.entries()) writes.push(['customers', `customer_${index + 1}`, { ...item, id: `customer_${index + 1}`, status: 'Active', createdAt: Date.now(), updatedAt: Date.now() }])
for (let index = 0; index < writes.length; index += 400) {
  const batch = writeBatch(db)
  writes.slice(index, index + 400).forEach(([collection, id, data]) => batch.set(doc(db, collection, id), data))
  await batch.commit()
}
console.log(`Đã seed ${materials.length} vật tư và ${customers.length} khách hàng vào Firestore.`)
