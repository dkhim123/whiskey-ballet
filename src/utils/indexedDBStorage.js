/**
 * IndexedDB Storage Layer
 * Provides admin-isolated storage for POS data with support for large datasets
 * Designed to handle 5000-10000+ products and transactions efficiently
 */

const DB_NAME = 'WhiskeyBalletPOS'
// IMPORTANT: Only increment DB_VERSION when you need to add new stores or indexes
// Never decrement or reset this version - it will delete all user data!
// Current version history:
// v1: Initial schema
// v2: Added soft delete (deletedAt indexes)
// v3: Data preservation improvements
// v4: Branding updates and database stability fixes
// v5: Added branches and users stores for multi-branch support
const DB_VERSION = 5; // Updated to match existing database version

// Object store names
const STORES = {
  INVENTORY: 'inventory',
  TRANSACTIONS: 'transactions',
  SUPPLIERS: 'suppliers',
  PURCHASE_ORDERS: 'purchaseOrders',
  GOODS_RECEIVED_NOTES: 'goodsReceivedNotes',
  SUPPLIER_PAYMENTS: 'supplierPayments',
  STOCK_ADJUSTMENTS: 'stockAdjustments',
  CUSTOMERS: 'customers',
  EXPENSES: 'expenses',
  SETTINGS: 'settings',
  BRANCHES: 'branches',
  USERS: 'users'
}

/**
 * Initialize IndexedDB database with all required object stores
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Update Inventory store
        if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
          const inventoryStore = db.createObjectStore(STORES.INVENTORY, { keyPath: 'id' });
          inventoryStore.createIndex('adminId', 'adminId', { unique: false });
          console.log('✅ Created inventory store with adminId index');
        } else {
          const inventoryStore = event.target.transaction.objectStore(STORES.INVENTORY);
          if (!inventoryStore.indexNames.contains('adminId')) {
            inventoryStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to inventory store');
          }
        }

        // Update Transactions store
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const transactionsStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
          transactionsStore.createIndex('adminId', 'adminId', { unique: false });
          console.log('✅ Created transactions store with adminId index');
        } else {
          const transactionsStore = event.target.transaction.objectStore(STORES.TRANSACTIONS);
          if (!transactionsStore.indexNames.contains('adminId')) {
            transactionsStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to transactions store');
          }
        }

        // Update Suppliers store
        if (!db.objectStoreNames.contains(STORES.SUPPLIERS)) {
          const suppliersStore = db.createObjectStore(STORES.SUPPLIERS, { keyPath: ['adminId', 'id'] });
          suppliersStore.createIndex('adminId', 'adminId', { unique: false });
          suppliersStore.createIndex('name', ['adminId', 'name'], { unique: false });
          console.log('✅ Created suppliers store');
        } else {
          const suppliersStore = event.target.transaction.objectStore(STORES.SUPPLIERS);
          if (!suppliersStore.indexNames.contains('adminId')) {
            suppliersStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to suppliers store');
          }
        }

        // Update Purchase Orders store
        if (!db.objectStoreNames.contains(STORES.PURCHASE_ORDERS)) {
          const poStore = db.createObjectStore(STORES.PURCHASE_ORDERS, { keyPath: ['adminId', 'id'] });
          poStore.createIndex('adminId', 'adminId', { unique: false });
          poStore.createIndex('status', ['adminId', 'status'], { unique: false });
          console.log('✅ Created purchase orders store');
        } else {
          const poStore = event.target.transaction.objectStore(STORES.PURCHASE_ORDERS);
          if (!poStore.indexNames.contains('adminId')) {
            poStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to purchase orders store');
          }
        }

        // Update Goods Received Notes store
        if (!db.objectStoreNames.contains(STORES.GOODS_RECEIVED_NOTES)) {
          const grnStore = db.createObjectStore(STORES.GOODS_RECEIVED_NOTES, { keyPath: ['adminId', 'id'] });
          grnStore.createIndex('adminId', 'adminId', { unique: false });
          console.log('✅ Created goods received notes store');
        } else {
          const grnStore = event.target.transaction.objectStore(STORES.GOODS_RECEIVED_NOTES);
          if (!grnStore.indexNames.contains('adminId')) {
            grnStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to goods received notes store');
          }
        }

        // Update Supplier Payments store
        if (!db.objectStoreNames.contains(STORES.SUPPLIER_PAYMENTS)) {
          const paymentsStore = db.createObjectStore(STORES.SUPPLIER_PAYMENTS, { keyPath: ['adminId', 'id'] });
          paymentsStore.createIndex('adminId', 'adminId', { unique: false });
          console.log('✅ Created supplier payments store');
        } else {
          const paymentsStore = event.target.transaction.objectStore(STORES.SUPPLIER_PAYMENTS);
          if (!paymentsStore.indexNames.contains('adminId')) {
            paymentsStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to supplier payments store');
          }
        }

        // Update Stock Adjustments store
        if (!db.objectStoreNames.contains(STORES.STOCK_ADJUSTMENTS)) {
          const adjustmentsStore = db.createObjectStore(STORES.STOCK_ADJUSTMENTS, { keyPath: ['adminId', 'id'] });
          adjustmentsStore.createIndex('adminId', 'adminId', { unique: false });
          console.log('✅ Created stock adjustments store');
        } else {
          const adjustmentsStore = event.target.transaction.objectStore(STORES.STOCK_ADJUSTMENTS);
          if (!adjustmentsStore.indexNames.contains('adminId')) {
            adjustmentsStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to stock adjustments store');
          }
        }

        // Update Customers store
        if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
          const customersStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: ['adminId', 'id'] });
          customersStore.createIndex('adminId', 'adminId', { unique: false });
          customersStore.createIndex('phone', ['adminId', 'phone'], { unique: false });
          console.log('✅ Created customers store');
        } else {
          const customersStore = event.target.transaction.objectStore(STORES.CUSTOMERS);
          if (!customersStore.indexNames.contains('adminId')) {
            customersStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to customers store');
          }
        }

        // Update Expenses store
        if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
          const expensesStore = db.createObjectStore(STORES.EXPENSES, { keyPath: ['adminId', 'id'] });
          expensesStore.createIndex('adminId', 'adminId', { unique: false });
          expensesStore.createIndex('date', ['adminId', 'date'], { unique: false });
          console.log('✅ Created expenses store');
        } else {
          const expensesStore = event.target.transaction.objectStore(STORES.EXPENSES);
          if (!expensesStore.indexNames.contains('adminId')) {
            expensesStore.createIndex('adminId', 'adminId', { unique: false });
            console.log('✅ Added adminId index to expenses store');
          }
        }

        // Update Settings store (per admin)
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          const settingsStore = db.createObjectStore(STORES.SETTINGS, { keyPath: 'adminId' });
          console.log('✅ Created settings store');
        }

        // Branches store (version 5+)
        if (!db.objectStoreNames.contains(STORES.BRANCHES)) {
          const branchesStore = db.createObjectStore(STORES.BRANCHES, { keyPath: 'id' });
          branchesStore.createIndex('adminId', 'adminId', { unique: false });
          branchesStore.createIndex('isActive', ['adminId', 'isActive'], { unique: false });
          branchesStore.createIndex('branchId', 'branchId', { unique: true });
          console.log('✅ Created branches store');
        }

        // Users store (version 5+) - for cashier management
        if (!db.objectStoreNames.contains(STORES.USERS)) {
          const usersStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
          usersStore.createIndex('adminId', 'adminId', { unique: false });
          usersStore.createIndex('branchId', 'branchId', { unique: false });
          usersStore.createIndex('role', ['adminId', 'role'], { unique: false });
          console.log('✅ Created users store');
        }

        console.log('✅ All IndexedDB stores created successfully');
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        const error = event.target.error;
        console.error('❌ Error opening IndexedDB:', error);
        console.error('Database name:', DB_NAME, 'Requested version:', DB_VERSION);
        if (error && error.name === 'VersionError') {
          console.error('⚠️ IndexedDB Version Conflict: The database exists with a different version.');
          console.error('⚠️ This usually happens when the app tries to open an older version than what exists.');
          console.error('⚠️ Current DB_VERSION:', DB_VERSION);
        }
        reject(error);
      };
    } catch (error) {
      console.error('❌ Exception opening IndexedDB:', error);
      reject(error);
    }
  });
}

/**
 * Get database connection with retry logic
 */
const getDB = async () => {
  try {
    return await initDB()
  } catch (error) {
    console.error('❌ Failed to get DB connection:', error)
    throw error
  }
}

/**
 * Add or update a single item in a store
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {object} data - Data to store (must have 'id' property)
 */
const putItem = async (storeName, adminId, data) => {
  const db = await getDB()
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      // Add adminId to the data
      const dataWithAdmin = { ...data, adminId }
      
      const request = store.put(dataWithAdmin)
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Add multiple items in a batch (optimized for large datasets)
 * IMPORTANT: This function REPLACES all items for the admin in the store
 * It clears existing data first to ensure deleted items are removed
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {array} items - Array of items to store
 */
const putBatch = async (storeName, adminId, items) => {
  let db
  try {
    db = await getDB()
  } catch (error) {
    console.error(`❌ Failed to open database for putBatch:`, error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  console.log(`💾 IndexedDB: Replacing ${storeName} with ${items.length} items for adminId: ${adminId}`)
  
  return new Promise((resolve, reject) => {
    try {
      // Verify store exists
      if (!db.objectStoreNames.contains(storeName)) {
        const error = new Error(`Store "${storeName}" does not exist in database`)
        console.error(`❌ ${error.message}`)
        db.close()
        reject(error)
        return
      }

      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      // Verify index exists
      if (!store.indexNames.contains('adminId')) {
        const error = new Error(`Index "adminId" does not exist in store "${storeName}"`)
        console.error(`❌ ${error.message}`)
        db.close()
        reject(error)
        return
      }
      
      const index = store.index('adminId')
      
      let deleteCount = 0
      let successCount = 0
      let errorCount = 0
      let clearingComplete = false
      
      // STEP 1: Clear all existing items for this admin using cursor
      const clearRequest = index.openCursor(adminId)
      
      clearRequest.onsuccess = (event) => {
        try {
          const cursor = event.target.result
          if (cursor) {
            // Still have items to delete
            cursor.delete()
            deleteCount++
            cursor.continue() // Move to next item
          } else {
            // Cursor reached the end - clearing is complete
            clearingComplete = true
            console.log(`🧹 IndexedDB: Cleared ${deleteCount} old items from ${storeName}`)
            
            // STEP 2: Now that clearing is done, add all new items
            for (const item of items) {
              const dataWithAdmin = { ...item, adminId }
              const putRequest = store.put(dataWithAdmin)
              
              putRequest.onsuccess = () => successCount++
              putRequest.onerror = () => {
                errorCount++
                console.error(`❌ Error saving item to ${storeName}:`, putRequest.error)
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error in cursor handler:`, error)
          db.close()
          reject(error)
        }
      }
      
      clearRequest.onerror = () => {
        console.error(`❌ Error clearing ${storeName} for adminId ${adminId}:`, clearRequest.error)
        db.close()
        reject(clearRequest.error)
      }
      
      transaction.oncomplete = () => {
        db.close()
        console.log(`✅ IndexedDB: Cleared ${deleteCount} old items, saved ${successCount}/${items.length} new items to ${storeName} for adminId: ${adminId}`)
        resolve({ success: successCount, errors: errorCount, total: items.length, deleted: deleteCount })
      }
      
      transaction.onerror = () => {
        db.close()
        console.error(`❌ Transaction error in ${storeName}:`, transaction.error)
        reject(transaction.error)
      }
      
      transaction.onabort = () => {
        db.close()
        console.error(`❌ Transaction aborted in ${storeName}`)
        reject(new Error('Transaction aborted'))
      }
    } catch (error) {
      db.close()
      console.error(`❌ Exception in putBatch for ${storeName}:`, error)
      reject(error)
    }
  })
}

/**
 * Get a single item by ID
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {string|number} id - Item ID
 */
const getItem = async (storeName, adminId, id) => {
  let db
  try {
    db = await getDB()
  } catch (error) {
    console.error(`❌ Failed to open database for getItem:`, error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      
      const request = store.get([adminId, id])
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => {
        console.error(`❌ Error getting item from ${storeName}:`, request.error)
        reject(request.error)
      }
      
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => {
        db.close()
        console.error(`❌ Transaction error in getItem:`, transaction.error)
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Get all items for an admin from a store (excludes soft-deleted items by default)
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {boolean} includeDeleted - Whether to include soft-deleted items (default: false)
 */
const getAllItems = async (storeName, adminId, includeDeleted = false) => {
  let db
  try {
    db = await getDB()
  } catch (error) {
    console.error(`❌ Failed to open database for getAllItems:`, error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index('adminId')
      
      const request = index.getAll(adminId)
      
      request.onsuccess = () => {
        let items = request.result || []
        
        // Filter out soft-deleted items unless includeDeleted is true
        if (!includeDeleted) {
          items = items.filter(item => !item.deletedAt)
        }
        
        console.log(`📦 IndexedDB: Retrieved ${items.length} items from ${storeName} for adminId: ${adminId}${includeDeleted ? ' (including deleted)' : ''}`)
        resolve(items)
      }
      request.onerror = () => {
        console.error(`❌ Error getting all items from ${storeName}:`, request.error)
        reject(request.error)
      }
      
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => {
        db.close()
        console.error(`❌ Transaction error in getAllItems:`, transaction.error)
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Delete a single item (SOFT DELETE - sets deletedAt and deletedBy)
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {string|number} id - Item ID
 * @param {string|number} userId - User ID who is deleting the item
 */
const deleteItem = async (storeName, adminId, id, userId = null) => {
  let db
  try {
    db = await getDB()
  } catch (error) {
    console.error(`❌ Failed to open database for deleteItem:`, error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      // First, get the existing item
      const getRequest = store.get([adminId, id])
      
      getRequest.onsuccess = () => {
        const item = getRequest.result
        
        if (!item) {
          console.warn(`⚠️ Item ${id} not found in ${storeName}`)
          resolve(false)
          return
        }
        
        // Perform soft delete by setting deletedAt and deletedBy
        const softDeletedItem = {
          ...item,
          deletedAt: new Date().toISOString(),
          deletedBy: userId
        }
        
        const putRequest = store.put(softDeletedItem)
        
        putRequest.onsuccess = () => {
          console.log(`🗑️ IndexedDB: Soft deleted item ${id} from ${storeName}`)
          resolve(true)
        }
        
        putRequest.onerror = () => {
          console.error(`❌ Error soft deleting item from ${storeName}:`, putRequest.error)
          reject(putRequest.error)
        }
      }
      
      getRequest.onerror = () => {
        console.error(`❌ Error getting item from ${storeName}:`, getRequest.error)
        reject(getRequest.error)
      }
      
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => {
        db.close()
        console.error(`❌ Transaction error in deleteItem:`, transaction.error)
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Clear all data for an admin from a store
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 */
const clearAdminData = async (storeName, adminId) => {
  const db = await getDB()
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const index = store.index('adminId')
      
      const request = index.openCursor(adminId)
      let deleteCount = 0
      
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          deleteCount++
          cursor.continue()
        }
      }
      
      request.onerror = () => reject(request.error)
      
      transaction.oncomplete = () => {
        db.close()
        resolve(deleteCount)
      }
      
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Get storage statistics for an admin
 * @param {string|number} adminId - Admin ID
 */
const getStorageStats = async (adminId) => {
  const stats = {}
  
  try {
    for (const storeName of Object.values(STORES)) {
      const items = await getAllItems(storeName, adminId)
      stats[storeName] = items.length
    }
    
    return stats
  } catch (error) {
    console.error('Error getting storage stats:', error)
    return null
  }
}

/**
 * Get all soft-deleted items for an admin from a store
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 */
const getDeletedItems = async (storeName, adminId) => {
  let db
  try {
    db = await getDB()
  } catch (error) {
    console.error(`❌ Failed to open database for getDeletedItems:`, error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index('adminId')
      
      const request = index.getAll(adminId)
      
      request.onsuccess = () => {
        const allItems = request.result || []
        // Filter to only include soft-deleted items
        const deletedItems = allItems.filter(item => item.deletedAt != null)
        
        console.log(`🗑️ IndexedDB: Retrieved ${deletedItems.length} deleted items from ${storeName} for adminId: ${adminId}`)
        resolve(deletedItems)
      }
      request.onerror = () => {
        console.error(`❌ Error getting deleted items from ${storeName}:`, request.error)
        reject(request.error)
      }
      
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => {
        db.close()
        console.error(`❌ Transaction error in getDeletedItems:`, transaction.error)
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Restore a single soft-deleted item
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {string|number} id - Item ID
 */
const restoreItem = async (storeName, adminId, id) => {
  let db
  try {
    db = await getDB()
  } catch (error) {
    console.error(`❌ Failed to open database for restoreItem:`, error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      // Get the item
      const getRequest = store.get([adminId, id])
      
      getRequest.onsuccess = () => {
        const item = getRequest.result
        
        if (!item) {
          console.warn(`⚠️ Item ${id} not found in ${storeName}`)
          resolve(false)
          return
        }
        
        if (!item.deletedAt) {
          console.warn(`⚠️ Item ${id} is not deleted`)
          resolve(false)
          return
        }
        
        // Restore by removing deletedAt and deletedBy
        const restoredItem = { ...item }
        delete restoredItem.deletedAt
        delete restoredItem.deletedBy
        
        const putRequest = store.put(restoredItem)
        
        putRequest.onsuccess = () => {
          console.log(`♻️ IndexedDB: Restored item ${id} in ${storeName}`)
          resolve(true)
        }
        
        putRequest.onerror = () => {
          console.error(`❌ Error restoring item in ${storeName}:`, putRequest.error)
          reject(putRequest.error)
        }
      }
      
      getRequest.onerror = () => {
        console.error(`❌ Error getting item from ${storeName}:`, getRequest.error)
        reject(getRequest.error)
      }
      
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => {
        db.close()
        console.error(`❌ Transaction error in restoreItem:`, transaction.error)
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Restore multiple items deleted within a time range (Admin Recovery)
 * @param {string} storeName - Name of the object store
 * @param {string|number} adminId - Admin ID for isolation
 * @param {string} startTimestamp - ISO timestamp start of range
 * @param {string} endTimestamp - ISO timestamp end of range
 * @returns {Promise<{restored: number, failed: number}>}
 */
const restoreDataByTimeRange = async (storeName, adminId, startTimestamp, endTimestamp) => {
  let db
  try {
    db = await getDB()
  } catch (error) {
    console.error(`❌ Failed to open database for restoreDataByTimeRange:`, error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  console.log(`♻️ IndexedDB: Restoring items from ${storeName} deleted between ${startTimestamp} and ${endTimestamp}`)
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const index = store.index('adminId')
      
      const items = []
      let restoredCount = 0
      let failedCount = 0
      
      // First pass: collect items to restore
      const cursorRequest = index.openCursor(adminId)
      
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result
        
        if (cursor) {
          const item = cursor.value
          
          // Check if item is soft-deleted and within time range
          if (item.deletedAt && 
              item.deletedAt >= startTimestamp && 
              item.deletedAt <= endTimestamp) {
            items.push(item)
          }
          
          cursor.continue()
        } else {
          // Cursor finished, now restore all collected items
          console.log(`♻️ Found ${items.length} items to restore from ${storeName}`)
          
          items.forEach(item => {
            // Remove soft delete markers
            const restoredItem = { ...item }
            delete restoredItem.deletedAt
            delete restoredItem.deletedBy
            
            const putRequest = store.put(restoredItem)
            
            putRequest.onsuccess = () => {
              restoredCount++
            }
            
            putRequest.onerror = () => {
              failedCount++
              console.error(`❌ Error restoring item ${item.id}:`, putRequest.error)
            }
          })
        }
      }
      
      cursorRequest.onerror = () => {
        console.error(`❌ Error in cursor for ${storeName}:`, cursorRequest.error)
        reject(cursorRequest.error)
      }
      
      transaction.oncomplete = () => {
        db.close()
        console.log(`✅ Restoration complete: ${restoredCount} restored, ${failedCount} failed`)
        resolve({ restored: restoredCount, failed: failedCount })
      }
      
      transaction.onerror = () => {
        db.close()
        console.error(`❌ Transaction error in restoreDataByTimeRange:`, transaction.error)
        reject(transaction.error)
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

/**
 * Restore all items from multiple stores within a time range
 * @param {string|number} adminId - Admin ID for isolation
 * @param {string} startTimestamp - ISO timestamp start of range
 * @param {string} endTimestamp - ISO timestamp end of range
 * @returns {Promise<{results: Object}>}
 */
const restoreAllDataByTimeRange = async (adminId, startTimestamp, endTimestamp) => {
  console.log(`♻️ Starting batch restore for adminId: ${adminId}`)
  
  const results = {}
  const storesToRestore = [
    STORES.INVENTORY,
    STORES.TRANSACTIONS,
    STORES.SUPPLIERS,
    STORES.PURCHASE_ORDERS,
    STORES.GOODS_RECEIVED_NOTES,
    STORES.SUPPLIER_PAYMENTS,
    STORES.STOCK_ADJUSTMENTS,
    STORES.CUSTOMERS,
    STORES.EXPENSES
  ]
  
  try {
    for (const storeName of storesToRestore) {
      try {
        const result = await restoreDataByTimeRange(storeName, adminId, startTimestamp, endTimestamp)
        results[storeName] = result
      } catch (error) {
        console.error(`❌ Error restoring ${storeName}:`, error)
        results[storeName] = { restored: 0, failed: 0, error: error.message }
      }
    }
    
    const totalRestored = Object.values(results).reduce((sum, r) => sum + (r.restored || 0), 0)
    const totalFailed = Object.values(results).reduce((sum, r) => sum + (r.failed || 0), 0)
    
    console.log(`✅ Batch restore complete: ${totalRestored} total restored, ${totalFailed} total failed`)
    
    return { results, totalRestored, totalFailed }
  } catch (error) {
    console.error('❌ Error in batch restore:', error)
    throw error
  }
}

/**if (typeof window === 'undefined') {
      return false // Server-side rendering
    }
    if (typeof indexedDB === 'undefined' || indexedDB === null) {
      return false
    }
    // Try to open a test database to verify it's not blocked
    try {
      const testOpen = indexedDB.open('test-db', 1)
      testOpen.onerror = () => {
        console.warn('⚠️ IndexedDB blocked or unavailable')
      }
      return true
    } catch (e) {
      console.warn('⚠️ IndexedDB test failed:', e)
      return false
    }
  } catch (error) {
    console.error('❌ Error checking IndexedDB availability:', error)DB is available and working
 */
const isIndexedDBAvailable = () => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch (error) {
    return false
  }
}

/**
 * Get estimated storage quota information
 */
const getStorageInfo = async () => {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: estimate.quota > 0 ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 0,
        available: estimate.quota - estimate.usage
      }
    }
    return null
  } catch (error) {
    console.error('Error getting storage info:', error)
    return null
  }
}

export {
  STORES,
  initDB,
  getDB,
  putItem,
  putBatch,
  getItem,
  getAllItems,
  deleteItem,
  clearAdminData,
  getStorageStats,
  getDeletedItems,
  restoreItem,
  restoreDataByTimeRange,
  restoreAllDataByTimeRange,
  isIndexedDBAvailable,
  getStorageInfo
}
