#!/usr/bin/env node
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const [email, password, displayName = 'Super Admin'] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/bootstrap-super-admin.mjs <email> <password> [displayName]')
  process.exit(1)
}

const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'project-ad668'
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
})

const auth = admin.auth()
const db = admin.database()
const existing = await auth.getUserByEmail(email).catch(error => error.code === 'auth/user-not-found' ? null : Promise.reject(error))
const user = existing || await auth.createUser({ email, password, displayName })
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: 'super_admin' })
await db.ref(`profiles/${user.uid}`).update({
  uid: user.uid,
  email,
  displayName,
  role: 'super_admin',
  disabled: false,
  updatedAt: admin.database.ServerValue.TIMESTAMP,
  updatedBy: 'bootstrap',
})
console.log(`Super admin ready: ${email} (${user.uid})`)
