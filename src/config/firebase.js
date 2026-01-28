/**
 * Firebase Configuration
 * Initializes Firebase with credentials from .env.local
 * Provides database (Firestore) and authentication services
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

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

if (isFirebaseConfigured()) {
  try {
    // Initialize Firebase app
    app = initializeApp(firebaseConfig)
    
    // Get Firestore database instance
    db = getFirestore(app)
    
    // Get Authentication instance
    auth = getAuth(app)

    // Enable offline persistence (works even without internet)
    if (typeof window !== 'undefined') {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ Firebase: Multiple tabs open, persistence only in one tab')
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Firebase: Browser does not support persistence')
        }
      })
    }

    console.log('✅ Firebase initialized successfully')
    console.log('📍 Project:', firebaseConfig.projectId)
  } catch (error) {
    console.error('❌ Firebase initialization error:', error)
  }
} else {
  console.warn('⚠️ Firebase not configured - check .env.local file')
}

// Export for use in other files
export { app, db, auth, isFirebaseConfigured }
