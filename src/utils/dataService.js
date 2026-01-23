/**
 * Service wrapper for database operations
 * Works with both admin and cashier roles
 */

import db, { STORES } from "./database"

class DataService {
  constructor() {
    this.initialized = false
  }

  async init() {
    if (!this.initialized) {
      await db.init()
      this.initialized = true

      // Auto-sync every 30 seconds if online
      setInterval(() => {
        if (navigator.onLine && !db.syncInProgress) {
          db.syncWithServer()
        }
      }, 30000)
    }
  }

  // Products
  async getProducts() {
    await this.init()
    return db.getAll(STORES.PRODUCTS)
  }

  async getProduct(id) {
    await this.init()
    return db.get(STORES.PRODUCTS, id)
  }

  async addProduct(product) {
    await this.init()
    return db.add(STORES.PRODUCTS, product)
  }

  async updateProduct(product) {
    await this.init()
    return db.update(STORES.PRODUCTS, product)
  }

  async deleteProduct(id) {
    await this.init()
    return db.delete(STORES.PRODUCTS, id)
  }

  async searchProducts(query) {
    await this.init()
    const products = await this.getProducts()
    const lowerQuery = query.toLowerCase()

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        p.barcode?.toLowerCase().includes(lowerQuery)
    )
  }

  // Transactions
  async getTransactions() {
    await this.init()
    return db.getAll(STORES.TRANSACTIONS)
  }

  async getTransaction(id) {
    await this.init()
    return db.get(STORES.TRANSACTIONS, id)
  }

  async addTransaction(transaction) {
    await this.init()
    return db.add(STORES.TRANSACTIONS, transaction)
  }

  async getTransactionsByUser(userId) {
    await this.init()
    return db.queryByIndex(STORES.TRANSACTIONS, "userId", userId)
  }

  async getTransactionsByDateRange(startDate, endDate) {
    await this.init()
    const transactions = await this.getTransactions()

    return transactions.filter((t) => {
      const date = new Date(t.date)
      return date >= new Date(startDate) && date <= new Date(endDate)
    })
  }

  // Users
  async getUsers() {
    await this.init()
    return db.getAll(STORES.USERS)
  }

  async getUser(id) {
    await this.init()
    return db.get(STORES.USERS, id)
  }

  async getUserByEmail(email) {
    await this.init()
    const users = await db.queryByIndex(STORES.USERS, "email", email)
    return users[0] || null
  }

  async addUser(user) {
    await this.init()
    return db.add(STORES.USERS, user)
  }

  async updateUser(user) {
    await this.init()
    return db.update(STORES.USERS, user)
  }

  async deleteUser(id) {
    await this.init()
    return db.delete(STORES.USERS, id)
  }

  // Inventory
  async getInventory() {
    await this.init()
    return db.getAll(STORES.INVENTORY)
  }

  async getInventoryItem(productId) {
    await this.init()
    return db.get(STORES.INVENTORY, productId)
  }

  async updateInventory(productId, quantity) {
    await this.init()
    const item = await this.getInventoryItem(productId)

    if (item) {
      return db.update(STORES.INVENTORY, {
        ...item,
        quantity,
      })
    } else {
      return db.add(STORES.INVENTORY, {
        productId,
        quantity,
      })
    }
  }

  async adjustInventory(productId, adjustment) {
    await this.init()
    const item = await this.getInventoryItem(productId)
    const currentQty = item?.quantity || 0
    const newQty = Math.max(0, currentQty + adjustment)

    return this.updateInventory(productId, newQty)
  }

  // Sync status
  async getSyncStatus() {
    await this.init()
    const queue = await db.getAll(STORES.SYNC_QUEUE)

    return {
      isOnline: navigator.onLine,
      pendingSync: queue.length,
      syncInProgress: db.syncInProgress,
      lastSync: localStorage.getItem("lastSync") || null,
    }
  }

  async forceSyncFromServer() {
    await this.init()
    return db.pullFromServer()
  }

  async forceSyncToServer() {
    await this.init()
    return db.syncWithServer()
  }

  // Stats and Reports
  async getSalesStats(startDate, endDate) {
    await this.init()
    const transactions = await this.getTransactionsByDateRange(startDate, endDate)

    return {
      totalSales: transactions.reduce((sum, t) => sum + t.total, 0),
      totalTransactions: transactions.length,
      averageSale: transactions.length > 0 ? transactions.reduce((sum, t) => sum + t.total, 0) / transactions.length : 0,
      cashPayments: transactions.filter((t) => t.paymentMethod === "cash").length,
      mpesaPayments: transactions.filter((t) => t.paymentMethod === "mpesa").length,
    }
  }

  async getLowStockProducts(threshold = 10) {
    await this.init()
    const products = await this.getProducts()
    return products.filter((p) => p.stock <= threshold)
  }

  async getTopSellingProducts(limit = 10) {
    await this.init()
    const transactions = await this.getTransactions()

    const productSales = {}

    transactions.forEach((t) => {
      t.items.forEach((item) => {
        if (!productSales[item.id]) {
          productSales[item.id] = {
            ...item,
            totalQuantity: 0,
            totalRevenue: 0,
          }
        }
        productSales[item.id].totalQuantity += item.quantity
        productSales[item.id].totalRevenue += item.price * item.quantity
      })
    })

    return Object.values(productSales)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit)
  }
}

// Singleton instance
const dataService = new DataService()

export default dataService
