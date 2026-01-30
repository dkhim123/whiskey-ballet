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

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);


// Generic write function for any entity
export function writeEntityToRealtimeDB(entityType, entity) {
  if (!entity.id) throw new Error('Entity must have an id')
  return set(ref(db, `${entityType}/${entity.id}`), entity)
}

// For compatibility with old imports
export const writeUserToRealtimeDB = (user) => writeEntityToRealtimeDB('users', user)

// Generic read function for any entity
import { get, child } from "firebase/database"
export async function readEntityFromRealtimeDB(entityType, id) {
  const snapshot = await get(child(ref(db), `${entityType}/${id}`))
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
