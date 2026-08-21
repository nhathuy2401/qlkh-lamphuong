import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'project-ad668',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)

export const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const firestore = firebaseApp ? getFirestore(firebaseApp) : null

if (firebaseApp && env.VITE_USE_FIREBASE_EMULATORS === 'true' && env.DEV) {
  const emulatorHost = env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1'
  connectFirestoreEmulator(firestore, emulatorHost, Number(env.VITE_FIRESTORE_EMULATOR_PORT || 8080))
}
