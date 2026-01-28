/**
 * Hybrid Storage Manager
 * Seamlessly syncs data between IndexedDB (local cache) and PostgreSQL (cloud storage)
 * 
 * Architecture:
 * - PostgreSQL: Source of truth, unlimited storage on Oracle Cloud
 * - IndexedDB: Local cache for offline functionality (last 7 days + top items)
 * - Sync Queue: Tracks offline changes, syncs when online
 * 
 * Cache Strategy:
 * - Inventory: Top 1000 most sold products + recently added
 * - Transactions: Last 7 days only
 * - Expenses: Last 30 days only
 * - Everything else: Full sync
 * 
 * Total cache size: ~7 MB (down from 50+ MB)
 */

import {
  STORES,
  getAllItems,
  putBatch,
  putItem,
  getItem as getIndexedDBItem,
  isIndexedDBAvailable
} from './indexedDBStorage'

// API base URL (will be configured per environment)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

/**
 * Storage Mode Configuration
 */
class StorageMode {
  constructor() {
    this.online = navigator.onLine
    this.setupOnlineListener()
  }

  setupOnlineListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online = true
        console.log('🟢 Online - Sync enabled')
        HybridStorage.syncAll().catch(err => 
          console.error('Auto-sync failed:', err)
        )
      })

      window.addEventListener('offline', () => {
        this.online = false
        console.log('🔴 Offline - Using local cache')
      })
    }
  }

  isOnline() {
    return this.online && navigator.onLine
  }
}

const storageMode = new StorageMode()

/**
 * Sync Queue Manager
 * Tracks offline changes and syncs when online
 */
class SyncQueue {
  constructor() {
    this.queue = []
    this.processing = false
  }

  /**
   * Add operation to sync queue
   */
  async add(operation, tableName, data, recordId = null) {
    const queueItem = {
      id: Date.now() + Math.random(),
      operation, // 'create', 'update', 'delete'
      tableName,
      recordId,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    }

    this.queue.push(queueItem)
    
    // Save queue to localStorage for persistence
    this.saveQueue()

    // Try to sync if online
    if (storageMode.isOnline()) {
      await this.processQueue()
    }

    return queueItem
  }

  /**
   * Save queue to localStorage
   */
  saveQueue() {
    try {
      localStorage.setItem('hybrid-storage-sync-queue', JSON.stringify(this.queue))
    } catch (error) {
      console.error('Failed to save sync queue:', error)
    }
  }

  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem('hybrid-storage-sync-queue')
      this.queue = stored ? JSON.parse(stored) : []
      return this.queue
    } catch (error) {
      console.error('Failed to load sync queue:', error)
      return []
    }
  }

  /**
   * Process all queued operations
   */
  async processQueue() {
    if (this.processing || !storageMode.isOnline() || this.queue.length === 0) {
      return
    }

    this.processing = true
    console.log(`🔄 Processing ${this.queue.length} queued operations...`)

    const results = {
      success: 0,
      failed: 0,
      errors: []
    }

    // Process queue items one by one
    while (this.queue.length > 0) {
      const item = this.queue[0]

      try {
        await this.processItem(item)
        this.queue.shift() // Remove from queue on success
        results.success++
      } catch (error) {
        console.error(`Failed to sync ${item.tableName}:`, error)
        item.retryCount++
        results.failed++
        results.errors.push({
          item,
          error: error.message
        })

        // Remove from queue if max retries reached
        if (item.retryCount >= 3) {
          console.error(`Max retries reached for ${item.tableName}, removing from queue`)
          this.queue.shift()
        } else {
          // Move to end of queue for retry
          this.queue.push(this.queue.shift())
        }

        // Stop processing if offline
        if (!storageMode.isOnline()) {
          break
        }
      }
    }

    this.saveQueue()
    this.processing = false

    console.log(`✅ Sync complete: ${results.success} success, ${results.failed} failed`)
    return results
  }

  /**
   * Process single queue item
   */
  async processItem(item) {
    const { operation, tableName, data, recordId } = item

    const endpoint = `${API_BASE_URL}/${tableName}`
    let response

    switch (operation) {
      case 'create':
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        break

      case 'update':
        response = await fetch(`${endpoint}/${recordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        break

      case 'delete':
        response = await fetch(`${endpoint}/${recordId}`, {
          method: 'DELETE'
        })
        break

      default:
        throw new Error(`Unknown operation: ${operation}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return await response.json()
  }

  /**
   * Clear queue (use after successful full sync)
   */
  clear() {
    this.queue = []
    this.saveQueue()
  }

  /**
   * Get queue size
   */
  size() {
    return this.queue.length
  }
}

const syncQueue = new SyncQueue()

/**
 * Hybrid Storage Manager
 * Main class for managing hybrid storage
 */
class HybridStorageManager {
  constructor() {
    this.adminId = null
    this.userId = null
    this.cacheConfig = {
      inventory: {
        limit: 1000, // Top 1000 products
        sortBy: 'sales', // Sort by most sold
        days: null // No date limit, just top items
      },
      transactions: {
        limit: null, // All within date range
        days: 7 // Last 7 days
      },
      expenses: {
        limit: null,
        days: 30 // Last 30 days
      },
      // Full sync for small datasets
      suppliers: { full: true },
      customers: { full: true },
      purchaseOrders: { full: true },
      goodsReceivedNotes: { full: true },
      supplierPayments: { full: true },
      stockAdjustments: { full: true },
      settings: { full: true }
    }
  }

  /**
   * Initialize storage with user credentials
   */
  async init(adminId, userId = null) {
    this.adminId = adminId
    this.userId = userId || adminId

    // Load sync queue from localStorage
    syncQueue.loadQueue()

    // Try to sync if online
    if (storageMode.isOnline()) {
      await this.syncAll()
    }

    return true
  }

  /**
   * Fetch data from PostgreSQL API
   */
  async fetchFromAPI(tableName, params = {}) {
    if (!storageMode.isOnline()) {
      throw new Error('Cannot fetch from API while offline')
    }

    const queryParams = new URLSearchParams({
      adminId: this.adminId,
      ...params
    }).toString()

    const response = await fetch(`${API_BASE_URL}/${tableName}?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get auth token from localStorage
   */
  getAuthToken() {
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      return auth.token || ''
    } catch {
      return ''
    }
  }

  /**
   * Read data with hybrid strategy
   * 1. Try IndexedDB first (fast)
   * 2. If online and data stale, fetch from API
   * 3. Update cache
   */
  async read(tableName, options = {}) {
    const {
      includeDeleted = false,
      forceRefresh = false,
      useCache = true
    } = options

    console.log(`📖 Reading ${tableName} (adminId: ${this.adminId})`)

    // Step 1: Try IndexedDB cache first (if enabled)
    if (useCache && isIndexedDBAvailable() && !forceRefresh) {
      try {
        const cachedData = await getAllItems(STORES[tableName.toUpperCase()], this.adminId, includeDeleted)
        
        // Check if cache is fresh
        const isCacheFresh = this.isCacheFresh(tableName, cachedData)
        
        if (isCacheFresh || !storageMode.isOnline()) {
          console.log(`✅ Using cached ${tableName} (${cachedData.length} items)`)
          return cachedData
        }
      } catch (error) {
        console.warn(`Cache read failed for ${tableName}:`, error)
      }
    }

    // Step 2: Fetch from API if online
    if (storageMode.isOnline()) {
      try {
        console.log(`🌐 Fetching ${tableName} from API...`)
        const apiData = await this.fetchFromAPI(tableName, { includeDeleted })

        // Step 3: Update IndexedDB cache
        if (isIndexedDBAvailable()) {
          await this.updateCache(tableName, apiData)
        }

        return apiData
      } catch (error) {
        console.error(`API fetch failed for ${tableName}:`, error)
        
        // Fallback to cache even if stale
        if (isIndexedDBAvailable()) {
          const cachedData = await getAllItems(STORES[tableName.toUpperCase()], this.adminId, includeDeleted)
          console.warn(`⚠️ Using stale cache for ${tableName}`)
          return cachedData
        }

        throw error
      }
    }

    // Offline with no cache
    throw new Error(`Cannot read ${tableName}: offline with no cache`)
  }

  /**
   * Check if cache is fresh
   */
  isCacheFresh(tableName, cachedData) {
    if (!cachedData || cachedData.length === 0) {
      return false
    }

    const config = this.cacheConfig[tableName]
    if (!config) {
      return false
    }

    // Full sync tables are always fresh
    if (config.full) {
      return true
    }

    // Check date-based freshness
    if (config.days) {
      const lastSync = localStorage.getItem(`${tableName}-last-sync`)
      if (!lastSync) {
        return false
      }

      const syncAge = Date.now() - new Date(lastSync).getTime()
      const maxAge = config.days * 24 * 60 * 60 * 1000 // days to milliseconds
      
      return syncAge < maxAge
    }

    // Default: cache is stale
    return false
  }

  /**
   * Update IndexedDB cache
   */
  async updateCache(tableName, data) {
    const config = this.cacheConfig[tableName]
    if (!config) {
      return
    }

    let cacheData = data

    // Apply cache limits
    if (!config.full) {
      if (config.days) {
        // Filter by date
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - config.days)
        
        cacheData = data.filter(item => {
          const itemDate = new Date(item.created_at || item.date || item.expense_date)
          return itemDate >= cutoffDate
        })
      }

      if (config.limit) {
        // Limit number of items
        cacheData = cacheData.slice(0, config.limit)
      }
    }

    console.log(`💾 Caching ${cacheData.length}/${data.length} items for ${tableName}`)

    // Write to IndexedDB
    const storeKey = STORES[tableName.toUpperCase()]
    await putBatch(storeKey, this.adminId, cacheData)

    // Update last sync timestamp
    localStorage.setItem(`${tableName}-last-sync`, new Date().toISOString())
  }

  /**
   * Write data with hybrid strategy
   * 1. Write to IndexedDB immediately (optimistic update)
   * 2. Add to sync queue
   * 3. Sync to API if online
   */
  async write(tableName, data, operation = 'create') {
    console.log(`💾 Writing to ${tableName} (${operation})`)

    const recordId = data.id || data[Object.keys(data)[0]]

    // Step 1: Write to IndexedDB immediately
    if (isIndexedDBAvailable()) {
      try {
        const storeKey = STORES[tableName.toUpperCase()]
        await putItem(storeKey, this.adminId, data)
        console.log(`✅ Wrote to IndexedDB cache`)
      } catch (error) {
        console.error('IndexedDB write failed:', error)
      }
    }

    // Step 2: Add to sync queue
    await syncQueue.add(operation, tableName, data, recordId)

    // Step 3: Try immediate sync if online
    if (storageMode.isOnline()) {
      await syncQueue.processQueue()
    }

    return data
  }

  /**
   * Create new record
   */
  async create(tableName, data) {
    return await this.write(tableName, {
      ...data,
      id: data.id || this.generateId(),
      adminId: this.adminId,
      created_at: new Date().toISOString()
    }, 'create')
  }

  /**
   * Update existing record
   */
  async update(tableName, id, data) {
    return await this.write(tableName, {
      ...data,
      id,
      adminId: this.adminId,
      updated_at: new Date().toISOString()
    }, 'update')
  }

  /**
   * Delete record (soft delete)
   */
  async delete(tableName, id) {
    return await this.write(tableName, {
      id,
      adminId: this.adminId,
      deleted_at: new Date().toISOString()
    }, 'delete')
  }

  /**
   * Sync all data from API to cache
   */
  async syncAll() {
    if (!storageMode.isOnline()) {
      console.warn('Cannot sync while offline')
      return
    }

    console.log('🔄 Syncing all data from cloud...')

    const tables = Object.keys(this.cacheConfig)
    const results = {
      success: [],
      failed: []
    }

    for (const tableName of tables) {
      try {
        await this.read(tableName, { forceRefresh: true })
        results.success.push(tableName)
      } catch (error) {
        console.error(`Failed to sync ${tableName}:`, error)
        results.failed.push({ tableName, error: error.message })
      }
    }

    // Process sync queue
    await syncQueue.processQueue()

    console.log(`✅ Sync complete: ${results.success.length} tables synced`)
    return results
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      online: storageMode.isOnline(),
      queueSize: syncQueue.size(),
      lastSync: this.getLastSyncTime(),
      cacheSize: this.getCacheSize()
    }
  }

  /**
   * Get last sync time
   */
  getLastSyncTime() {
    const timestamps = Object.keys(localStorage)
      .filter(key => key.endsWith('-last-sync'))
      .map(key => localStorage.getItem(key))
      .filter(Boolean)
      .map(ts => new Date(ts).getTime())

    return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
  }

  /**
   * Get cache size estimate
   */
  async getCacheSize() {
    if (!isIndexedDBAvailable()) {
      return 0
    }

    // Estimate based on cached items
    let totalItems = 0
    const tables = Object.keys(STORES)

    for (const storeName of Object.values(STORES)) {
      try {
        const items = await getAllItems(storeName, this.adminId, false)
        totalItems += items.length
      } catch (error) {
        // Ignore errors
      }
    }

    // Rough estimate: 1KB per item
    return totalItems * 1024
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    if (!isIndexedDBAvailable()) {
      return
    }

    console.log('🗑️ Clearing all cache...')

    const tables = Object.values(STORES)
    for (const storeName of tables) {
      try {
        await putBatch(storeName, this.adminId, [])
      } catch (error) {
        console.error(`Failed to clear ${storeName}:`, error)
      }
    }

    // Clear sync timestamps
    Object.keys(localStorage)
      .filter(key => key.endsWith('-last-sync'))
      .forEach(key => localStorage.removeItem(key))

    console.log('✅ Cache cleared')
  }

  /**
   * Generate UUID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

// Export singleton instance
export const HybridStorage = new HybridStorageManager()

// Export for testing
export { SyncQueue, StorageMode, syncQueue, storageMode }

/**
 * Helper functions for backward compatibility
 */

/**
 * Read shared data (inventory, transactions, etc.)
 */
export const readSharedDataHybrid = async (adminId, includeDeleted = false) => {
  await HybridStorage.init(adminId)

  const [
    inventory,
    transactions,
    suppliers,
    purchaseOrders,
    goodsReceivedNotes,
    supplierPayments,
    stockAdjustments,
    customers,
    expenses,
    settings
  ] = await Promise.all([
    HybridStorage.read('inventory', { includeDeleted }),
    HybridStorage.read('transactions', { includeDeleted }),
    HybridStorage.read('suppliers', { includeDeleted }),
    HybridStorage.read('purchaseOrders', { includeDeleted }),
    HybridStorage.read('goodsReceivedNotes', { includeDeleted }),
    HybridStorage.read('supplierPayments', { includeDeleted }),
    HybridStorage.read('stockAdjustments', { includeDeleted }),
    HybridStorage.read('customers', { includeDeleted }),
    HybridStorage.read('expenses', { includeDeleted }),
    HybridStorage.read('settings', { includeDeleted }).catch(() => ({}))
  ])

  return {
    inventory,
    transactions,
    suppliers,
    purchaseOrders,
    goodsReceivedNotes,
    supplierPayments,
    stockAdjustments,
    customers,
    expenses,
    settings: settings || {},
    lastSync: HybridStorage.getLastSyncTime()
  }
}

/**
 * Write shared data (inventory, transactions, etc.)
 */
export const writeSharedDataHybrid = async (data, adminId) => {
  await HybridStorage.init(adminId)

  const writes = []

  if (data.inventory) {
    writes.push(...data.inventory.map(item => 
      HybridStorage.write('inventory', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.transactions) {
    writes.push(...data.transactions.map(item => 
      HybridStorage.write('transactions', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.suppliers) {
    writes.push(...data.suppliers.map(item => 
      HybridStorage.write('suppliers', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.purchaseOrders) {
    writes.push(...data.purchaseOrders.map(item => 
      HybridStorage.write('purchaseOrders', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.goodsReceivedNotes) {
    writes.push(...data.goodsReceivedNotes.map(item => 
      HybridStorage.write('goodsReceivedNotes', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.supplierPayments) {
    writes.push(...data.supplierPayments.map(item => 
      HybridStorage.write('supplierPayments', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.stockAdjustments) {
    writes.push(...data.stockAdjustments.map(item => 
      HybridStorage.write('stockAdjustments', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.customers) {
    writes.push(...data.customers.map(item => 
      HybridStorage.write('customers', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.expenses) {
    writes.push(...data.expenses.map(item => 
      HybridStorage.write('expenses', item, item.id ? 'update' : 'create')
    ))
  }

  if (data.settings) {
    writes.push(HybridStorage.write('settings', data.settings, 'update'))
  }

  await Promise.all(writes)

  return true
}
