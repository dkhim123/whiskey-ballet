/**
 * Service wrapper for database operations
 * Works with both admin and cashier roles
 */

import db, { STORES } from "./database"
import {
  writeProductToRealtimeDB,
  writeInventoryToRealtimeDB,
  writeTransactionToRealtimeDB,
  writeExpenseToRealtimeDB,
  writeSupplierToRealtimeDB,
  writePurchaseOrderToRealtimeDB,
  writePaymentToRealtimeDB,
  writeBranchToRealtimeDB,
  writeUserToRealtimeDB
} from "./firebaseRealtime"
import { requireValidBranchId, normalizeBranchId } from "./branchValidation"

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
    // Validate that product has a branchId
    requireValidBranchId(product, 'Product')
    const result = await db.add(STORES.PRODUCTS, product)
    await writeProductToRealtimeDB(product)
    return result
  }

  async updateProduct(product) {
    await this.init()
    const result = await db.update(STORES.PRODUCTS, product)
    await writeProductToRealtimeDB(product)
    return result
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

  // Transactions (branch-aware)
  async getTransactions(branchId) {
    await this.init()
    const all = await db.getAll(STORES.TRANSACTIONS)
    return branchId ? all.filter(t => t.branchId === branchId) : all
  }

  async getTransaction(id, branchId) {
    await this.init()
    const txn = await db.get(STORES.TRANSACTIONS, id)
    return branchId ? (txn && txn.branchId === branchId ? txn : null) : txn
  }


  async addTransaction(transaction, branchId) {
    await this.init()
    const finalBranchId = normalizeBranchId(branchId || transaction.branchId)
    if (!finalBranchId) throw new Error('branchId is required for all transactions')
    const txn = { ...transaction, branchId: finalBranchId }
    const result = await db.add(STORES.TRANSACTIONS, txn)
    await writeTransactionToRealtimeDB(txn)
    return result
  }

  async getTransactionsByUser(userId, branchId) {
    await this.init()
    const txns = await db.queryByIndex(STORES.TRANSACTIONS, "userId", userId)
    return branchId ? txns.filter(t => t.branchId === branchId) : txns
  }

  async getTransactionsByDateRange(startDate, endDate, branchId) {
    await this.init()
    const transactions = await this.getTransactions(branchId)
    return transactions.filter((t) => {
      const date = new Date(t.date)
      return date >= new Date(startDate) && date <= new Date(endDate)
    })
  }

  // Users (branch-aware)
  async getUsers(branchId) {
    await this.init()
    const all = await db.getAll(STORES.USERS)
    return branchId ? all.filter(u => u.branchId === branchId) : all
  }

  async getUser(id, branchId) {
    await this.init()
    const user = await db.get(STORES.USERS, id)
    return branchId ? (user && user.branchId === branchId ? user : null) : user
  }

  async getUserByEmail(email, branchId) {
    await this.init()
    const users = await db.queryByIndex(STORES.USERS, "email", email)
    return branchId ? users.find(u => u.branchId === branchId) || null : users[0] || null
  }


  async addUser(user, branchId) {
    await this.init()
    const finalBranchId = branchId || user.branchId
    if (!finalBranchId) throw new Error('branchId is required for all users')
    const u = { ...user, branchId: finalBranchId }
    const result = await db.add(STORES.USERS, u)
    await writeUserToRealtimeDB(u)
    return result
  }


  async updateUser(user, branchId) {
    await this.init()
    const finalBranchId = branchId || user.branchId
    if (!finalBranchId) throw new Error('branchId is required for all users')
    const u = { ...user, branchId: finalBranchId }
    const result = await db.update(STORES.USERS, u)
    await writeUserToRealtimeDB(u)
    return result
  }

  async deleteUser(id, branchId) {
    await this.init()
    const user = await db.get(STORES.USERS, id)
    if (branchId && user && user.branchId !== branchId) return false
    return db.delete(STORES.USERS, id)
  }

  // Inventory (branch-aware)
  async getInventory(branchId) {
    await this.init()
    const all = await db.getAll(STORES.INVENTORY)
    return branchId ? all.filter(i => i.branchId === branchId) : all
  }

  async getInventoryItem(productId, branchId) {
    await this.init()
    const item = await db.get(STORES.INVENTORY, productId)
    return branchId ? (item && item.branchId === branchId ? item : null) : item
  }


  async updateInventory(productId, quantity, branchId) {
    await this.init()
    if (!branchId) throw new Error('branchId is required for all inventory updates')
    const item = await this.getInventoryItem(productId, branchId)
    let result, inventoryObj
    if (item) {
      inventoryObj = { ...item, quantity, branchId }
      result = await db.update(STORES.INVENTORY, inventoryObj)
    } else {
      inventoryObj = { productId, quantity, branchId }
      result = await db.add(STORES.INVENTORY, inventoryObj)
    }
    await writeInventoryToRealtimeDB(inventoryObj)
    return result
  }

  async adjustInventory(productId, adjustment, branchId) {
    await this.init()
    const item = await this.getInventoryItem(productId, branchId)
    const currentQty = item?.quantity || 0
    const newQty = Math.max(0, currentQty + adjustment)
    return this.updateInventory(productId, newQty, branchId)
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
