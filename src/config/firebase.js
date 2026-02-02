/**
 * Firebase Configuration
 * Initializes Firebase with credentials from .env.local
 * Provides database (Firestore) and authentication services
 */

import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

// Firebase configuration from environment variables
// These are loaded from .env.local (kept secret)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // Important for Firebase Realtime Database region routing:
  // Without this, RTDB may default to *.firebaseio.com and warn/hang for regional DBs.
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

// Check if Firebase is properly configured
const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  )
}

// Helpful, non-secret debug for missing env vars (names only)
const getMissingFirebaseEnvKeys = () => {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]
  const recommended = [
    'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
  ]

  const missingRequired = required.filter((k) => !process.env[k])
  const missingRecommended = recommended.filter((k) => !process.env[k])
  return { missingRequired, missingRecommended }
}

// Initialize Firebase

let app = null
let db = null
let auth = null
let storage = null

// Keep a stable singleton across Fast Refresh/HMR.
// This prevents "initializeFirestore() has already been called with different options".
const getGlobalFirebaseSingleton = () => {
  if (typeof globalThis === 'undefined') return null
  globalThis.__WHISKEY_BALLET_FIREBASE__ = globalThis.__WHISKEY_BALLET_FIREBASE__ || {}
  return globalThis.__WHISKEY_BALLET_FIREBASE__
}

// Only initialize Firebase on the client side to avoid SSR issues
if (typeof window !== 'undefined' && isFirebaseConfigured()) {
  try {
    const singleton = getGlobalFirebaseSingleton()
    if (singleton?.app && singleton?.db && singleton?.auth && singleton?.storage) {
      app = singleton.app
      db = singleton.db
      auth = singleton.auth
      storage = singleton.storage
    } else {
    // Client-side initialization
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

    // Get Firestore database instance with modern local cache
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        })
      } catch (firestoreInitError) {
        // If Firestore was already initialized earlier (e.g. Fast Refresh), reuse it.
        db = getFirestore(app)
        console.warn('⚠️ Reusing existing Firestore instance:', firestoreInitError)
      }

    // Get Authentication instance
    auth = getAuth(app)

    // Get Storage instance
    storage = getStorage(app)
      
      if (singleton) {
        singleton.app = app
        singleton.db = db
        singleton.auth = auth
        singleton.storage = storage
      }
    }

    console.log('✅ Firebase initialized successfully')
    console.log('📍 Project:', firebaseConfig.projectId)
  } catch (error) {
    console.error('❌ Firebase initialization error:', error)
  }
} else if (typeof window !== 'undefined' && !isFirebaseConfigured()) {
  const { missingRequired, missingRecommended } = getMissingFirebaseEnvKeys()
  console.warn('⚠️ Firebase not configured - check .env.local file')
  console.warn('Missing required env keys:', missingRequired)
  if (missingRecommended.length > 0) {
    console.warn('Missing recommended env keys:', missingRecommended)
  }
}

// Firebase Storage utility functions
export const uploadFileToStorage = async (file, path) => {
  if (!storage) throw new Error('Firebase Storage not initialized')
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}

// Only export storage once below

// Export for use in other files
export { app, db, auth, isFirebaseConfigured, storage, storageRef, uploadBytes, getDownloadURL }
