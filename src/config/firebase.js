/**
 * Firebase Configuration
 * Initializes Firebase with credentials from .env.local
 * Provides database (Firestore) and authentication services
 */

import { initializeApp, getApps } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

// Firebase configuration from environment variables
// These are loaded from .env.local (kept secret)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
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

// Initialize Firebase

let app = null
let db = null
let auth = null
let storage = null

if (isFirebaseConfigured()) {
  try {
    // SSR-safe: always use getApps()[0] if already initialized
    if (typeof window === 'undefined') {
      // On server, always use getApps()[0] if exists, else initialize
      app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    } else {
      // On client, same logic
      app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    }

    // Get Firestore database instance with modern local cache
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    })

    // Get Authentication instance
    auth = getAuth(app)

    // Get Storage instance
    storage = getStorage(app)

    if (typeof window !== 'undefined') {
      console.log('✅ Firebase initialized successfully')
      console.log('📍 Project:', firebaseConfig.projectId)
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error)
  }
} else {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ Firebase not configured - check .env.local file')
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
