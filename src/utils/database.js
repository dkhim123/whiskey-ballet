/**
 * IndexedDB Database Manager
 * Handles local storage with automatic sync (offline-first)
 */

const DB_NAME = "WhiskeyBalletPOS"
const DB_VERSION = 4 // Must match indexedDBStorage.js

// Store names
const STORES = {
  PRODUCTS: "products",
  TRANSACTIONS: "transactions",
  USERS: "users",
  SYNC_QUEUE: "sync_queue",
  INVENTORY: "inventory",
}

class Database {
  constructor() {
    this.db = null
    // Only access navigator.onLine in the browser
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        this.isOnline = navigator.onLine
        this.syncInProgress = false
        this.setupOnlineListener()
      } else {
        this.isOnline = false
        this.syncInProgress = false
        // Do NOT call setupOnlineListener on server
      }
  }

  setupOnlineListener() {
    if (typeof window !== 'undefined') {
      if (typeof window !== 'undefined') {
        window.addEventListener("online", () => {
          this.isOnline = true
          // ...existing code...
          this.syncWithServer()
        })

        window.addEventListener("offline", () => {
          this.isOnline = false
          // ...existing code...
        })
      }
    }
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        // ...existing code...
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Products store
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: "id" })
          productStore.createIndex("sku", "sku", { unique: true })
          productStore.createIndex("category", "category", { unique: false })
          productStore.createIndex("synced", "synced", { unique: false })
        }

        // Transactions store
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const transactionStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: "id" })
          transactionStore.createIndex("date", "date", { unique: false })
          transactionStore.createIndex("userId", "userId", { unique: false })
          transactionStore.createIndex("synced", "synced", { unique: false })
        }

        // Users store
        if (!db.objectStoreNames.contains(STORES.USERS)) {
          const userStore = db.createObjectStore(STORES.USERS, { keyPath: "id" })
          userStore.createIndex("email", "email", { unique: true })
          userStore.createIndex("role", "role", { unique: false })
        }

        // Sync queue - tracks changes to sync
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "id", autoIncrement: true })
          syncStore.createIndex("timestamp", "timestamp", { unique: false })
          syncStore.createIndex("action", "action", { unique: false })
        }

        // Inventory store
        if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
          const inventoryStore = db.createObjectStore(STORES.INVENTORY, { keyPath: "productId" })
          inventoryStore.createIndex("synced", "synced", { unique: false })
        }

        // ...existing code...
      }
    })
  }

  // Generic CRUD operations
  async add(storeName, data) {
    if (!this.db) await this.init()

    const dataWithSync = {
      ...data,
      synced: false,
      lastModified: new Date().toISOString(),
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName, STORES.SYNC_QUEUE], "readwrite")
      const store = transaction.objectStore(storeName)
      const request = store.add(dataWithSync)

      request.onsuccess = () => {
        // Add to sync queue
        this.addToSyncQueue("add", storeName, dataWithSync)
        resolve(request.result)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async get(storeName, id) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readonly")
      const store = transaction.objectStore(storeName)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getAll(storeName) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readonly")
      const store = transaction.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async update(storeName, data) {
    if (!this.db) await this.init()

    const dataWithSync = {
      ...data,
      synced: false,
      lastModified: new Date().toISOString(),
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName, STORES.SYNC_QUEUE], "readwrite")
      const store = transaction.objectStore(storeName)
      const request = store.put(dataWithSync)

      request.onsuccess = () => {
        this.addToSyncQueue("update", storeName, dataWithSync)
        resolve(request.result)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async delete(storeName, id) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName, STORES.SYNC_QUEUE], "readwrite")
      const store = transaction.objectStore(storeName)
      const request = store.delete(id)

      request.onsuccess = () => {
        this.addToSyncQueue("delete", storeName, { id })
        resolve(request.result)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async addToSyncQueue(action, storeName, data) {
    if (!this.db) return

    const queueItem = {
      action,
      storeName,
      data,
      timestamp: new Date().toISOString(),
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction([STORES.SYNC_QUEUE], "readwrite")
      const store = transaction.objectStore(STORES.SYNC_QUEUE)
      const request = store.add(queueItem)

      request.onsuccess = () => {
        if (this.isOnline && !this.syncInProgress) {
          this.syncWithServer()
        }
        resolve(request.result)
      }
      request.onerror = () => resolve(null)
    })
  }

  async syncWithServer() {
    if (!this.isOnline || this.syncInProgress) return

    this.syncInProgress = true
    // ...existing code...

    try {
      // Get all unsynced items from queue
      const queue = await this.getAll(STORES.SYNC_QUEUE)

      if (queue.length === 0) {
        // ...existing code...
        this.syncInProgress = false
        return
      }

      // Send to server
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queue,
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        const result = await response.json()
        
        // Mark items as synced
        for (const item of queue) {
          await this.markAsSynced(item.storeName, item.data.id)
        }

        // Clear sync queue
        await this.clearSyncQueue()

        // Pull latest data from server
        await this.pullFromServer()

        // ...existing code...
      } else {
        console.error("❌ Sync failed:", response.statusText)
      }
    } catch (error) {
      console.error("❌ Sync error:", error)
    } finally {
      this.syncInProgress = false
    }
  }

  async markAsSynced(storeName, id) {
    if (!this.db || !id) return

    try {
      const item = await this.get(storeName, id)
      if (item) {
        item.synced = true
        const transaction = this.db.transaction([storeName], "readwrite")
        const store = transaction.objectStore(storeName)
        store.put(item)
      }
    } catch (error) {
      console.error("Error marking as synced:", error)
    }
  }

  async clearSyncQueue() {
    if (!this.db) return

    return new Promise((resolve) => {
      const transaction = this.db.transaction([STORES.SYNC_QUEUE], "readwrite")
      const store = transaction.objectStore(STORES.SYNC_QUEUE)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
  }

  async pullFromServer() {
    if (!this.isOnline) return

    try {
      const response = await fetch("/api/sync?action=pull")
      if (response.ok) {
        const serverData = await response.json()

        // Update local database with server data
        for (const [storeName, items] of Object.entries(serverData)) {
          if (STORES[storeName.toUpperCase()]) {
            for (const item of items) {
              item.synced = true
              const transaction = this.db.transaction([storeName], "readwrite")
              const store = transaction.objectStore(storeName)
              store.put(item)
            }
          }
        }

        // ...existing code...
      }
    } catch (error) {
      console.error("❌ Pull error:", error)
    }
  }

  // Query helpers
  async queryByIndex(storeName, indexName, value) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readonly")
      const store = transaction.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.getAll(value)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedItems(storeName) {
    return this.queryByIndex(storeName, "synced", false)
  }
}

// Singleton instance
const db = new Database()

export default db
export { STORES }
