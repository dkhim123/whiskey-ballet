/**
 * Database Abstraction Layer
 * Note: This app primarily uses localStorage/IndexedDB on the client side.
 * These classes are for potential future API integration.
 */

export class InventoryDB {
  static async getAll(adminId, options = {}) {
    // Placeholder - app uses localStorage
    return { items: [], total: 0 }
  }

  static async getById(adminId, productId) {
    return null
  }

  static async create(adminId, productData) {
    return { success: false, message: 'Use client-side storage' }
  }

  static async update(adminId, productId, updates) {
    return { success: false, message: 'Use client-side storage' }
  }

  static async delete(adminId, productId) {
    return { success: false, message: 'Use client-side storage' }
  }

  static async restore(adminId, productId) {
    return { success: false, message: 'Use client-side storage' }
  }
}

export class ExpensesDB {
  static async getAll(adminId, options = {}) {
    return { expenses: [], total: 0 }
  }

  static async getById(adminId, expenseId) {
    return null
  }

  static async create(adminId, expenseData) {
    return { success: false, message: 'Use client-side storage' }
  }

  static async update(adminId, expenseId, updates) {
    return { success: false, message: 'Use client-side storage' }
  }

  static async delete(adminId, expenseId) {
    return { success: false, message: 'Use client-side storage' }
  }
}

export class TransactionsDB {
  static async getAll(adminId, options = {}) {
    return { transactions: [], total: 0 }
  }

  static async getById(adminId, transactionId) {
    return null
  }

  static async create(adminId, transactionData) {
    return { success: false, message: 'Use client-side storage' }
  }
}

// Note: The actual data storage happens in:
// - src/services/storage.js (localStorage/IndexedDB)
// - src/services/database.js (sync service)
