/**
 * Data Migration Utility
 * Migrates data from localStorage to IndexedDB with admin isolation support
 */

import {
  STORES,
  putBatch,
  putItem,
  getAllItems,
  isIndexedDBAvailable
} from './indexedDBStorage'

const STORAGE_KEY_PREFIX = 'whiskeyballet-pos-data'
const SHARED_STORAGE_KEY = 'whiskeyballet-pos-shared-data'
const MIGRATION_FLAG_KEY = 'whiskeyballet-indexeddb-migration-completed'
const MIGRATION_VERSION_KEY = 'whiskeyballet-indexeddb-migration-version'
const CURRENT_MIGRATION_VERSION = '1.0'

/**
 * Check if migration has already been completed
 */
export const isMigrationCompleted = () => {
  try {
    const completed = localStorage.getItem(MIGRATION_FLAG_KEY)
    const version = localStorage.getItem(MIGRATION_VERSION_KEY)
    return completed === 'true' && version === CURRENT_MIGRATION_VERSION
  } catch (error) {
    console.error('Error checking migration status:', error)
    return false
  }
}

/**
 * Mark migration as completed
 */
const markMigrationCompleted = () => {
  try {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION)
  } catch (error) {
    console.error('Error marking migration as completed:', error)
  }
}

/**
 * Get default data structure
 */
const getDefaultData = () => ({
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
  lastSync: null
})

/**
 * Get localStorage key for admin
 */
const getAdminStorageKey = (adminId) => {
  if (!adminId) {
    return SHARED_STORAGE_KEY
  }
  return `${STORAGE_KEY_PREFIX}-admin-${adminId}`
}

/**
 * Read data from localStorage for a specific admin
 */
const readLocalStorageData = (adminId) => {
  try {
    const storageKey = getAdminStorageKey(adminId)
    const stored = localStorage.getItem(storageKey)
    
    if (stored) {
      const data = JSON.parse(stored)
      return data
    }
    
    return null
  } catch (error) {
    console.error(`Error reading localStorage for admin ${adminId}:`, error)
    return null
  }
}

/**
 * Migrate a single data array to IndexedDB
 */
const migrateDataArray = async (storeName, adminId, dataArray, progressCallback) => {
  if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
    return { success: 0, errors: 0, total: 0 }
  }

  try {
    // Migrate in batches of 100 for better performance
    const batchSize = 100
    let totalSuccess = 0
    let totalErrors = 0

    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize)
      
      if (progressCallback) {
        progressCallback({
          storeName,
          current: i,
          total: dataArray.length,
          percentage: Math.round((i / dataArray.length) * 100)
        })
      }

      const result = await putBatch(storeName, adminId, batch)
      totalSuccess += result.success
      totalErrors += result.errors
    }

    if (progressCallback) {
      progressCallback({
        storeName,
        current: dataArray.length,
        total: dataArray.length,
        percentage: 100
      })
    }

    return {
      success: totalSuccess,
      errors: totalErrors,
      total: dataArray.length
    }
  } catch (error) {
    console.error(`Error migrating ${storeName}:`, error)
    return {
      success: 0,
      errors: dataArray.length,
      total: dataArray.length,
      error: error.message
    }
  }
}

/**
 * Migrate settings for an admin
 */
const migrateSettings = async (adminId, settings) => {
  if (!settings) {
    settings = getDefaultData().settings
  }

  try {
    await putItem(STORES.SETTINGS, adminId, settings)
    return { success: true }
  } catch (error) {
    console.error('Error migrating settings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Migrate all data for a specific admin from localStorage to IndexedDB
 */
export const migrateAdminData = async (adminId, progressCallback) => {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available in this browser')
  }

  try {
    console.log(`🔄 Starting migration for admin ${adminId}...`)
    
    // Read data from localStorage
    const localData = readLocalStorageData(adminId)
    
    if (!localData) {
      console.log(`ℹ️ No localStorage data found for admin ${adminId}`)
      return {
        success: true,
        message: 'No data to migrate',
        details: {}
      }
    }

    const migrationResults = {}

    // Migrate inventory
    if (progressCallback) progressCallback({ phase: 'Migrating inventory...' })
    migrationResults.inventory = await migrateDataArray(
      STORES.INVENTORY,
      adminId,
      localData.inventory,
      progressCallback
    )

    // Migrate transactions
    if (progressCallback) progressCallback({ phase: 'Migrating transactions...' })
    migrationResults.transactions = await migrateDataArray(
      STORES.TRANSACTIONS,
      adminId,
      localData.transactions,
      progressCallback
    )

    // Migrate suppliers
    if (progressCallback) progressCallback({ phase: 'Migrating suppliers...' })
    migrationResults.suppliers = await migrateDataArray(
      STORES.SUPPLIERS,
      adminId,
      localData.suppliers,
      progressCallback
    )

    // Migrate purchase orders
    if (progressCallback) progressCallback({ phase: 'Migrating purchase orders...' })
    migrationResults.purchaseOrders = await migrateDataArray(
      STORES.PURCHASE_ORDERS,
      adminId,
      localData.purchaseOrders,
      progressCallback
    )

    // Migrate goods received notes
    if (progressCallback) progressCallback({ phase: 'Migrating goods received notes...' })
    migrationResults.goodsReceivedNotes = await migrateDataArray(
      STORES.GOODS_RECEIVED_NOTES,
      adminId,
      localData.goodsReceivedNotes,
      progressCallback
    )

    // Migrate supplier payments
    if (progressCallback) progressCallback({ phase: 'Migrating supplier payments...' })
    migrationResults.supplierPayments = await migrateDataArray(
      STORES.SUPPLIER_PAYMENTS,
      adminId,
      localData.supplierPayments,
      progressCallback
    )

    // Migrate stock adjustments
    if (progressCallback) progressCallback({ phase: 'Migrating stock adjustments...' })
    migrationResults.stockAdjustments = await migrateDataArray(
      STORES.STOCK_ADJUSTMENTS,
      adminId,
      localData.stockAdjustments,
      progressCallback
    )

    // Migrate customers
    if (progressCallback) progressCallback({ phase: 'Migrating customers...' })
    migrationResults.customers = await migrateDataArray(
      STORES.CUSTOMERS,
      adminId,
      localData.customers,
      progressCallback
    )

    // Migrate expenses
    if (progressCallback) progressCallback({ phase: 'Migrating expenses...' })
    migrationResults.expenses = await migrateDataArray(
      STORES.EXPENSES,
      adminId,
      localData.expenses,
      progressCallback
    )

    // Migrate settings
    if (progressCallback) progressCallback({ phase: 'Migrating settings...' })
    migrationResults.settings = await migrateSettings(adminId, localData.settings)

    console.log('✅ Migration completed:', migrationResults)

    return {
      success: true,
      message: 'Migration completed successfully',
      details: migrationResults
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

/**
 * Migrate all admins found in localStorage
 */
export const migrateAllAdmins = async (progressCallback) => {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available in this browser')
  }

  try {
    console.log('🔄 Starting migration for all admins...')
    
    // Find all admin storage keys in localStorage
    const adminIds = []
    const sharedDataExists = localStorage.getItem(SHARED_STORAGE_KEY) !== null
    
    if (sharedDataExists) {
      adminIds.push(null) // null represents shared/legacy data
    }

    // Look for admin-specific keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`${STORAGE_KEY_PREFIX}-admin-`)) {
        const adminId = key.replace(`${STORAGE_KEY_PREFIX}-admin-`, '')
        if (adminId && !adminIds.includes(adminId)) {
          adminIds.push(adminId)
        }
      }
    }

    if (adminIds.length === 0) {
      console.log('ℹ️ No admin data found in localStorage')
      return {
        success: true,
        message: 'No data to migrate',
        admins: []
      }
    }

    console.log(`📊 Found ${adminIds.length} admin(s) to migrate:`, adminIds)

    const results = []

    for (const adminId of adminIds) {
      if (progressCallback) {
        progressCallback({
          phase: `Migrating admin ${adminId || 'shared'}...`,
          adminId
        })
      }

      try {
        const result = await migrateAdminData(adminId, progressCallback)
        results.push({
          adminId,
          ...result
        })
      } catch (error) {
        console.error(`Error migrating admin ${adminId}:`, error)
        results.push({
          adminId,
          success: false,
          error: error.message
        })
      }
    }

    // Mark migration as completed
    markMigrationCompleted()

    return {
      success: true,
      message: `Migrated ${adminIds.length} admin(s)`,
      admins: results
    }
  } catch (error) {
    console.error('❌ Migration of all admins failed:', error)
    throw error
  }
}

/**
 * Verify migration by comparing counts
 */
export const verifyMigration = async (adminId) => {
  try {
    console.log(`🔍 Verifying migration for admin ${adminId}...`)

    // Read from localStorage
    const localData = readLocalStorageData(adminId)
    
    if (!localData) {
      return {
        success: true,
        message: 'No localStorage data to verify'
      }
    }

    // Read from IndexedDB
    const verification = {}

    for (const [key, storeName] of Object.entries({
      inventory: STORES.INVENTORY,
      transactions: STORES.TRANSACTIONS,
      suppliers: STORES.SUPPLIERS,
      purchaseOrders: STORES.PURCHASE_ORDERS,
      goodsReceivedNotes: STORES.GOODS_RECEIVED_NOTES,
      supplierPayments: STORES.SUPPLIER_PAYMENTS,
      stockAdjustments: STORES.STOCK_ADJUSTMENTS,
      customers: STORES.CUSTOMERS,
      expenses: STORES.EXPENSES
    })) {
      const localCount = localData[key]?.length || 0
      const indexedDBItems = await getAllItems(storeName, adminId)
      const indexedDBCount = indexedDBItems.length

      verification[key] = {
        localStorage: localCount,
        indexedDB: indexedDBCount,
        match: localCount === indexedDBCount
      }
    }

    const allMatch = Object.values(verification).every(v => v.match)

    console.log('✅ Verification results:', verification)

    return {
      success: allMatch,
      message: allMatch ? 'All data verified successfully' : 'Some data counts do not match',
      details: verification
    }
  } catch (error) {
    console.error('Error verifying migration:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Rollback migration (restore from localStorage backup if needed)
 */
export const rollbackMigration = () => {
  try {
    localStorage.removeItem(MIGRATION_FLAG_KEY)
    localStorage.removeItem(MIGRATION_VERSION_KEY)
    console.log('✅ Migration rollback completed - migration flags removed')
    return { success: true }
  } catch (error) {
    console.error('Error during rollback:', error)
    return { success: false, error: error.message }
  }
}
