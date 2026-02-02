import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase Realtime Database only on client side to avoid SSR issues
let db = null;

function getRealtimeDB() {
  if (typeof window === 'undefined') {
    return null; // Return null during SSR
  }
  
  if (!db) {
    try {
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      db = getDatabase(app);
    } catch (error) {
      console.error('Firebase Realtime Database initialization error:', error);
      return null;
    }
  }
  
  return db;
}


// Generic write function for any entity
export function writeEntityToRealtimeDB(entityType, entity) {
  const database = getRealtimeDB();
  if (!database) {
    console.warn('Firebase Realtime Database not available (SSR or not configured)');
    return Promise.resolve();
  }
  if (!entity.id) throw new Error('Entity must have an id')
  return set(ref(database, `${entityType}/${entity.id}`), entity)
}

// For compatibility with old imports
export const writeUserToRealtimeDB = (user) => {
  // Safety: never send password material to the cloud database
  // (even hashed passwords shouldn't be stored in RTDB)
  const safeUser = { ...(user || {}) }
  delete safeUser.password
  delete safeUser.passwordHash

  return writeEntityToRealtimeDB('users', safeUser)
}

// Generic read function for any entity
import { get, child } from "firebase/database"
export async function readEntityFromRealtimeDB(entityType, id) {
  const database = getRealtimeDB();
  if (!database) {
    console.warn('Firebase Realtime Database not available (SSR or not configured)');
    return null;
  }
  const snapshot = await get(child(ref(database), `${entityType}/${id}`))
  return snapshot.exists() ? snapshot.val() : null
}

// Convenience functions for each major entity
export const writeProductToRealtimeDB = (product) => writeEntityToRealtimeDB('products', product)
export const writeInventoryToRealtimeDB = (inventory) => writeEntityToRealtimeDB('inventory', inventory)
export const writeTransactionToRealtimeDB = (transaction) => writeEntityToRealtimeDB('transactions', transaction)
export const writeExpenseToRealtimeDB = (expense) => writeEntityToRealtimeDB('expenses', expense)
export const writeSupplierToRealtimeDB = (supplier) => writeEntityToRealtimeDB('suppliers', supplier)
export const writePurchaseOrderToRealtimeDB = (purchaseOrder) => writeEntityToRealtimeDB('purchaseOrders', purchaseOrder)
export const writePaymentToRealtimeDB = (payment) => writeEntityToRealtimeDB('payments', payment)
export const writeBranchToRealtimeDB = (branch) => writeEntityToRealtimeDB('branches', branch)

export const readProductFromRealtimeDB = (id) => readEntityFromRealtimeDB('products', id)
export const readInventoryFromRealtimeDB = (id) => readEntityFromRealtimeDB('inventory', id)
export const readTransactionFromRealtimeDB = (id) => readEntityFromRealtimeDB('transactions', id)
export const readExpenseFromRealtimeDB = (id) => readEntityFromRealtimeDB('expenses', id)
export const readSupplierFromRealtimeDB = (id) => readEntityFromRealtimeDB('suppliers', id)
export const readPurchaseOrderFromRealtimeDB = (id) => readEntityFromRealtimeDB('purchaseOrders', id)
export const readPaymentFromRealtimeDB = (id) => readEntityFromRealtimeDB('payments', id)
export const readBranchFromRealtimeDB = (id) => readEntityFromRealtimeDB('branches', id)
