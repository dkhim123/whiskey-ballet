/**
 * Activity logging utility for tracking admin actions
 */

import { readData, writeData } from './storage'

// Activity types
export const ACTIVITY_TYPES = {
  USER_CREATED: 'user_created',
  USER_DEACTIVATED: 'user_deactivated',
  USER_PASSWORD_CHANGED: 'user_password_changed',
  USER_PERMISSIONS_CHANGED: 'user_permissions_changed',
  TRANSACTION_COMPLETED: 'transaction_completed',
  STOCK_ADJUSTED: 'stock_adjusted',
  PRODUCT_ADDED: 'product_added',
  PRODUCT_UPDATED: 'product_updated',
  EXPENSE_ADDED: 'expense_added',
  SUPPLIER_PAYMENT: 'supplier_payment'
}

/**
 * Log an activity
 * @param {string} type - Activity type from ACTIVITY_TYPES
 * @param {string} description - Human readable description
 * @param {object} details - Additional details about the activity
 * @param {object} user - User who performed the action
 */
export const logActivity = async (type, description, details = {}, user = null) => {
  try {
    // Only log if we have a valid user
    if (!user?.id) {
      console.warn('Cannot log activity without valid user')
      return { success: false, error: 'Invalid user' }
    }
    
    const userId = user.id
    const data = await readData(userId)
    
    const activity = {
      id: Date.now(),
      type,
      description,
      details,
      performedBy: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role
      },
      timestamp: new Date().toISOString()
    }
    
    // Initialize activities array if it doesn't exist
    if (!data.activities) {
      data.activities = []
    }
    
    // Add activity to the beginning (most recent first)
    data.activities.unshift(activity)
    
    // Keep only last 1000 activities to avoid storage bloat
    if (data.activities.length > 1000) {
      data.activities = data.activities.slice(0, 1000)
    }
    
    await writeData(data, userId)
    
    return { success: true, activity }
  } catch (error) {
    console.error('Error logging activity:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get activities for a user
 * @param {string|number} userId - User ID to get activities for
 * @param {object} filters - Optional filters (type, startDate, endDate)
 * @param {number} limit - Maximum number of activities to return
 */
export const getActivities = async (userId, filters = {}, limit = 100) => {
  try {
    const data = await readData(userId)
    let activities = data.activities || []
    
    // Apply filters
    if (filters.type) {
      activities = activities.filter(a => a.type === filters.type)
    }
    
    if (filters.startDate) {
      activities = activities.filter(a => new Date(a.timestamp) >= new Date(filters.startDate))
    }
    
    if (filters.endDate) {
      activities = activities.filter(a => new Date(a.timestamp) <= new Date(filters.endDate))
    }
    
    // Apply limit
    activities = activities.slice(0, limit)
    
    return { success: true, activities }
  } catch (error) {
    console.error('Error getting activities:', error)
    return { success: false, error: error.message, activities: [] }
  }
}

/**
 * Get activities summary for dashboard
 * @param {string|number} userId - User ID
 */
export const getActivitiesSummary = async (userId) => {
  try {
    const data = await readData(userId)
    const activities = data.activities || []
    
    // Get activities from last 24 hours
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
    const recentActivities = activities.filter(
      a => new Date(a.timestamp) >= oneDayAgo
    )
    
    // Count by type
    const summary = {
      total: activities.length,
      recentTotal: recentActivities.length,
      byType: {}
    }
    
    Object.values(ACTIVITY_TYPES).forEach(type => {
      summary.byType[type] = activities.filter(a => a.type === type).length
    })
    
    return { success: true, summary }
  } catch (error) {
    console.error('Error getting activities summary:', error)
    return { success: false, error: error.message }
  }
}
