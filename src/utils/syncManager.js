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
import { getDB, STORES, putBatch, getAllItems } from './indexedDBStorage'

const SYNC_QUEUE_KEY = 'pos-sync-queue'
const LAST_SYNC_KEY = 'pos-last-sync'

/**
 * Sync Queue Manager
 */
class SyncManager {
  constructor() {
    this.isOnline = typeof window !== 'undefined' ? navigator.onLine : false
    this.syncInProgress = false
    this.queue = this.loadQueue()
    this.listeners = []
    
    if (typeof window !== 'undefined') {
      this.setupOnlineListener()
    }
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
   * Load sync queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error loading sync queue:', error)
      return []
    }
  }

  /**
   * Save sync queue to localStorage
   */
  saveQueue() {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue))
    } catch (error) {
      console.error('Error saving sync queue:', error)
    }
  }

  /**
   * Add operation to sync queue
   */
  addToQueue(operation) {
    const queueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...operation,
      timestamp: new Date().toISOString(),
      retryCount: 0
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
   * Sync all queued operations to Firebase
   */
  async syncAll() {
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
        if (item.retryCount >= 3) {
          console.error(`❌ Max retries reached for item, removing from queue:`, item)
          itemsToRemove.push(item.id)
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
    const { type, collection: collectionName, docId, data, adminId } = item

    // Build Firestore path based on adminId
    const collectionRef = collection(db, 'organizations', adminId, collectionName)
    const docRef = doc(collectionRef, docId)

    switch (type) {
      case 'create':
      case 'update':
        await setDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        }, { merge: true })
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
          const batchSize = 500
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = writeBatch(db)
            const chunk = items.slice(i, i + batchSize)

            for (const item of chunk) {
              const collectionRef = collection(db, 'organizations', adminId, storeName)
              const docRef = doc(collectionRef, item.id)
              
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

// Export instance and class
export default syncManager
export { SyncManager }
