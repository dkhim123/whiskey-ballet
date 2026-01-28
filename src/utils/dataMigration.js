/**
 * Data Migration Utility
 * Ensures all data has branchId for multi-branch isolation
 */

import { readSharedData, writeSharedData } from './storage'
import { getAdminIdForStorage } from './auth'

/**
 * Migrate existing data to add branchId to items that don't have it
 * @param {Object} currentUser - Current user object
 * @param {string} defaultBranchId - Default branchId to assign to items without one
 */
export async function migrateDataToBranchIsolation(currentUser, defaultBranchId) {
  try {
    console.log('🔄 Starting data migration for branch isolation...')
    
    const adminId = getAdminIdForStorage(currentUser)
    const sharedData = await readSharedData(adminId, true) // Include deleted items
    
    let migrationCount = 0
    
    // Migrate inventory items
    if (sharedData.inventory && Array.isArray(sharedData.inventory)) {
      sharedData.inventory = sharedData.inventory.map(item => {
        if (!item.branchId) {
          migrationCount++
          return { ...item, branchId: defaultBranchId }
        }
        return item
      })
    }
    
    // Migrate transactions
    if (sharedData.transactions && Array.isArray(sharedData.transactions)) {
      sharedData.transactions = sharedData.transactions.map(transaction => {
        if (!transaction.branchId) {
          migrationCount++
          // Try to get branchId from transaction's userId if available
          const userBranchId = transaction.userBranchId || defaultBranchId
          return { ...transaction, branchId: userBranchId }
        }
        return transaction
      })
    }
    
    // Migrate users
    if (sharedData.users && Array.isArray(sharedData.users)) {
      sharedData.users = sharedData.users.map(user => {
        if (!user.branchId && user.role !== 'admin') {
          migrationCount++
          return { ...user, branchId: defaultBranchId }
        }
        return user
      })
    }
    
    // Save migrated data
    if (migrationCount > 0) {
      await writeSharedData(sharedData, adminId)
      console.log(`✅ Migration complete: ${migrationCount} items updated with branchId`)
      return { success: true, migratedCount: migrationCount }
    } else {
      console.log('✅ No migration needed - all data has branchId')
      return { success: true, migratedCount: 0 }
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check if data needs migration
 * @param {Object} currentUser - Current user object
 * @returns {Promise<boolean>} - True if migration is needed
 */
export async function checkIfMigrationNeeded(currentUser) {
  try {
    const adminId = getAdminIdForStorage(currentUser)
    const sharedData = await readSharedData(adminId)
    
    // Check if any inventory, transactions, or users lack branchId
    const inventoryNeedsMigration = sharedData.inventory?.some(item => !item.branchId) || false
    const transactionsNeedMigration = sharedData.transactions?.some(t => !t.branchId) || false
    const usersNeedMigration = sharedData.users?.some(u => !u.branchId && u.role !== 'admin') || false
    
    return inventoryNeedsMigration || transactionsNeedMigration || usersNeedMigration
  } catch (error) {
    console.error('Error checking migration status:', error)
    return false
  }
}
