/**
 * PostgreSQL Database Client
 * Handles all database connections and queries for the POS system
 */

import { Pool } from 'pg'

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'smartbiz_pos',
  user: process.env.POSTGRES_USER || 'posadmin',
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // Maximum number of clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database error:', err)
})

/**
 * Execute a query with parameters
 */
export async function query(text, params = []) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  return await pool.connect()
}

/**
 * Inventory Operations
 */
export const InventoryDB = {
  /**
   * Get all products for an admin (with pagination and filtering)
   */
  async getAll(adminId, options = {}) {
    const {
      includeDeleted = false,
      category = null,
      search = null,
      limit = 1000,
      offset = 0,
      orderBy = 'name',
      orderDir = 'ASC'
    } = options

    let queryText = `
      SELECT * FROM inventory 
      WHERE admin_id = $1
    `
    const params = [adminId]
    let paramCount = 1

    if (!includeDeleted) {
      queryText += ` AND deleted_at IS NULL`
    }

    if (category) {
      paramCount++
      queryText += ` AND category = $${paramCount}`
      params.push(category)
    }

    if (search) {
      paramCount++
      queryText += ` AND (name ILIKE $${paramCount} OR sku ILIKE $${paramCount} OR barcode ILIKE $${paramCount})`
      params.push(`%${search}%`)
    }

    queryText += ` ORDER BY ${orderBy} ${orderDir} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(limit, offset)

    const result = await query(queryText, params)
    return result.rows
  },

  /**
   * Get single product by ID
   */
  async getById(adminId, productId) {
    const result = await query(
      'SELECT * FROM inventory WHERE admin_id = $1 AND id = $2 AND deleted_at IS NULL',
      [adminId, productId]
    )
    return result.rows[0] || null
  },

  /**
   * Get product by SKU
   */
  async getBySKU(adminId, sku) {
    const result = await query(
      'SELECT * FROM inventory WHERE admin_id = $1 AND sku = $2 AND deleted_at IS NULL',
      [adminId, sku]
    )
    return result.rows[0] || null
  },

  /**
   * Get product by barcode
   */
  async getByBarcode(adminId, barcode) {
    const result = await query(
      'SELECT * FROM inventory WHERE admin_id = $1 AND barcode = $2 AND deleted_at IS NULL',
      [adminId, barcode]
    )
    return result.rows[0] || null
  },

  /**
   * Create new product
   */
  async create(adminId, product) {
    const {
      id, name, sku, barcode, category, sub_category, brand, description,
      unit_of_measure, quantity, reorder_level, cost_price, selling_price,
      vat_rate, is_vat_inclusive, image_url, supplier_id, is_active
    } = product

    const result = await query(
      `INSERT INTO inventory (
        id, admin_id, name, sku, barcode, category, sub_category, brand, 
        description, unit_of_measure, quantity, reorder_level, cost_price, 
        selling_price, vat_rate, is_vat_inclusive, image_url, supplier_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        id, adminId, name, sku, barcode, category, sub_category, brand,
        description, unit_of_measure, quantity, reorder_level, cost_price,
        selling_price, vat_rate, is_vat_inclusive, image_url, supplier_id, is_active
      ]
    )
    return result.rows[0]
  },

  /**
   * Update product
   */
  async update(adminId, productId, updates) {
    const allowedFields = [
      'name', 'sku', 'barcode', 'category', 'sub_category', 'brand', 
      'description', 'unit_of_measure', 'quantity', 'reorder_level', 
      'cost_price', 'selling_price', 'vat_rate', 'is_vat_inclusive', 
      'image_url', 'supplier_id', 'is_active'
    ]

    const setClause = []
    const params = [adminId, productId]
    let paramCount = 2

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        paramCount++
        setClause.push(`${key} = $${paramCount}`)
        params.push(updates[key])
      }
    })

    if (setClause.length === 0) {
      throw new Error('No valid fields to update')
    }

    const result = await query(
      `UPDATE inventory SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE admin_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      params
    )

    return result.rows[0]
  },

  /**
   * Soft delete product
   */
  async delete(adminId, productId) {
    const result = await query(
      `UPDATE inventory SET deleted_at = CURRENT_TIMESTAMP 
       WHERE admin_id = $1 AND id = $2
       RETURNING *`,
      [adminId, productId]
    )
    return result.rows[0]
  },

  /**
   * Bulk create products
   */
  async bulkCreate(adminId, products) {
    const client = await getClient()
    try {
      await client.query('BEGIN')

      const results = []
      for (const product of products) {
        const result = await this.create(adminId, product)
        results.push(result)
      }

      await client.query('COMMIT')
      return results
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

/**
 * Transactions Operations
 */
export const TransactionsDB = {
  /**
   * Get all transactions for an admin
   */
  async getAll(adminId, options = {}) {
    const {
      includeDeleted = false,
      startDate = null,
      endDate = null,
      userId = null,
      paymentMethod = null,
      paymentStatus = null,
      limit = 100,
      offset = 0
    } = options

    let queryText = `SELECT * FROM transactions WHERE admin_id = $1`
    const params = [adminId]
    let paramCount = 1

    if (!includeDeleted) {
      queryText += ` AND deleted_at IS NULL`
    }

    if (startDate) {
      paramCount++
      queryText += ` AND created_at >= $${paramCount}`
      params.push(startDate)
    }

    if (endDate) {
      paramCount++
      queryText += ` AND created_at <= $${paramCount}`
      params.push(endDate)
    }

    if (userId) {
      paramCount++
      queryText += ` AND user_id = $${paramCount}`
      params.push(userId)
    }

    if (paymentMethod) {
      paramCount++
      queryText += ` AND payment_method = $${paramCount}`
      params.push(paymentMethod)
    }

    if (paymentStatus) {
      paramCount++
      queryText += ` AND payment_status = $${paramCount}`
      params.push(paymentStatus)
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(limit, offset)

    const result = await query(queryText, params)
    return result.rows
  },

  /**
   * Create new transaction
   */
  async create(adminId, transaction) {
    const {
      id, user_id, transaction_number, items, subtotal, vat_amount, discount,
      total, payment_method, payment_status, amount_paid, change_given,
      customer_id, customer_name, customer_phone, notes, receipt_number
    } = transaction

    const result = await query(
      `INSERT INTO transactions (
        id, admin_id, user_id, transaction_number, items, subtotal, vat_amount,
        discount, total, payment_method, payment_status, amount_paid, change_given,
        customer_id, customer_name, customer_phone, notes, receipt_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        id, adminId, user_id, transaction_number, JSON.stringify(items), subtotal,
        vat_amount, discount, total, payment_method, payment_status, amount_paid,
        change_given, customer_id, customer_name, customer_phone, notes, receipt_number
      ]
    )
    return result.rows[0]
  },

  /**
   * Update transaction
   */
  async update(adminId, transactionId, updates) {
    const allowedFields = [
      'payment_status', 'amount_paid', 'notes', 'customer_id', 
      'customer_name', 'customer_phone'
    ]

    const setClause = []
    const params = [adminId, transactionId]
    let paramCount = 2

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        paramCount++
        setClause.push(`${key} = $${paramCount}`)
        params.push(updates[key])
      }
    })

    if (setClause.length === 0) {
      throw new Error('No valid fields to update')
    }

    const result = await query(
      `UPDATE transactions SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE admin_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      params
    )

    return result.rows[0]
  }
}

/**
 * Expenses Operations
 */
export const ExpensesDB = {
  /**
   * Get all expenses for an admin
   */
  async getAll(adminId, options = {}) {
    const {
      includeDeleted = false,
      startDate = null,
      endDate = null,
      userId = null,
      category = null,
      limit = 100,
      offset = 0
    } = options

    let queryText = `SELECT * FROM expenses WHERE admin_id = $1`
    const params = [adminId]
    let paramCount = 1

    if (!includeDeleted) {
      queryText += ` AND deleted_at IS NULL`
    }

    if (startDate) {
      paramCount++
      queryText += ` AND expense_date >= $${paramCount}`
      params.push(startDate)
    }

    if (endDate) {
      paramCount++
      queryText += ` AND expense_date <= $${paramCount}`
      params.push(endDate)
    }

    if (userId) {
      paramCount++
      queryText += ` AND user_id = $${paramCount}`
      params.push(userId)
    }

    if (category) {
      paramCount++
      queryText += ` AND category = $${paramCount}`
      params.push(category)
    }

    queryText += ` ORDER BY expense_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(limit, offset)

    const result = await query(queryText, params)
    return result.rows
  },

  /**
   * Create new expense
   */
  async create(adminId, expense) {
    const {
      id, user_id, category, sub_category, description, amount, payment_method,
      receipt_number, receipt_image_url, vendor_name, is_recurring,
      recurrence_period, tags, expense_date
    } = expense

    const result = await query(
      `INSERT INTO expenses (
        id, admin_id, user_id, category, sub_category, description, amount,
        payment_method, receipt_number, receipt_image_url, vendor_name,
        is_recurring, recurrence_period, tags, expense_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id, adminId, user_id, category, sub_category, description, amount,
        payment_method, receipt_number, receipt_image_url, vendor_name,
        is_recurring, recurrence_period, tags ? JSON.stringify(tags) : null,
        expense_date || new Date()
      ]
    )
    return result.rows[0]
  }
}

/**
 * Generic CRUD operations for other tables
 */
export const GenericDB = {
  async getAll(tableName, adminId, includeDeleted = false) {
    let queryText = `SELECT * FROM ${tableName} WHERE admin_id = $1`
    if (!includeDeleted) {
      queryText += ` AND deleted_at IS NULL`
    }
    queryText += ` ORDER BY created_at DESC`

    const result = await query(queryText, [adminId])
    return result.rows
  },

  async create(tableName, adminId, data) {
    const fields = Object.keys(data).filter(k => k !== 'admin_id')
    const values = fields.map(f => data[f])
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ')

    const result = await query(
      `INSERT INTO ${tableName} (admin_id, ${fields.join(', ')})
       VALUES ($1, ${placeholders})
       RETURNING *`,
      [adminId, ...values]
    )
    return result.rows[0]
  },

  async update(tableName, adminId, recordId, updates) {
    const fields = Object.keys(updates)
    const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
    const values = fields.map(f => updates[f])

    const result = await query(
      `UPDATE ${tableName}
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE admin_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [adminId, recordId, ...values]
    )
    return result.rows[0]
  },

  async delete(tableName, adminId, recordId) {
    const result = await query(
      `UPDATE ${tableName}
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE admin_id = $1 AND id = $2
       RETURNING *`,
      [adminId, recordId]
    )
    return result.rows[0]
  }
}

/**
 * Close pool (for graceful shutdown)
 */
export async function closePool() {
  await pool.end()
}

export default {
  query,
  getClient,
  InventoryDB,
  TransactionsDB,
  ExpensesDB,
  GenericDB,
  closePool
}
