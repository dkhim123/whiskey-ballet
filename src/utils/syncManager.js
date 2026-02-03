/**
 * Sync Manager - Handles online/offline transitions and data synchronization
 * 
 * Architecture:
 * - Firebase is primary storage (online-first)
 * - IndexedDB is offline cache
 * - Sync queue tracks offline changes
 * - Auto-sync when connection restored
 */

import { db, isFirebaseConfigured } from '../config/firebase'
import { 
  collection, 
  doc, 
  setDoc, 
  writeBatch, 
  serverTimestamp,
  onSnapshot,
  query,
  where
} from 'firebase/firestore'
import { getDB, STORES, putBatch, getAllItems, getSyncQueue, saveSyncQueue } from './indexedDBStorage'
import { inventoryDocId } from './firebaseStorageOnline'

const SYNC_QUEUE_KEY = 'pos-sync-queue'
const LAST_SYNC_KEY = 'pos-last-sync'
const FAILED_SYNC_STORE = STORES.FAILED_SYNC

/**
 * Sync Queue Manager
 */
class SyncManager {
  constructor(adminId = null) {
    this.isOnline = typeof window !== 'undefined' ? navigator.onLine : false
    this.syncInProgress = false
    this.adminId = adminId
    this.queue = []
    this.queueLoaded = false
    this.listeners = []
    
    if (typeof window !== 'undefined') {
      this.setupOnlineListener()
    }

    // Load queue from IndexedDB (and migrate from legacy localStorage if present)
    void this.initializeQueue()
  }

  /**
   * Setup online/offline event listeners
   */
  setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('🟢 Connection restored - Starting sync...')
      this.isOnline = true
      this.notifyListeners({ online: true, syncing: false })
      this.syncAll()
    })

    window.addEventListener('offline', () => {
      console.log('🔴 Connection lost - Switching to offline mode')
      this.isOnline = false
      this.notifyListeners({ online: false, syncing: false })
    })
  }

  /**
   * Add listener for sync status changes
   */
  addListener(callback) {
    this.listeners.push(callback)
    // Immediately notify with current status
    callback({ online: this.isOnline, syncing: this.syncInProgress })
  }

  /**
   * Remove listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback)
  }

  /**
   * Notify all listeners
   */
  notifyListeners(status) {
    this.listeners.forEach(listener => {
      try {
        listener(status)
      } catch (error) {
        console.error('Error in sync listener:', error)
      }
    })
  }

  /**
   * Load sync queue (legacy stub; queue is now loaded asynchronously from IndexedDB).
   */
  loadQueue() {
    return []
  }

  /**
   * Save sync queue to IndexedDB (scoped by adminId).
   */
  saveQueue() {
    // During SSR/static build there is no IndexedDB.
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || indexedDB === null) {
      return
    }

    // Infer adminId from the queued items if not explicitly set
    if (!this.adminId) {
      const inferred = this.queue.find((q) => q && q.adminId)?.adminId
      if (inferred) this.adminId = inferred
    }

    if (!this.adminId) {
      // We can't safely persist without knowing which org/admin this queue belongs to.
      console.warn('⚠️ Sync queue not persisted (adminId is missing)')
      return
    }

    void saveSyncQueue(this.adminId, this.queue).catch((e) => {
      console.error('Error saving sync queue to IndexedDB:', e)
    })
  }

  /**
   * One-time init:
   * - migrate any legacy localStorage queue into IndexedDB
   * - load the current admin queue into memory
   */
  async initializeQueue() {
    try {
      await this.migrateQueueFromLocalStorage()
    } catch (e) {
      console.warn('⚠️ Sync queue migration skipped/failed:', e)
    }

    await this.reloadQueueFromIndexedDB()
  }

  /**
   * Load this.adminId queue from IndexedDB into memory.
   */
  async reloadQueueFromIndexedDB() {
    // During SSR/static build there is no IndexedDB.
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || indexedDB === null) {
      this.queue = []
      this.queueLoaded = true
      return
    }

    if (!this.adminId) {
      // Can't scope without adminId; keep empty until we learn adminId (e.g., first addToQueue).
      this.queue = []
      this.queueLoaded = true
      return
    }

    try {
      this.queue = await getSyncQueue(this.adminId)
    } catch (e) {
      console.error('❌ Failed to load sync queue from IndexedDB:', e)
      this.queue = []
    } finally {
      this.queueLoaded = true
    }
  }

  /**
   * Migration: move legacy localStorage queue (SYNC_QUEUE_KEY) into IndexedDB.
   * Safety: merges with any existing IndexedDB queue so nothing is lost.
   */
  async migrateQueueFromLocalStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }
    if (typeof indexedDB === 'undefined' || indexedDB === null) {
      return
    }

    let raw
    try {
      raw = localStorage.getItem(SYNC_QUEUE_KEY)
    } catch (e) {
      return
    }

    if (!raw) return

    let legacyItems
    try {
      legacyItems = JSON.parse(raw)
    } catch (e) {
      console.warn('⚠️ Legacy sync queue JSON parse failed; leaving localStorage key intact')
      return
    }

    if (!Array.isArray(legacyItems) || legacyItems.length === 0) {
      // Nothing to migrate, but clear corrupted/empty legacy key.
      try {
        localStorage.removeItem(SYNC_QUEUE_KEY)
      } catch (e) {
        // ignore
      }
      return
    }

    // Infer adminId if not set yet
    if (!this.adminId) {
      const inferred = legacyItems.find((q) => q && q.adminId)?.adminId
      if (inferred) this.adminId = inferred
    }

    // Group by adminId so we don't lose cross-org data (rare but possible)
    const byAdmin = new Map()
    for (const item of legacyItems) {
      const aid = item?.adminId || this.adminId
      if (!aid) continue
      const arr = byAdmin.get(aid) || []
      arr.push(item)
      byAdmin.set(aid, arr)
    }

    for (const [adminId, items] of byAdmin.entries()) {
      const existing = await getSyncQueue(adminId)
      const mergedById = new Map()
      for (const x of existing) mergedById.set(x.id, x)
      for (const x of items) mergedById.set(x.id, x)
      await saveSyncQueue(adminId, Array.from(mergedById.values()))
    }

    // Remove legacy key after successful migration
    try {
      localStorage.removeItem(SYNC_QUEUE_KEY)
    } catch (e) {
      // ignore
    }
  }

  /**
   * Add operation to sync queue
   */
  addToQueue(operation) {
    // Learn adminId from the first queued operation (keeps external calling code unchanged)
    if (!this.adminId && operation && operation.adminId) {
      this.adminId = operation.adminId
      // Load any existing queue for this admin in the background
      void this.reloadQueueFromIndexedDB()
    }

    const queueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...operation,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      lastAttemptAt: null
    }
    
    this.queue.push(queueItem)
    this.saveQueue()
    
    console.log(`📝 Added to sync queue: ${operation.type} ${operation.collection}`, queueItem)
    
    // Try to sync immediately if online
    if (this.isOnline && !this.syncInProgress) {
      this.syncAll()
    }
    
    return queueItem.id
  }

  /**
   * Move a permanently failing item to the dead-letter queue (IndexedDB).
   * This prevents silent data loss when an item hits max retries.
   */
  async moveToDeadLetterQueue(item, error) {
    // During SSR/static build there is no IndexedDB.
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || indexedDB === null) {
      return false
    }

    // If the store constant is missing (older bundle), don't delete the item.
    if (!FAILED_SYNC_STORE) {
      return false
    }

    const failureReason =
      (error && typeof error === 'object' && 'message' in error && error.message)
        ? String(error.message)
        : String(error || 'Unknown error')

    try {
      const dbConn = await getDB()

      return await new Promise((resolve) => {
        let wrote = false
        try {
          const tx = dbConn.transaction([FAILED_SYNC_STORE], 'readwrite')
          const store = tx.objectStore(FAILED_SYNC_STORE)

          const record = {
            id: item.id,
            item,
            failureReason,
            failedAt: new Date().toISOString()
          }

          const req = store.put(record)

          req.onsuccess = () => {
            wrote = true
          }
          req.onerror = () => {
            console.error('❌ Failed to write dead letter record:', req.error)
          }

          tx.oncomplete = () => {
            dbConn.close()
            if (wrote) {
              console.warn('📮 Item moved to dead letter queue')
            }
            resolve(wrote)
          }

          tx.onerror = () => {
            console.error('❌ Dead letter transaction error:', tx.error)
            dbConn.close()
            resolve(false)
          }
        } catch (e) {
          console.error('❌ Dead letter write error:', e)
          dbConn.close()
          resolve(false)
        }
      })
    } catch (e) {
      console.error('❌ Unable to open IndexedDB for dead letter queue:', e)
      return false
    }
  }

  /**
   * Return all failed sync items from the dead-letter queue store.
   * @returns {Promise<Array<{id: string, item: object, failureReason: string, failedAt: string}>>}
   */
  async getFailedItems() {
    // During SSR/static build there is no IndexedDB.
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || indexedDB === null) {
      return []
    }
    if (!FAILED_SYNC_STORE) {
      return []
    }

    const dbConn = await getDB()
    return await new Promise((resolve) => {
      try {
        const tx = dbConn.transaction([FAILED_SYNC_STORE], 'readonly')
        const store = tx.objectStore(FAILED_SYNC_STORE)
        const req = store.getAll()

        req.onsuccess = () => {
          // resolve on tx completion
        }
        req.onerror = () => {
          console.error('❌ Failed to read dead letter queue:', req.error)
        }

        tx.oncomplete = () => {
          const items = Array.isArray(req.result) ? req.result : []
          dbConn.close()
          resolve(items)
        }
        tx.onerror = () => {
          console.error('❌ Dead letter read transaction error:', tx.error)
          dbConn.close()
          resolve([])
        }
      } catch (e) {
        console.error('❌ Dead letter read error:', e)
        dbConn.close()
        resolve([])
      }
    })
  }

  /**
   * Retry a failed item by moving it back into the active sync queue.
   * @param {string} id - Dead-letter record id (same as original queue item id)
   * @returns {Promise<boolean>} true if moved back to active queue
   */
  async retryFailedItem(id) {
    if (!id) return false

    // During SSR/static build there is no IndexedDB.
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || indexedDB === null) {
      return false
    }
    if (!FAILED_SYNC_STORE) {
      return false
    }

    const dbConn = await getDB()
    return await new Promise((resolve) => {
      let moved = false
      try {
        const tx = dbConn.transaction([FAILED_SYNC_STORE], 'readwrite')
        const store = tx.objectStore(FAILED_SYNC_STORE)

        const getReq = store.get(id)

        getReq.onsuccess = () => {
          const record = getReq.result
          if (!record || !record.item) {
            return
          }

          const queueItem = {
            ...record.item,
            retryCount: 0,
          }

          // Move back to active queue (localStorage)
          this.queue.push(queueItem)
          this.saveQueue()
          moved = true

          // Remove from dead-letter queue
          store.delete(id)

          // Try syncing immediately if online
          if (this.isOnline && !this.syncInProgress) {
            this.syncAll()
          }
        }

        getReq.onerror = () => {
          console.error('❌ Failed to load dead letter record:', getReq.error)
        }

        tx.oncomplete = () => {
          dbConn.close()
          resolve(moved)
        }
        tx.onerror = () => {
          console.error('❌ Dead letter retry transaction error:', tx.error)
          dbConn.close()
          resolve(false)
        }
      } catch (e) {
        console.error('❌ Dead letter retry error:', e)
        dbConn.close()
        resolve(false)
      }
    })
  }

  /**
   * Sync all queued operations to Firebase
   */
  async syncAll() {
    if (!this.queueLoaded) {
      await this.reloadQueueFromIndexedDB()
    }
    if (!this.isOnline || this.syncInProgress || this.queue.length === 0) {
      return
    }

    if (!isFirebaseConfigured() || !db) {
      console.warn('⚠️ Firebase not configured, cannot sync')
      return
    }

    this.syncInProgress = true
    this.notifyListeners({ online: this.isOnline, syncing: true })
    
    console.log(`🔄 Syncing ${this.queue.length} operations to Firebase...`)
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    }

    // Process queue items
    const itemsToRemove = []
    
    for (const item of this.queue) {
      try {
        await this.syncItem(item)
        results.success++
        itemsToRemove.push(item.id)
      } catch (error) {
        console.error(`❌ Failed to sync item:`, item, error)
        results.failed++
        results.errors.push({ item, error: error.message })
        
        // Retry logic
        item.retryCount = (item.retryCount || 0) + 1
        if (item.retryCount >= 10) {
          // Dead letter queue: preserve the failed item rather than deleting it.
          const moved = await this.moveToDeadLetterQueue(item, error)
          if (moved) {
            console.error(`❌ Max retries reached for item, moved to dead letter queue:`, item)
            itemsToRemove.push(item.id)
          } else {
            console.error(`❌ Max retries reached but dead letter write failed; keeping item in queue:`, item)
          }
        }
      }
    }

    // Remove successfully synced items
    this.queue = this.queue.filter(item => !itemsToRemove.includes(item.id))
    this.saveQueue()

    // Update last sync time
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())

    this.syncInProgress = false
    this.notifyListeners({ online: this.isOnline, syncing: false })
    
    console.log(`✅ Sync complete: ${results.success} success, ${results.failed} failed`)
    
    return results
  }

  /**
   * Sync a single item to Firebase
   */
  async syncItem(item) {
    // Track last attempt time (helps debugging and dead-letter records)
    item.lastAttemptAt = new Date().toISOString()

    // Exponential backoff for retries (temporary outages)
    const retryCount = Number(item.retryCount || 0)
    if (retryCount > 0) {
      // retryCount=1 -> 1s, retryCount=2 -> 2s, retryCount=3 -> 4s, ...
      const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000)
      console.log(`⏳ Retrying after ${delay}ms backoff...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    const { type, collection: collectionName, docId, data, adminId } = item

    // Build Firestore path based on adminId
    const collectionRef = collection(db, 'organizations', adminId, collectionName)
    const docRef = doc(collectionRef, docId)

    switch (type) {
      case 'create':
      case 'update':
        await setDoc(docRef, sanitizeForFirestore({
          ...data,
          updatedAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        }), { merge: true })
        break
        
      case 'delete':
        await setDoc(docRef, {
          deletedAt: serverTimestamp(),
          isDeleted: true
        }, { merge: true })
        break
        
      default:
        throw new Error(`Unknown sync operation type: ${type}`)
    }
  }

  /**
   * Full sync: Push all local data to Firebase
   * Used after extended offline period or for backup
   */
  async fullSync(adminId) {
    if (!this.isOnline || !isFirebaseConfigured() || !db) {
      throw new Error('Cannot perform full sync while offline or without Firebase')
    }

    console.log('🔄 Starting full sync to Firebase...')
    this.syncInProgress = true
    this.notifyListeners({ online: this.isOnline, syncing: true })

    try {
      const stores = [
        STORES.INVENTORY,
        STORES.TRANSACTIONS,
        STORES.SUPPLIERS,
        STORES.PURCHASE_ORDERS,
        STORES.SUPPLIER_PAYMENTS,
        STORES.CUSTOMERS,
        STORES.EXPENSES,
        STORES.BRANCHES
      ]

      let totalSynced = 0

      for (const storeName of stores) {
        try {
          const items = await getAllItems(storeName, adminId)
          
          if (items.length === 0) {
            console.log(`⏭️ Skipping ${storeName} (no items)`)
            continue
          }

          console.log(`📤 Syncing ${items.length} items from ${storeName}...`)

          // Use batch writes for efficiency (max 500 per batch)
          // INVENTORY: use branch-scoped doc ID so we don't overwrite other branches (numeric id would collide)
          const isInventory = storeName === STORES.INVENTORY
          const batchSize = 500
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = writeBatch(db)
            const chunk = items.slice(i, i + batchSize)

            for (const item of chunk) {
              const collectionRef = collection(db, 'organizations', adminId, storeName)
              const docId = isInventory ? inventoryDocId(item) : String(item.id)
              const docRef = doc(collectionRef, docId)

              batch.set(docRef, {
                ...item,
                syncedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              }, { merge: true })
            }

            await batch.commit()
            totalSynced += chunk.length
            console.log(`✅ Synced batch: ${i + chunk.length}/${items.length} items from ${storeName}`)
          }
        } catch (error) {
          console.error(`❌ Error syncing ${storeName}:`, error)
        }
      }

      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
      console.log(`✅ Full sync complete: ${totalSynced} items synced`)
      
      return { success: true, count: totalSynced }
    } catch (error) {
      console.error('❌ Full sync failed:', error)
      throw error
    } finally {
      this.syncInProgress = false
      this.notifyListeners({ online: this.isOnline, syncing: false })
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    const lastSync = localStorage.getItem(LAST_SYNC_KEY)
    
    return {
      online: this.isOnline,
      syncing: this.syncInProgress,
      queueSize: this.queue.length,
      lastSync: lastSync ? new Date(lastSync) : null
    }
  }

  /**
   * Clear sync queue (use with caution)
   */
  clearQueue() {
    this.queue = []
    this.saveQueue()
    console.log('🗑️ Sync queue cleared')
  }
}

// Create singleton instance
const syncManager = new SyncManager()

// Developer convenience (no UI impact): expose syncManager in DevTools during development
// so you can run:
//   await window.__WB_SYNC_MANAGER__.getFailedItems()
//   await window.__WB_SYNC_MANAGER__.retryFailedItem('<id>')
try {
  if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    window.__WB_SYNC_MANAGER__ = syncManager
  }
} catch (e) {
  // ignore
}

// Export instance and class
export default syncManager
export { SyncManager }
