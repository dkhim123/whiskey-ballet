/**
 * Migrate transactions to set branchId for missing/legacy records
 * Attempts to infer branchId from cashierId or userId if possible
 * @param {string|number} adminId - Admin ID for isolation
 * @param {Array} users - Array of user objects with id and branchId
 * @returns {Promise<{success: boolean, migrated: number}>}
 */
export const migrateTransactionsBranchId = async (adminId = null, users = []) => {
  try {
    const sharedData = await readSharedData(adminId)
    if (!sharedData.transactions || !Array.isArray(sharedData.transactions)) {
      return { success: true, migrated: 0 }
    }
    let migratedCount = 0
    const updatedTransactions = sharedData.transactions.map(txn => {
      if (!txn.branchId || txn.branchId === 'NO_BRANCH' || txn.branchId === null) {
        // Try to infer branchId from cashierId or userId
        let branchId = null
        if (txn.cashierId && users.length > 0) {
          const user = users.find(u => u.id === txn.cashierId)
          branchId = user?.branchId || null
        }
        if (!branchId && txn.userId && users.length > 0) {
          const user = users.find(u => u.id === txn.userId)
          branchId = user?.branchId || null
        }
        if (branchId) {
          migratedCount++
          return { ...txn, branchId }
        } else {
          return { ...txn, branchId: 'NO_BRANCH' }
        }
      }
      return txn
    })
    if (migratedCount > 0) {
      const success = await writeSharedData({ ...sharedData, transactions: updatedTransactions }, adminId)
      return { success, migrated: migratedCount }
    }
    return { success: true, migrated: 0 }
  } catch (error) {
    console.error('Error migrating transactions branchId:', error)
    return { success: false, migrated: 0, error: error.message }
  }
}

/**
 * Validate and fix branch data for missing/invalid branchId values
 * @param {string|number} adminId - Admin ID for isolation
 * @param {Array} users - Array of user objects with id and branchId
 * @returns {Promise<{success: boolean, validated: number}>}
 */
export const validateAndFixBranchData = async (adminId = null, users = []) => {
  try {
    const sharedData = await readSharedData(adminId);
    if (!sharedData.transactions || !Array.isArray(sharedData.transactions)) {
      return { success: true, validated: 0 };
    }

    let validatedCount = 0;
    const updatedTransactions = sharedData.transactions.map(txn => {
      if (!txn.branchId || txn.branchId === 'NO_BRANCH' || txn.branchId === null) {
        let branchId = null;
        if (txn.cashierId && users.length > 0) {
          const user = users.find(u => u.id === txn.cashierId);
          branchId = user?.branchId || null;
        }
        if (branchId) {
          validatedCount++;
          return { ...txn, branchId };
        }
      }
      return txn;
    });

    // Save updated transactions back to storage
    await saveSharedData(adminId, { ...sharedData, transactions: updatedTransactions });
    return { success: true, validated: validatedCount };
  } catch (error) {
    console.error('Error validating and fixing branch data:', error);
    return { success: false, validated: 0 };
  }
};

/**
 * Storage utility that works both in web (localStorage/IndexedDB) and Electron (file system)
 * Now supports user-specific data isolation with IndexedDB for large datasets
 */

import {
  STORES,
  getAllItems,
  putBatch,
  putItem,
  getItem as getIndexedDBItem,
  isIndexedDBAvailable,
  getStorageInfo as getIndexedDBStorageInfo
} from './indexedDBStorage'
import { isMigrationCompleted } from './migrationUtility'

const STORAGE_KEY_PREFIX = 'whiskeyballet-pos-data'
const SHARED_STORAGE_KEY = 'whiskeyballet-pos-shared-data' // New shared storage key
const USE_INDEXEDDB_KEY = 'whiskeyballet-use-indexeddb'

// Check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron
}

// Check if we should use IndexedDB
const shouldUseIndexedDB = () => {
  try {
    // Use IndexedDB as PRIMARY storage if available (not Electron)
    if (!isElectron() && isIndexedDBAvailable()) {
      const useIndexedDB = localStorage.getItem(USE_INDEXEDDB_KEY)
      // Default to TRUE (IndexedDB is primary), unless explicitly disabled
      // This ensures the system can handle 10,000+ products and 3+ years of transactions
      if (useIndexedDB === 'false') {
        return false // Only return false if explicitly disabled
      }
      return true // Use IndexedDB by default
    }
    return false
  } catch (error) {
    console.error('Error checking IndexedDB usage:', error)
    return false
  }
}

// Enable IndexedDB usage
export const enableIndexedDB = () => {
  try {
    localStorage.setItem(USE_INDEXEDDB_KEY, 'true')
    console.log('✅ IndexedDB enabled')
  } catch (error) {
    console.error('Error enabling IndexedDB:', error)
  }
}

// Disable IndexedDB usage (fallback to localStorage)
export const disableIndexedDB = () => {
  try {
    localStorage.setItem(USE_INDEXEDDB_KEY, 'false')
    console.log('ℹ️ IndexedDB disabled, using localStorage')
  } catch (error) {
    console.error('Error disabling IndexedDB:', error)
  }
}

// Get user-specific storage key
const getUserStorageKey = (userId) => {
  if (!userId) {
    console.warn('No userId provided, using global storage key')
    return STORAGE_KEY_PREFIX // Fallback to old behavior for backwards compatibility
  }
  return `${STORAGE_KEY_PREFIX}-user-${userId}`
}

// Initialize storage with default data
const getDefaultData = () => ({
  inventory: [],
  transactions: [],
  suppliers: [],
  purchaseOrders: [],
  goodsReceivedNotes: [],
  supplierPayments: [],
  stockAdjustments: [], // New field for stock adjustments
  customers: [], // New field for customer management
  expenses: [], // New field for expense tracking
  settings: {
    storeName: 'Whiskey Ballet',
    currency: 'KES',
    vatRate: 0.16, // Kenyan VAT rate (16%)
    vatEnabled: true, // VAT-inclusive pricing enabled
    spendingLimitPercentage: 50, // Default spending limit as percentage of income
    enableSpendingAlerts: true,
    lastBackupDate: null // For daily auto-backup tracking
  },
  lastSync: null
})

/**
 * Read data from storage (works in both web and desktop)
 * @param {number|string} userId - The user ID to read data for
 */
export const readData = async (userId = null) => {
  try {
    if (isElectron()) {
      // Desktop mode: read from file system
      const data = await window.electronAPI.readData(userId)
      return data || getDefaultData()
    } else {
      // Web mode: read from localStorage with user-specific key
      const storageKey = getUserStorageKey(userId)
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : getDefaultData()
    }
  } catch (error) {
    console.error('Error reading data:', error)
    return getDefaultData()
  }
}

/**
 * Write data to storage (works in both web and desktop)
 * @param {object} data - The data to write
 * @param {number|string} userId - The user ID to write data for
 */
export const writeData = async (data, userId = null) => {
  try {
    if (isElectron()) {
      // Desktop mode: write to file system
      const result = await window.electronAPI.writeData(data, userId)
      return result.success
    } else {
      // Web mode: write to localStorage with user-specific key
      const storageKey = getUserStorageKey(userId)
      try {
        localStorage.setItem(storageKey, JSON.stringify(data))
        return true
      } catch (error) {
        // Handle QuotaExceededError - storage is full
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          console.warn('⚠️ localStorage is full, attempting to free space...')
          
          // Try to free up space by removing old data
          try {
            // Use reverse loop to avoid index shifting issues during removal
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i)
              if (key && (key.includes('backup') || key.includes('temp'))) {
                localStorage.removeItem(key)
              }
            }
            
            // Try again after cleanup
            localStorage.setItem(storageKey, JSON.stringify(data))
            console.log('✅ Data saved after cleanup')
            return true
          } catch (retryError) {
            console.error('❌ Still out of storage after cleanup. Data too large for localStorage.')
            console.warn('💡 Consider using IndexedDB or exporting old data')
            throw new Error('Storage full: Please export and clear old data, or use desktop app for unlimited storage')
          }
        }
        throw error
      }
    }
  } catch (error) {
    console.error('Error writing data:', error)
    return false
  }
}

/**
 * Export data (desktop only - shows save dialog)
 * @param {object} data - The data to export
 * @param {number|string} userId - The user ID (for filename)
 */
export const exportData = async (data, userId = null) => {
  try {
    if (isElectron()) {
      const userSuffix = userId ? `-user-${userId}` : ''
      const filename = `whiskeyballet-backup${userSuffix}-${new Date().toISOString().split('T')[0]}.json`
      const result = await window.electronAPI.exportData(filename, data)
      return result
    } else {
      // Web fallback: download as file
      const dataStr = JSON.stringify(data, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      const userSuffix = userId ? `-user-${userId}` : ''
      link.download = `whiskeyballet-backup${userSuffix}-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      return { success: true }
    }
  } catch (error) {
    console.error('Error exporting data:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Import data (desktop only - shows open dialog)
 * @param {number|string} userId - The user ID to import data for
 */
export const importData = async (userId = null) => {
  try {
    if (isElectron()) {
      const result = await window.electronAPI.importData()
      return result
    } else {
      // Web fallback: not implemented (would require file input)
      console.warn('Import not available in web mode')
      return { success: false, error: 'Import not available in web mode' }
    }
  } catch (error) {
    console.error('Error importing data:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get storage mode (desktop, indexedDB, or localStorage)
 */
export const getStorageMode = () => {
  if (isElectron()) {
    return 'desktop'
  }
  if (shouldUseIndexedDB()) {
    return 'indexedDB'
  }
  return 'localStorage'
}

/**
 * Get detailed storage type information
 */
export const getStorageType = () => {
  const mode = getStorageMode()
  return {
    mode,
    isPrimary: mode === 'indexedDB' || mode === 'desktop',
    canHandleLargeDatasets: mode === 'indexedDB' || mode === 'desktop',
    maxCapacity: mode === 'desktop' ? 'unlimited' : mode === 'indexedDB' ? '50+ MB' : '~10 MB',
    recommended: mode === 'indexedDB' || mode === 'desktop'
  }
}

/**
 * Check if offline mode is available
 */
export const isOfflineCapable = () => {
  return isElectron() || (typeof localStorage !== 'undefined')
}

// Check if localStorage is available - reuses existing logic
const isLocalStorageAvailable = () => {
  return typeof localStorage !== 'undefined'
}

/**
 * Check if paymentStatus is valid
 */
const isValidPaymentStatus = (status) => {
  return status === 'completed' || status === 'pending'
}

/**
 * Normalize transaction to ensure paymentStatus is set correctly
 * For backward compatibility with transactions created before paymentStatus was added
 * Exported for unit testing
 */
export const normalizeTransaction = (transaction) => {
  // If paymentStatus is already set to a valid value, keep it
  if (isValidPaymentStatus(transaction.paymentStatus)) {
    return transaction
  }
  
  // Validate paymentMethod exists, default to cash if missing
  const method = transaction.paymentMethod || 'cash'
  
  // For transactions without paymentStatus, infer it from paymentMethod
  // Credit sales should be pending, everything else (cash, mpesa, or unknown) should be completed
  const paymentStatus = method === 'credit' ? 'pending' : 'completed'
  
  return {
    ...transaction,
    paymentMethod: method, // Ensure paymentMethod is set
    paymentStatus
  }
}

/**
 * Read shared data (inventory, transactions - now per-admin isolated)
 * @param {number|string} adminId - The admin ID to read data for (null for legacy shared data)
 * @param {boolean} includeDeleted - Whether to include soft-deleted items (default: false)
 * This ensures data isolation: each admin has their own inventory, transactions, etc.
 */
// Cache version check to avoid repeated localStorage access
let cachedNormalizationVersion = null
let hasCheckedVersion = false

export const readSharedData = async (adminId = null, includeDeleted = false) => {
  const NORMALIZATION_VERSION_KEY = 'whiskeyballet-normalization-version'
  const CURRENT_VERSION = '1' // Increment this when normalization logic changes
  
  console.log(`📖 Storage: Reading shared data for adminId: ${adminId}${includeDeleted ? ' (including deleted)' : ''}`)
  
  try {
    let data
    
    if (isElectron()) {
      // Desktop mode: read from admin-specific or shared file
      const fileKey = adminId ? `admin-${adminId}` : 'shared'
      data = await window.electronAPI.readData(fileKey)
      data = data || getDefaultData()
      
      // Filter deleted items if needed (Electron stores all items)
      if (!includeDeleted && data) {
        const storesToFilter = ['inventory', 'transactions', 'suppliers', 'purchaseOrders', 
                               'goodsReceivedNotes', 'supplierPayments', 'stockAdjustments', 
                               'customers', 'expenses']
        storesToFilter.forEach(store => {
          if (Array.isArray(data[store])) {
            data[store] = data[store].filter(item => !item.deletedAt)
          }
        })
      }
    } else if (shouldUseIndexedDB()) {
      // Web mode with IndexedDB (PRIMARY STORAGE - supports 10,000+ items and 3+ years data)
      try {
        data = {
          inventory: await getAllItems(STORES.INVENTORY, adminId, includeDeleted),
          transactions: await getAllItems(STORES.TRANSACTIONS, adminId, includeDeleted),
          suppliers: await getAllItems(STORES.SUPPLIERS, adminId, includeDeleted),
          purchaseOrders: await getAllItems(STORES.PURCHASE_ORDERS, adminId, includeDeleted),
          goodsReceivedNotes: await getAllItems(STORES.GOODS_RECEIVED_NOTES, adminId, includeDeleted),
          supplierPayments: await getAllItems(STORES.SUPPLIER_PAYMENTS, adminId, includeDeleted),
          stockAdjustments: await getAllItems(STORES.STOCK_ADJUSTMENTS, adminId, includeDeleted),
          customers: await getAllItems(STORES.CUSTOMERS, adminId, includeDeleted),
          expenses: await getAllItems(STORES.EXPENSES, adminId, includeDeleted),
          settings: await getIndexedDBItem(STORES.SETTINGS, adminId, adminId) || getDefaultData().settings,
          lastSync: null
        }
        
        // Auto-migrate from localStorage if IndexedDB is empty but localStorage has data
        const hasIndexedDBData = data.inventory.length > 0 || data.transactions.length > 0
        if (!hasIndexedDBData) {
          const storageKey = adminId ? `${STORAGE_KEY_PREFIX}-admin-${adminId}` : SHARED_STORAGE_KEY
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const localData = JSON.parse(stored)
            const hasLocalData = (localData.inventory && localData.inventory.length > 0) || 
                                (localData.transactions && localData.transactions.length > 0)
            
            if (hasLocalData) {
              console.log('🔄 Auto-migrating data from localStorage to IndexedDB...')
              // Write localStorage data to IndexedDB
              await writeSharedData(localData, adminId)
              data = localData
              console.log('✅ Auto-migration completed')
            }
          }
        }
      } catch (indexedDBError) {
        console.warn('IndexedDB read failed, falling back to localStorage:', indexedDBError)
        // Fallback to localStorage
        const storageKey = adminId ? `${STORAGE_KEY_PREFIX}-admin-${adminId}` : SHARED_STORAGE_KEY
        const stored = localStorage.getItem(storageKey)
        data = stored ? JSON.parse(stored) : getDefaultData()
        
        // Filter deleted items if needed (localStorage stores all items)
        if (!includeDeleted && data) {
          const storesToFilter = ['inventory', 'transactions', 'suppliers', 'purchaseOrders', 
                                 'goodsReceivedNotes', 'supplierPayments', 'stockAdjustments', 
                                 'customers', 'expenses']
          storesToFilter.forEach(store => {
            if (Array.isArray(data[store])) {
              data[store] = data[store].filter(item => !item.deletedAt)
            }
          })
        }
      }
    } else {
      // Web mode with localStorage: read from admin-specific or shared localStorage key
      const storageKey = adminId ? `${STORAGE_KEY_PREFIX}-admin-${adminId}` : SHARED_STORAGE_KEY
      const stored = localStorage.getItem(storageKey)
      data = stored ? JSON.parse(stored) : getDefaultData()
      
      // Filter deleted items if needed (localStorage stores all items)
      if (!includeDeleted && data) {
        const storesToFilter = ['inventory', 'transactions', 'suppliers', 'purchaseOrders', 
                               'goodsReceivedNotes', 'supplierPayments', 'stockAdjustments', 
                               'customers', 'expenses']
        storesToFilter.forEach(store => {
          if (Array.isArray(data[store])) {
            data[store] = data[store].filter(item => !item.deletedAt)
          }
        })
      }
    }
    
    // Check if transactions need normalization (cached for session)
    if (!hasCheckedVersion) {
      cachedNormalizationVersion = isLocalStorageAvailable() ? localStorage.getItem(NORMALIZATION_VERSION_KEY) : null
      hasCheckedVersion = true
    }
    
    const needsNormalization = cachedNormalizationVersion !== CURRENT_VERSION
    
    // Normalize transactions only if version doesn't match
    if (needsNormalization && data.transactions && Array.isArray(data.transactions)) {
      data.transactions = data.transactions.map(normalizeTransaction)
      
      // Update version flag and cache
      if (isLocalStorageAvailable()) {
        localStorage.setItem(NORMALIZATION_VERSION_KEY, CURRENT_VERSION)
        cachedNormalizationVersion = CURRENT_VERSION
      }
    }
    
    return data
  } catch (error) {
    console.error('Error reading shared data:', error)
    return getDefaultData()
  }
}

/**
 * Write shared data (inventory, transactions - now per-admin isolated)
 * @param {object} data - The data to write
 * @param {number|string} adminId - The admin ID to write data for (null for legacy shared data)
 * This ensures data isolation: each admin has their own inventory, transactions, etc.
 */
export const writeSharedData = async (data, adminId = null) => {
  console.log(`💾 Storage: Writing shared data for adminId: ${adminId}`)
  console.log(`📊 Data summary:`, {
    inventory: data.inventory?.length || 0,
    transactions: data.transactions?.length || 0,
    purchaseOrders: data.purchaseOrders?.length || 0,
    suppliers: data.suppliers?.length || 0,
    customers: data.customers?.length || 0,
    expenses: data.expenses?.length || 0
  })
  
  try {
    if (isElectron()) {
      // Desktop mode: write to admin-specific or shared file
      const fileKey = adminId ? `admin-${adminId}` : 'shared'
      const result = await window.electronAPI.writeData(data, fileKey)
      return result.success
    } else if (shouldUseIndexedDB()) {
      // Web mode with IndexedDB: write to IndexedDB stores
      console.log('🗄️ Attempting IndexedDB write...')
      try {
        // Write each data array to its corresponding store
        const writePromises = []
        
        if (data.inventory && Array.isArray(data.inventory)) {
          writePromises.push(putBatch(STORES.INVENTORY, adminId, data.inventory))
        }
        
        if (data.transactions && Array.isArray(data.transactions)) {
          writePromises.push(putBatch(STORES.TRANSACTIONS, adminId, data.transactions))
        }
        
        if (data.suppliers && Array.isArray(data.suppliers)) {
          writePromises.push(putBatch(STORES.SUPPLIERS, adminId, data.suppliers))
        }
        
        if (data.purchaseOrders && Array.isArray(data.purchaseOrders)) {
          writePromises.push(putBatch(STORES.PURCHASE_ORDERS, adminId, data.purchaseOrders))
        }
        
        if (data.goodsReceivedNotes && Array.isArray(data.goodsReceivedNotes)) {
          writePromises.push(putBatch(STORES.GOODS_RECEIVED_NOTES, adminId, data.goodsReceivedNotes))
        }
        
        if (data.supplierPayments && Array.isArray(data.supplierPayments)) {
          writePromises.push(putBatch(STORES.SUPPLIER_PAYMENTS, adminId, data.supplierPayments))
        }
        
        if (data.stockAdjustments && Array.isArray(data.stockAdjustments)) {
          writePromises.push(putBatch(STORES.STOCK_ADJUSTMENTS, adminId, data.stockAdjustments))
        }
        
        if (data.customers && Array.isArray(data.customers)) {
          writePromises.push(putBatch(STORES.CUSTOMERS, adminId, data.customers))
        }
        
        if (data.expenses && Array.isArray(data.expenses)) {
          writePromises.push(putBatch(STORES.EXPENSES, adminId, data.expenses))
        }
        
        if (data.settings) {
          writePromises.push(putItem(STORES.SETTINGS, adminId, data.settings))
        }
        
        await Promise.all(writePromises)
        console.log(`✅ Storage: All data written successfully for adminId: ${adminId}`)
        return true
      } catch (indexedDBError) {
        console.error('❌ IndexedDB write failed:', indexedDBError)
        console.error('Error details:', {
          name: indexedDBError.name,
          message: indexedDBError.message,
          stack: indexedDBError.stack
        })
        console.warn('⚠️ Falling back to localStorage...')
        
        // Fallback to localStorage
        const storageKey = adminId ? `${STORAGE_KEY_PREFIX}-admin-${adminId}` : SHARED_STORAGE_KEY
        try {
          localStorage.setItem(storageKey, JSON.stringify(data))
          console.log('✅ Data saved to localStorage fallback')
          return true
        } catch (localStorageError) {
          if (localStorageError.name === 'QuotaExceededError' || localStorageError.code === 22) {
            console.error('❌ Storage full: Cannot save data')
            console.warn('💡 SOLUTION: Enable IndexedDB or export old data')
            alert('Storage full! Please export old data or enable IndexedDB in your browser settings.')
            return false
          }
          console.error('❌ localStorage fallback also failed:', localStorageError)
          throw localStorageError
        }
      }
    } else {
      // Web mode with localStorage: write to admin-specific or shared localStorage key with quota handling
      const storageKey = adminId ? `${STORAGE_KEY_PREFIX}-admin-${adminId}` : SHARED_STORAGE_KEY
      try {
        localStorage.setItem(storageKey, JSON.stringify(data))
        return true
      } catch (error) {
        // Handle QuotaExceededError - storage is full
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          console.warn('⚠️ localStorage is full for admin data, attempting cleanup...')
          
          try {
            // Try to free up space - use reverse loop to avoid index shifting
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i)
              if (key && (key.includes('backup') || key.includes('temp') || key.includes('cache'))) {
                localStorage.removeItem(key)
              }
            }
            
            // Try again after cleanup
            localStorage.setItem(storageKey, JSON.stringify(data))
            console.log('✅ Admin data saved after cleanup')
            return true
          } catch (retryError) {
            console.error('❌ Storage full: Cannot save admin data')
            console.warn('💡 SOLUTION: Export old transactions/data or use desktop app')
            // Don't throw - just log and return false
            return false
          }
        }
        throw error
      }
    }
  } catch (error) {
    console.error('Error writing shared data:', error)
    return false
  }
}

/**
 * Get available storage space (web only)
 * @returns {object} Storage info with used and available space
 */
export const getStorageInfo = async () => {
  try {
    if (isElectron()) {
      return { mode: 'desktop', unlimited: true }
    }
    
    if (shouldUseIndexedDB()) {
      // Get IndexedDB storage info
      const info = await getIndexedDBStorageInfo()
      return {
        mode: 'indexedDB',
        ...info
      }
    }
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      const used = estimate.usage || 0
      const quota = estimate.quota || 0
      const available = quota - used
      const percentUsed = quota > 0 ? (used / quota * 100).toFixed(2) : 0
      
      return {
        mode: 'web',
        used: Math.round(used / 1024 / 1024 * 100) / 100, // MB
        quota: Math.round(quota / 1024 / 1024 * 100) / 100, // MB
        available: Math.round(available / 1024 / 1024 * 100) / 100, // MB
        percentUsed: parseFloat(percentUsed)
      }
    }
    
    // Fallback - estimate localStorage usage
    let totalSize = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const item = localStorage.getItem(key)
        totalSize += key.length + (item ? item.length : 0)
      }
    }
    
    return {
      mode: 'web',
      used: Math.round(totalSize / 1024 / 1024 * 100) / 100, // MB
      estimatedQuota: 10, // MB (typical localStorage limit)
      warning: 'Using localStorage estimate'
    }
  } catch (error) {
    console.error('Error getting storage info:', error)
    return { mode: 'web', error: error.message }
  }
}

/**
 * Migrate existing transactions to ensure paymentStatus is set
 * This is a one-time migration for transactions created before paymentStatus was added
 * @returns {Promise<{success: boolean, migrated: number}>}
 */
export const migrateTransactionsPaymentStatus = async () => {
  const MIGRATION_FLAG_KEY = 'whiskeyballet-payment-status-migration-done'
  
  try {
    // Check if migration has already been completed
    if (isLocalStorageAvailable() && localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
      return { success: true, migrated: 0, alreadyMigrated: true }
    }
    
    const data = await readSharedData()
    
    if (!data.transactions || !Array.isArray(data.transactions)) {
      // Mark as migrated even if no transactions exist
      if (isLocalStorageAvailable()) {
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
      }
      return { success: true, migrated: 0 }
    }
    
    let migratedCount = 0
    const updatedTransactions = data.transactions.map(transaction => {
      // Check if paymentStatus needs to be set using helper
      if (!isValidPaymentStatus(transaction.paymentStatus)) {
        migratedCount++
        return normalizeTransaction(transaction)
      }
      return transaction
    })
    
    if (migratedCount > 0) {
      // Save the migrated data back
      const success = await writeSharedData({
        ...data,
        transactions: updatedTransactions
      })
      
      if (success) {
        // Mark migration as completed
        if (isLocalStorageAvailable()) {
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
        }
        console.log(`✅ Migrated ${migratedCount} transactions to include paymentStatus`)
      }
      
      return { success, migrated: migratedCount }
    }
    
    // No transactions needed migration, mark as completed
    if (isLocalStorageAvailable()) {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    }
    
    return { success: true, migrated: 0 }
  } catch (error) {
    console.error('Error migrating transactions:', error)
    return { success: false, migrated: 0, error: error.message }
  }
}

// Cache for IndexedDB functions to avoid repeated dynamic imports
let indexedDBFunctionsCache = null

/**
 * Get IndexedDB functions (cached to avoid repeated imports)
 */
const getIndexedDBFunctions = async () => {
  if (!indexedDBFunctionsCache) {
    indexedDBFunctionsCache = await import('./indexedDBStorage')
  }
  return indexedDBFunctionsCache
}

/**
 * Get deleted items from a specific store (works with all storage modes)
 * @param {string} storeName - Name of the data store ('inventory', 'transactions', etc.)
 * @param {string|number} adminId - Admin ID for isolation
 * @returns {Promise<Array>} Array of deleted items
 */
export const getDeletedItems = async (storeName, adminId) => {
  try {
    if (shouldUseIndexedDB()) {
      // Use IndexedDB-specific function (cached)
      const { getDeletedItems: getDeletedItemsIDB } = await getIndexedDBFunctions()
      return await getDeletedItemsIDB(storeName, adminId)
    } else {
      // For localStorage/desktop: read shared data and filter deleted items
      const sharedData = await readSharedData(adminId)
      const dataArray = sharedData[storeName] || []
      
      // Filter to only include items with deletedAt field
      const deletedItems = dataArray.filter(item => item.deletedAt != null)
      
      console.log(`🗑️ Storage: Retrieved ${deletedItems.length} deleted items from ${storeName} for adminId: ${adminId}`)
      return deletedItems
    }
  } catch (error) {
    console.error(`Error getting deleted items from ${storeName}:`, error)
    return []
  }
}

/**
 * Restore a single deleted item (works with all storage modes)
 * @param {string} storeName - Name of the data store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {string|number} itemId - Item ID to restore
 * @returns {Promise<boolean>} Success status
 */
export const restoreItem = async (storeName, adminId, itemId) => {
  try {
    if (shouldUseIndexedDB()) {
      // Use IndexedDB-specific function (cached)
      const { restoreItem: restoreItemIDB } = await getIndexedDBFunctions()
      return await restoreItemIDB(storeName, adminId, itemId)
    } else {
      // For localStorage/desktop: read, modify, and write back
      const sharedData = await readSharedData(adminId)
      const dataArray = sharedData[storeName] || []
      
      // Find the item and remove deletedAt/deletedBy fields
      let restored = false
      const updatedArray = dataArray.map(item => {
        if (item.id === itemId && item.deletedAt) {
          restored = true
          const restoredItem = { ...item }
          delete restoredItem.deletedAt
          delete restoredItem.deletedBy
          return restoredItem
        }
        return item
      })
      
      if (!restored) {
        console.warn(`⚠️ Item ${itemId} not found or not deleted in ${storeName}`)
        return false
      }
      
      // Write back the updated data
      const success = await writeSharedData({
        ...sharedData,
        [storeName]: updatedArray
      }, adminId)
      
      if (success) {
        console.log(`♻️ Storage: Restored item ${itemId} in ${storeName}`)
      }
      
      return success
    }
  } catch (error) {
    console.error(`Error restoring item ${itemId} from ${storeName}:`, error)
    return false
  }
}

/**
 * Restore all items deleted within a time range (works with all storage modes)
 * @param {string|number} adminId - Admin ID for isolation
 * @param {string} startTimestamp - ISO timestamp start of range
 * @param {string} endTimestamp - ISO timestamp end of range
 * @returns {Promise<{results: Object, totalRestored: number, totalFailed: number}>}
 */
export const restoreAllDataByTimeRange = async (adminId, startTimestamp, endTimestamp) => {
  try {
    if (shouldUseIndexedDB()) {
      // Use IndexedDB-specific function (cached)
      const { restoreAllDataByTimeRange: restoreAllIDB } = await getIndexedDBFunctions()
      return await restoreAllIDB(adminId, startTimestamp, endTimestamp)
    } else {
      // For localStorage/desktop: restore items from all stores
      console.log(`♻️ Storage: Starting batch restore for adminId: ${adminId}`)
      
      const sharedData = await readSharedData(adminId)
      const results = {}
      let totalRestored = 0
      let totalFailed = 0
      
      // List of stores to check
      const storesToRestore = [
        'inventory',
        'transactions',
        'suppliers',
        'purchaseOrders',
        'goodsReceivedNotes',
        'supplierPayments',
        'stockAdjustments',
        'customers',
        'expenses'
      ]
      
      const updatedData = { ...sharedData }
      
      for (const storeName of storesToRestore) {
        const dataArray = sharedData[storeName] || []
        let restoredCount = 0
        let failedCount = 0
        
        // Restore items within the time range
        const updatedArray = dataArray.map(item => {
          if (item.deletedAt && 
              item.deletedAt >= startTimestamp && 
              item.deletedAt <= endTimestamp) {
            restoredCount++
            const restoredItem = { ...item }
            delete restoredItem.deletedAt
            delete restoredItem.deletedBy
            return restoredItem
          }
          return item
        })
        
        updatedData[storeName] = updatedArray
        results[storeName] = { restored: restoredCount, failed: failedCount }
        totalRestored += restoredCount
        totalFailed += failedCount
      }
      
      // Write back all updated data
      const success = await writeSharedData(updatedData, adminId)
      
      if (!success) {
        console.error('❌ Failed to write restored data')
        // If write fails, all items that were counted as restored should be counted as failed
        return { results: {}, totalRestored: 0, totalFailed: totalRestored }
      }
      
      console.log(`✅ Batch restore complete: ${totalRestored} total restored, ${totalFailed} total failed`)
      return { results, totalRestored, totalFailed }
    }
  } catch (error) {
    console.error('Error in batch restore:', error)
    throw error
  }
}

export const migrateDatabaseIndexes = async () => {
  try {
    const db = await getDB();

    // Check and add adminId index to transactions store
    const transactionsStore = db.transaction(STORES.TRANSACTIONS, 'readwrite').objectStore(STORES.TRANSACTIONS);
    if (!transactionsStore.indexNames.contains('adminId')) {
      transactionsStore.createIndex('adminId', 'adminId', { unique: false });
      console.log('✅ Added adminId index to transactions store');
    }

    // Check and add adminId index to inventory store
    const inventoryStore = db.transaction(STORES.INVENTORY, 'readwrite').objectStore(STORES.INVENTORY);
    if (!inventoryStore.indexNames.contains('adminId')) {
      inventoryStore.createIndex('adminId', 'adminId', { unique: false });
      console.log('✅ Added adminId index to inventory store');
    }

    console.log('✅ Database indexes migration completed successfully');
  } catch (error) {
    console.error('❌ Error migrating database indexes:', error);
  }
};
