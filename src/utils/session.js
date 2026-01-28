/**
 * Session management utility for user authentication
 */

const SESSION_KEY = 'pos-user-session'
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const VALID_ROLES = ['admin', 'manager', 'cashier']
const VALID_PAGES = ['admin-dashboard', 'manager-dashboard', 'pos', 'inventory', 'cashier-dashboard', 'reports', 'data-management', 'admin-settings', 'branch-management', 'user-guide', 'customers', 'suppliers', 'purchase-orders', 'supplier-payments', 'expenses', 'database-settings', 'transactions-history']

/**
 * Validate session data structure and values
 */
const isValidSession = (session) => {
  if (!session || typeof session !== 'object') {
    return false
  }

  // Check required fields
  if (!session.userRole || !session.currentPage || !session.timestamp) {
    return false
  }

  // Validate role
  if (!VALID_ROLES.includes(session.userRole)) {
    return false
  }

  // Validate page
  if (!VALID_PAGES.includes(session.currentPage)) {
    return false
  }

  // Check session age
  const sessionAge = Date.now() - new Date(session.timestamp).getTime()
  if (sessionAge > SESSION_DURATION_MS) {
    return false
  }

  return true
}

/**
 * Save user session to localStorage
 */
export const saveSession = (userRole, currentPage, user = null) => {
  try {
    const session = {
      userRole,
      currentPage,
      user,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return true
  } catch (error) {
    console.error('Error saving session:', error)
    return false
  }
}

/**
 * Load user session from localStorage with validation
 */
export const loadSession = () => {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) {
      return null
    }

    const session = JSON.parse(stored)
    
    // Validate session
    if (!isValidSession(session)) {
      // Clear invalid session
      clearSession()
      return null
    }

    return session
  } catch (error) {
    console.error('Error loading session:', error)
    clearSession()
    return null
  }
}

/**
 * Update current page in session
 */
export const updateSessionPage = (currentPage) => {
  try {
    // Validate new page value
    if (!VALID_PAGES.includes(currentPage)) {
      console.error('Invalid page:', currentPage)
      return false
    }
    
    const session = loadSession()
    if (!session) {
      return false
    }

    session.currentPage = currentPage
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return true
  } catch (error) {
    console.error('Error updating session:', error)
    return false
  }
}

/**
 * Clear user session from localStorage
 */
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY)
    return true
  } catch (error) {
    console.error('Error clearing session:', error)
    return false
  }
}
