import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const env = import.meta.env
const publicFirebaseConfig = {
  apiKey: 'AIzaSyALYg5U56yEtxO3cz8P_icWLRG0z9FsGxw',
  authDomain: 'project-ad668.firebaseapp.com',
  databaseURL: 'https://project-ad668.firebaseio.com',
  projectId: 'project-ad668',
  storageBucket: 'project-ad668.firebasestorage.app',
  messagingSenderId: '282247869367',
  appId: '1:282247869367:web:7e8b3a91c1a6cddb4eae32',
}

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || publicFirebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || publicFirebaseConfig.authDomain,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || publicFirebaseConfig.databaseURL,
  projectId: env.VITE_FIREBASE_PROJECT_ID || publicFirebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || publicFirebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || publicFirebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || publicFirebaseConfig.appId,
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
