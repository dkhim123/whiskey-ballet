/**
 * Firebase-First Storage Layer
 * 
 * Architecture:
 * 1. Firebase Firestore is PRIMARY storage (online-first)
 * 2. IndexedDB is CACHE for offline access
 * 3. Automatic sync when connection restored
 * 
 * Data Flow:
 * - Write: Firebase first → IndexedDB cache → Queue if offline
 * - Read: Try Firebase first → Fallback to IndexedDB if offline
 * - Sync: Auto-sync offline changes when connection restored
 */

import { db, isFirebaseConfigured } from '../config/firebase'
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { 
  getAllItems,
  putBatch,
  putItem,
  getItem,
  STORES 
} from './indexedDBStorage'
import syncManager from './syncManager'

/**
 * Check if system is online
 */
function isOnline() {
  return typeof window !== 'undefined' && navigator.onLine
}

/**
 * Write data to Firebase (primary) and cache to IndexedDB
 */
export async function writeSharedDataOnline(data, adminId) {
  if (!adminId) {
    throw new Error('adminId is required for data isolation')
  }

  console.log(`💾 Storage: Writing shared data for adminId: ${adminId}`)
  console.log(`📊 Data summary:`, {
    inventory: data.inventory?.length || 0,
    transactions: data.transactions?.length || 0,
    purchaseOrders: data.purchaseOrders?.length || 0,
    suppliers: data.suppliers?.length || 0,
    customers: data.customers?.length || 0,
    expenses: data.expenses?.length || 0
  })

  const stores = [
    { name: STORES.INVENTORY, items: data.inventory || [] },
    { name: STORES.TRANSACTIONS, items: data.transactions || [] },
    { name: STORES.SUPPLIERS, items: data.suppliers || [] },
    { name: STORES.PURCHASE_ORDERS, items: data.purchaseOrders || [] },
    { name: STORES.GOODS_RECEIVED_NOTES, items: data.goodsReceivedNotes || [] },
    { name: STORES.SUPPLIER_PAYMENTS, items: data.supplierPayments || [] },
    { name: STORES.STOCK_ADJUSTMENTS, items: data.stockAdjustments || [] },
    { name: STORES.CUSTOMERS, items: data.customers || [] },
    { name: STORES.EXPENSES, items: data.expenses || [] }
  ]

  // Try Firebase first if online
  if (isOnline() && isFirebaseConfigured() && db) {
    try {
      console.log('🔄 Writing to Firebase (primary storage)...')
      
      // Write each store to Firebase
      for (const store of stores) {
        if (store.items.length === 0) continue

        const collectionRef = collection(db, 'organizations', adminId, store.name)
        
        // Use batch writes for efficiency (max 500 per batch)
        const batchSize = 500
        for (let i = 0; i < store.items.length; i += batchSize) {
          const batch = writeBatch(db)
          const chunk = store.items.slice(i, i + batchSize)

          for (const item of chunk) {
            const docRef = doc(collectionRef, item.id)
            batch.set(docRef, {
              ...item,
              adminId, // Ensure adminId is set
              updatedAt: serverTimestamp()
            }, { merge: true })
          }

          await batch.commit()
        }
        
        console.log(`✅ Wrote ${store.items.length} items to Firebase ${store.name}`)
      }

      // Write settings
      if (data.settings) {
        const settingsRef = doc(db, 'organizations', adminId, 'settings', 'config')
        await setDoc(settingsRef, {
          ...data.settings,
          updatedAt: serverTimestamp()
        }, { merge: true })
      }

      console.log('✅ Firebase write complete')
      
      // Cache to IndexedDB after successful Firebase write
      await cacheToIndexedDB(data, adminId)
      
      return true
    } catch (error) {
      console.error('❌ Firebase write failed:', error)
      
      // Queue for sync if offline
      for (const store of stores) {
        for (const item of store.items) {
          syncManager.addToQueue({
            type: 'update',
            collection: store.name,
            docId: item.id,
            data: item,
            adminId
          })
        }
      }
      
      // Still cache locally
      await cacheToIndexedDB(data, adminId)
      
      throw error
    }
  } else {
    console.log('📴 Offline or Firebase not configured - caching locally and queuing for sync')
    
    // Cache to IndexedDB
    await cacheToIndexedDB(data, adminId)
    
    // Queue all items for sync when online
    for (const store of stores) {
      for (const item of store.items) {
        syncManager.addToQueue({
          type: 'update',
          collection: store.name,
          docId: item.id,
          data: item,
          adminId
        })
      }
    }
    
    return true
  }
}

/**
 * Cache data to IndexedDB
 */
async function cacheToIndexedDB(data, adminId) {
  console.log('🗄️ Caching to IndexedDB...')
  
  try {
    const stores = [
      { name: STORES.INVENTORY, items: data.inventory || [] },
      { name: STORES.TRANSACTIONS, items: data.transactions || [] },
      { name: STORES.SUPPLIERS, items: data.suppliers || [] },
      { name: STORES.PURCHASE_ORDERS, items: data.purchaseOrders || [] },
      { name: STORES.GOODS_RECEIVED_NOTES, items: data.goodsReceivedNotes || [] },
      { name: STORES.SUPPLIER_PAYMENTS, items: data.supplierPayments || [] },
      { name: STORES.STOCK_ADJUSTMENTS, items: data.stockAdjustments || [] },
      { name: STORES.CUSTOMERS, items: data.customers || [] },
      { name: STORES.EXPENSES, items: data.expenses || [] }
    ]

    for (const store of stores) {
      if (store.items.length > 0) {
        await putBatch(store.name, store.items, adminId)
        console.log(`💾 Cached ${store.items.length} items to IndexedDB ${store.name}`)
      }
    }

    // Cache settings
    if (data.settings) {
      await putItem(STORES.SETTINGS, adminId, data.settings, adminId)
    }

    console.log('✅ IndexedDB cache complete')
  } catch (error) {
    console.error('❌ IndexedDB cache failed:', error)
  }
}

/**
 * Read data from Firebase (primary) or IndexedDB (cache)
 */
export async function readSharedDataOnline(adminId, includeDeleted = false) {
  if (!adminId) {
    throw new Error('adminId is required for data isolation')
  }

  console.log(`📖 Storage: Reading shared data for adminId: ${adminId}`)

  // Try Firebase first if online
  if (isOnline() && isFirebaseConfigured() && db) {
    try {
      console.log('🔄 Reading from Firebase (primary storage)...')
      
      const data = {
        inventory: [],
        transactions: [],
        suppliers: [],
        purchaseOrders: [],
        goodsReceivedNotes: [],
        supplierPayments: [],
        stockAdjustments: [],
        customers: [],
        expenses: [],
        settings: {
          storeName: 'Whiskey Ballet',
          currency: 'KES',
          vatRate: 0.16,
          vatEnabled: true,
          spendingLimitPercentage: 50,
          enableSpendingAlerts: true,
          lastBackupDate: null
        },
        lastSync: new Date().toISOString()
      }

      const stores = [
        { name: STORES.INVENTORY, key: 'inventory' },
        { name: STORES.TRANSACTIONS, key: 'transactions' },
        { name: STORES.SUPPLIERS, key: 'suppliers' },
        { name: STORES.PURCHASE_ORDERS, key: 'purchaseOrders' },
        { name: STORES.GOODS_RECEIVED_NOTES, key: 'goodsReceivedNotes' },
        { name: STORES.SUPPLIER_PAYMENTS, key: 'supplierPayments' },
        { name: STORES.STOCK_ADJUSTMENTS, key: 'stockAdjustments' },
        { name: STORES.CUSTOMERS, key: 'customers' },
        { name: STORES.EXPENSES, key: 'expenses' }
      ]

      // Read each store from Firebase
      for (const store of stores) {
        const collectionRef = collection(db, 'organizations', adminId, store.name)
        let q = query(collectionRef)
        
        // Filter deleted items if needed
        if (!includeDeleted) {
          q = query(collectionRef, where('isDeleted', '!=', true))
        }
        
        const snapshot = await getDocs(q)
        data[store.key] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        console.log(`📦 Read ${data[store.key].length} items from Firebase ${store.name}`)
      }

      // Read settings
      const settingsRef = doc(db, 'organizations', adminId, 'settings', 'config')
      const settingsSnap = await getDoc(settingsRef)
      if (settingsSnap.exists()) {
        data.settings = settingsSnap.data()
      }

      console.log('✅ Firebase read complete')
      
      // Update IndexedDB cache in background
      cacheToIndexedDB(data, adminId).catch(err => 
        console.warn('Background cache update failed:', err)
      )
      
      return data
    } catch (error) {
      console.error('❌ Firebase read failed, falling back to IndexedDB cache:', error)
    }
  }

  // Fallback to IndexedDB cache
  console.log('📴 Reading from IndexedDB cache (offline mode)')
  
  try {
    const data = {
      inventory: await getAllItems(STORES.INVENTORY, adminId, includeDeleted),
      transactions: await getAllItems(STORES.TRANSACTIONS, adminId, includeDeleted),
      suppliers: await getAllItems(STORES.SUPPLIERS, adminId, includeDeleted),
      purchaseOrders: await getAllItems(STORES.PURCHASE_ORDERS, adminId, includeDeleted),
      goodsReceivedNotes: await getAllItems(STORES.GOODS_RECEIVED_NOTES, adminId, includeDeleted),
      supplierPayments: await getAllItems(STORES.SUPPLIER_PAYMENTS, adminId, includeDeleted),
      stockAdjustments: await getAllItems(STORES.STOCK_ADJUSTMENTS, adminId, includeDeleted),
      customers: await getAllItems(STORES.CUSTOMERS, adminId, includeDeleted),
      expenses: await getAllItems(STORES.EXPENSES, adminId, includeDeleted),
      settings: await getItem(STORES.SETTINGS, adminId, adminId) || {
        storeName: 'Whiskey Ballet',
        currency: 'KES',
        vatRate: 0.16,
        vatEnabled: true,
        spendingLimitPercentage: 50,
        enableSpendingAlerts: true,
        lastBackupDate: null
      },
      lastSync: null
    }

    console.log('✅ IndexedDB cache read complete')
    return data
  } catch (error) {
    console.error('❌ IndexedDB read failed:', error)
    throw error
  }
}

/**
 * Subscribe to real-time updates from Firebase (for admin monitoring)
 */
export function subscribeToSharedData(adminId, storeName, callback, filters = {}) {
  if (!isFirebaseConfigured() || !db) {
    console.warn('Firebase not configured, real-time updates unavailable')
    return () => {} // Return no-op unsubscribe
  }

  const collectionRef = collection(db, 'organizations', adminId, storeName)
  let q = query(collectionRef)

  // Apply filters (e.g., branchId, userId, date range)
  if (filters.branchId) {
    q = query(q, where('branchId', '==', filters.branchId))
  }
  if (filters.userId) {
    q = query(q, where('userId', '==', filters.userId))
  }
  if (filters.orderBy) {
    q = query(q, orderBy(filters.orderBy, filters.orderDirection || 'desc'))
  }
  if (filters.limit) {
    q = query(q, limit(filters.limit))
  }

  // Subscribe to real-time updates
  const unsubscribe = onSnapshot(q, 
    (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      callback(items)
    },
    (error) => {
      console.error(`Error in real-time subscription for ${storeName}:`, error)
    }
  )

  return unsubscribe
}

/**
 * Write single item to Firebase and cache
 */
export async function writeItemOnline(storeName, item, adminId) {
  if (!adminId) {
    throw new Error('adminId is required')
  }

  // Try Firebase first if online
  if (isOnline() && isFirebaseConfigured() && db) {
    try {
      const collectionRef = collection(db, 'organizations', adminId, storeName)
      const docRef = doc(collectionRef, item.id)
      
      await setDoc(docRef, {
        ...item,
        adminId,
        updatedAt: serverTimestamp()
      }, { merge: true })
      
      // Cache to IndexedDB
      await putItem(storeName, item.id, item, adminId)
      
      return true
    } catch (error) {
      console.error('Firebase write failed:', error)
      
      // Queue for sync
      syncManager.addToQueue({
        type: 'update',
        collection: storeName,
        docId: item.id,
        data: item,
        adminId
      })
      
      // Still cache locally
      await putItem(storeName, item.id, item, adminId)
      
      throw error
    }
  } else {
    // Offline: cache and queue
    await putItem(storeName, item.id, item, adminId)
    
    syncManager.addToQueue({
      type: 'update',
      collection: storeName,
      docId: item.id,
      data: item,
      adminId
    })
    
    return true
  }
}

/**
 * Delete item (soft delete)
 */
export async function deleteItemOnline(storeName, itemId, adminId) {
  if (!adminId) {
    throw new Error('adminId is required')
  }

  // Try Firebase first if online
  if (isOnline() && isFirebaseConfigured() && db) {
    try {
      const collectionRef = collection(db, 'organizations', adminId, storeName)
      const docRef = doc(collectionRef, itemId)
      
      await setDoc(docRef, {
        deletedAt: serverTimestamp(),
        isDeleted: true
      }, { merge: true })
      
      // Update cache
      const item = await getItem(storeName, itemId, adminId)
      if (item) {
        await putItem(storeName, itemId, { ...item, deletedAt: new Date().toISOString(), isDeleted: true }, adminId)
      }
      
      return true
    } catch (error) {
      console.error('Firebase delete failed:', error)
      
      // Queue for sync
      syncManager.addToQueue({
        type: 'delete',
        collection: storeName,
        docId: itemId,
        adminId
      })
      
      throw error
    }
  } else {
    // Offline: update cache and queue
    const item = await getItem(storeName, itemId, adminId)
    if (item) {
      await putItem(storeName, itemId, { ...item, deletedAt: new Date().toISOString(), isDeleted: true }, adminId)
    }
    
    syncManager.addToQueue({
      type: 'delete',
      collection: storeName,
      docId: itemId,
      adminId
    })
    
    return true
  }
}
