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
 * Firestore does not accept undefined. Remove undefined values so writes succeed.
 * Exported for syncManager.
 */
export function sanitizeForFirestore(obj) {
  if (obj == null || typeof obj !== 'object') return obj
  const out = {}
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) out[key] = obj[key]
  }
  return out
}

/** Safe branch key for Firestore doc IDs (inventory is branch-scoped to avoid cross-branch overwrites). Exported for syncManager fullSync. */
export function inventoryDocId(item) {
  const branchId = item?.branchId != null && item.branchId !== '' ? String(item.branchId) : 'unassigned'
  const safeBranch = branchId.replace(/\//g, '_').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')
  const id = item?.id != null ? item.id : 0
  return `b_${safeBranch}_${id}`
}

/** Extract branch prefix from an inventory doc id (b_safeBranch_id) for branch-isolation deletes. */
function branchPrefixFromInventoryDocId(docId) {
  if (!docId || typeof docId !== 'string' || !docId.startsWith('b_')) return ''
  const withoutB = docId.slice(2)
  const lastUnderscore = withoutB.lastIndexOf('_')
  if (lastUnderscore === -1) return withoutB
  const suffix = withoutB.slice(lastUnderscore + 1)
  if (/^\d+$/.test(suffix)) return withoutB.slice(0, lastUnderscore)
  return withoutB
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
        const collectionRef = collection(db, 'organizations', adminId, store.name)
        const isInventory = store.name === STORES.INVENTORY

        // INVENTORY: delete Firestore docs that are no longer in payload, ONLY for branches present in the payload.
        // So deleting all in CBD never removes Nakuru docs (branch isolation).
        let idsToDelete = []
        if (isInventory) {
          const existingSnap = await getDocs(collectionRef)
          const idsToKeep = new Set((store.items || []).map((item) => inventoryDocId(item)))
          const payloadBranchPrefixes = new Set(
            (store.items || []).map((item) => {
              const branchId = item?.branchId != null && item.branchId !== '' ? String(item.branchId) : 'unassigned'
              return branchId.replace(/\//g, '_').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')
            })
          )
          idsToDelete = existingSnap.docs
            .filter(
              (d) =>
                !idsToKeep.has(d.id) && payloadBranchPrefixes.has(branchPrefixFromInventoryDocId(d.id))
            )
            .map((d) => d.id)
          if (idsToDelete.length > 0) {
            console.log(`🗑️ Inventory: removing ${idsToDelete.length} obsolete doc(s) from Firestore (branches in payload only)`)
          }
        }

        // Skip set phase only if nothing to write (non-inventory) or nothing to write and no deletes (inventory)
        if (store.items.length > 0) {
          const batchSize = 500
          for (let i = 0; i < store.items.length; i += batchSize) {
            const batch = writeBatch(db)
            const chunk = store.items.slice(i, i + batchSize)

            for (const item of chunk) {
              // INVENTORY: use branch-scoped doc ID so different branches can have same numeric id without overwriting
              const docId = isInventory ? inventoryDocId(item) : String(item.id)
              const docRef = doc(collectionRef, docId)
              // Firestore rejects undefined; strip so deletedAt/deletedBy etc. don't break writes
              const payload = sanitizeForFirestore({
                ...item,
                adminId,
                updatedAt: serverTimestamp()
              })
              batch.set(docRef, payload, { merge: true })
            }

            await batch.commit()
          }
          console.log(`✅ Wrote ${store.items.length} items to Firebase ${store.name}`)
        }

        // INVENTORY: batch-delete obsolete docs (max 500 per batch)
        if (isInventory && idsToDelete.length > 0) {
          const deleteBatchSize = 500
          for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
            const batch = writeBatch(db)
            const chunk = idsToDelete.slice(i, i + deleteBatchSize)
            for (const docId of chunk) {
              const docRef = doc(collectionRef, docId)
              batch.delete(docRef)
            }
            await batch.commit()
          }
          console.log(`✅ Deleted ${idsToDelete.length} obsolete inventory doc(s) from Firestore`)
        }
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
            docId: String(item.id),
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
          docId: String(item.id),
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
        // putBatch signature: (storeName, adminId, items)
        await putBatch(store.name, adminId, store.items)
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
        const snapshot = await getDocs(collectionRef)
        const isInventory = store.name === STORES.INVENTORY
        if (isInventory) {
          console.log(`🔍 Firestore inventory: Found ${snapshot.docs.length} documents in collection`)
        }
        let rows = snapshot.docs.map(docSnap => {
          const d = docSnap.data()
          // INVENTORY: keep numeric id from data (doc id is branch-scoped, e.g. b_Nakuru_1)
          const id = isInventory && (d.id !== undefined && d.id !== null) ? d.id : (d.id ?? docSnap.id)
          const row = { ...d, id }
          if (isInventory) row._docId = docSnap.id
          return row
        })
        // INVENTORY: dedupe by (branchId, id) - prefer branch-scoped doc ids (b_*) over legacy numeric doc ids
        if (isInventory && rows.length > 0) {
          const byKey = new Map()
          rows.forEach(item => {
            const branch = item?.branchId != null ? String(item.branchId) : 'unassigned'
            const key = `${branch}_${item?.id}`
            const existing = byKey.get(key)
            const preferThis = (item._docId && String(item._docId).startsWith('b_'))
            if (!existing || (preferThis && !String(existing._docId).startsWith('b_'))) {
              const { _docId, ...rest } = item
              byKey.set(key, rest)
            }
          })
          rows = Array.from(byKey.values())
        } else if (isInventory && rows.some(r => r._docId !== undefined)) {
          rows = rows.map(({ _docId, ...rest }) => rest)
        }

        // IMPORTANT (plain English):
        // We DO NOT use `where('isDeleted','!=',true)` here because Firestore excludes
        // documents that don't have the field at all (which makes freshly imported items "disappear").
        // Instead, we filter in code for backward compatibility.
        if (isInventory && rows.length > 0) {
          const beforeFilter = rows.length
          const withDeletedAt = rows.filter(item => item?.deletedAt).length
          const withIsDeleted = rows.filter(item => item?.isDeleted === true).length
          console.log(`🔍 Inventory read: ${beforeFilter} docs, ${withDeletedAt} have deletedAt, ${withIsDeleted} have isDeleted=true`)
        }
        data[store.key] = includeDeleted
          ? rows
          : rows.filter((item) => item?.isDeleted !== true && !item?.deletedAt)
        
        console.log(`📦 Read ${data[store.key].length} items from Firebase ${store.name}${includeDeleted ? ' (including deleted)' : ' (active only)'}`)
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
      // Firestore document IDs must be strings (CSV import uses numeric IDs)
      const docRef = doc(collectionRef, String(item.id))
      
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
        docId: String(item.id),
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
      docId: String(item.id),
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
      // Firestore document IDs must be strings
      const docRef = doc(collectionRef, String(itemId))
      
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
        docId: String(itemId),
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
      docId: String(itemId),
      adminId
    })
    
    return true
  }
}
