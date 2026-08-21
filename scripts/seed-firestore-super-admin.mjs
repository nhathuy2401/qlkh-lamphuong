import crypto from 'node:crypto'
import fs from 'node:fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
  const index = line.indexOf('=')
  return [line.slice(0, index), line.slice(index + 1)]
}))

const email = process.argv[2] || 'admin@qlkh.local'
const password = process.argv[3] || 'Admin@123456'
const displayName = process.argv[4] || 'Super Admin'
const uid = 'super_admin'
const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
const value = (type, value) => ({ [type]: String(value) })
const fields = {
  uid: value('stringValue', uid), displayName: value('stringValue', displayName), email: value('stringValue', email.toLowerCase()), passwordHash: value('stringValue', passwordHash),
  role: value('stringValue', 'super_admin'), disabled: { booleanValue: false }, createdAt: value('integerValue', Date.now()), updatedAt: value('integerValue', Date.now()),
}
const endpoint = `https://firestore.googleapis.com/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}?key=${env.VITE_FIREBASE_API_KEY}`
const response = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields }) })
if (!response.ok) throw new Error(`Không thể tạo super admin: ${response.status} ${await response.text()}`)
console.log(`Đã tạo/cập nhật super admin: ${email}`)
console.log(`Mật khẩu: ${password}`)
