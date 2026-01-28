/**
 * Branch Access Control Utility
 * Ensures proper data isolation between branches
 * - Admins can see and switch between all branches
 * - Cashiers can only see their assigned branch data
 * - Prevents unauthorized cross-branch data access
 */

/**
 * Filter inventory items by branch based on user role
 * @param {Array} inventory - All inventory items
 * @param {Object} currentUser - Current logged-in user
 * @param {string} selectedBranch - Branch selected by admin (optional)
 * @returns {Array} Filtered inventory items
 */
export function filterInventoryByBranch(inventory, currentUser, selectedBranch = null) {
  if (!inventory || !Array.isArray(inventory)) {
    return []
  }

  if (!currentUser) {
    console.warn('⚠️ filterInventoryByBranch: No current user provided')
    return []
  }

  // Admin can view all branches or filter by selected branch
  if (currentUser.role === 'admin') {
    if (selectedBranch) {
      const filtered = inventory.filter(item => item.branchId === selectedBranch)
      console.log(`👨‍💼 Admin viewing ${filtered.length} items from branch ${selectedBranch}`)
      return filtered
    }
    console.log(`👨‍💼 Admin viewing all ${inventory.length} items across all branches`)
    return inventory
  }

  // Cashiers can ONLY see their assigned branch
  if (currentUser.role === 'cashier') {
    const cashierBranch = currentUser.branchId
    if (!cashierBranch) {
      console.warn(`⚠️ Cashier ${currentUser.name} has no assigned branch!`)
      return []
    }
    const filtered = inventory.filter(item => item.branchId === cashierBranch)
    console.log(`👤 Cashier ${currentUser.name} viewing ${filtered.length} items from branch ${cashierBranch}`)
    return filtered
  }

  // Managers can view branches they're assigned to (future feature)
  if (currentUser.role === 'manager') {
    const managerBranch = currentUser.branchId
    if (!managerBranch) {
      console.warn(`⚠️ Manager ${currentUser.name} has no assigned branch!`)
      return []
    }
    const filtered = inventory.filter(item => item.branchId === managerBranch)
    console.log(`👔 Manager ${currentUser.name} viewing ${filtered.length} items from branch ${managerBranch}`)
    return filtered
  }

  console.warn(`⚠️ Unknown user role: ${currentUser.role}`)
  return []
}

/**
 * Filter transactions by branch based on user role
 * @param {Array} transactions - All transactions
 * @param {Object} currentUser - Current logged-in user
 * @param {string} selectedBranch - Branch selected by admin (optional)
 * @param {string} selectedCashier - Cashier selected by admin (optional)
 * @returns {Array} Filtered transactions
 */
export function filterTransactionsByBranch(transactions, currentUser, selectedBranch = null, selectedCashier = null) {
  if (!transactions || !Array.isArray(transactions)) {
    return []
  }

  if (!currentUser) {
    console.warn('⚠️ filterTransactionsByBranch: No current user provided')
    return []
  }

  // Admin can view all branches or filter by selected branch/cashier
  if (currentUser.role === 'admin') {
    let filtered = transactions

    // Filter by branch if selected
    if (selectedBranch) {
      filtered = filtered.filter(t => t.branchId === selectedBranch)
      console.log(`👨‍💼 Admin viewing ${filtered.length} transactions from branch ${selectedBranch}`)
    } else {
      console.log(`👨‍💼 Admin viewing all ${filtered.length} transactions across all branches`)
    }

    // Further filter by cashier if selected
    if (selectedCashier) {
      filtered = filtered.filter(t => t.userId === selectedCashier)
      console.log(`👨‍💼 Admin viewing ${filtered.length} transactions from cashier ${selectedCashier}`)
    }

    return filtered
  }

  // Cashiers can ONLY see transactions from their branch
  if (currentUser.role === 'cashier') {
    const cashierBranch = currentUser.branchId
    if (!cashierBranch) {
      console.warn(`⚠️ Cashier ${currentUser.name} has no assigned branch!`)
      return []
    }
    const filtered = transactions.filter(t => t.branchId === cashierBranch)
    console.log(`👤 Cashier ${currentUser.name} viewing ${filtered.length} transactions from branch ${cashierBranch}`)
    return filtered
  }

  // Managers can view their branch transactions (future feature)
  if (currentUser.role === 'manager') {
    const managerBranch = currentUser.branchId
    if (!managerBranch) {
      console.warn(`⚠️ Manager ${currentUser.name} has no assigned branch!`)
      return []
    }
    const filtered = transactions.filter(t => t.branchId === managerBranch)
    console.log(`👔 Manager ${currentUser.name} viewing ${filtered.length} transactions from branch ${managerBranch}`)
    return filtered
  }

  console.warn(`⚠️ Unknown user role: ${currentUser.role}`)
  return []
}

/**
 * Filter expenses by branch based on user role
 * Note: Expenses are currently user-specific, not shared
 * @param {Array} expenses - All expenses
 * @param {Object} currentUser - Current logged-in user
 * @param {string} selectedBranch - Branch selected by admin (optional)
 * @returns {Array} Filtered expenses
 */
export function filterExpensesByBranch(expenses, currentUser, selectedBranch = null) {
  if (!expenses || !Array.isArray(expenses)) {
    return []
  }

  if (!currentUser) {
    console.warn('⚠️ filterExpensesByBranch: No current user provided')
    return []
  }

  // Admin can view all or filter by selected branch
  if (currentUser.role === 'admin') {
    if (selectedBranch) {
      const filtered = expenses.filter(e => e.branchId === selectedBranch)
      console.log(`👨‍💼 Admin viewing ${filtered.length} expenses from branch ${selectedBranch}`)
      return filtered
    }
    console.log(`👨‍💼 Admin viewing all ${expenses.length} expenses`)
    return expenses
  }

  // Cashiers can only see their branch expenses
  if (currentUser.role === 'cashier') {
    const cashierBranch = currentUser.branchId
    if (!cashierBranch) {
      console.warn(`⚠️ Cashier ${currentUser.name} has no assigned branch!`)
      return []
    }
    // Include items without branchId for backward compatibility
    const filtered = expenses.filter(e => e.branchId === cashierBranch || !e.branchId)
    console.log(`👤 Cashier ${currentUser.name} viewing ${filtered.length} expenses from branch ${cashierBranch}`)
    return filtered
  }

  console.warn(`⚠️ Unknown user role: ${currentUser.role}`)
  return []
}

/**
 * Check if user has permission to access a specific branch
 * @param {Object} currentUser - Current logged-in user
 * @param {string} branchId - Branch ID to check access for
 * @returns {boolean} True if user can access the branch
 */
export function canAccessBranch(currentUser, branchId) {
  if (!currentUser) {
    return false
  }

  // Admins can access all branches
  if (currentUser.role === 'admin') {
    return true
  }

  // Cashiers and managers can only access their assigned branch
  if (currentUser.role === 'cashier' || currentUser.role === 'manager') {
    return currentUser.branchId === branchId
  }

  return false
}

/**
 * Validate and ensure data has correct branchId before saving
 * @param {Object} item - Item to validate (inventory, transaction, etc.)
 * @param {Object} currentUser - Current logged-in user
 * @returns {Object} Item with validated branchId
 */
export function ensureBranchId(item, currentUser) {
  if (!currentUser) {
    console.warn('⚠️ ensureBranchId: No current user provided')
    return item
  }

  // If item already has a branchId, validate it
  if (item.branchId) {
    if (!canAccessBranch(currentUser, item.branchId)) {
      console.error(`🚫 User ${currentUser.name} attempting to save item to unauthorized branch ${item.branchId}`)
      // Force item to user's branch
      return {
        ...item,
        branchId: currentUser.branchId || null
      }
    }
    return item
  }

  // Add branchId if missing
  return {
    ...item,
    branchId: currentUser.branchId || null,
    createdBy: currentUser.id,
    createdAt: item.createdAt || new Date().toISOString()
  }
}

/**
 * Get user's accessible branches
 * @param {Object} currentUser - Current logged-in user
 * @param {Array} allBranches - All available branches
 * @returns {Array} Branches user can access
 */
export function getAccessibleBranches(currentUser, allBranches) {
  if (!currentUser || !allBranches) {
    return []
  }

  // Admins can access all branches
  if (currentUser.role === 'admin') {
    return allBranches
  }

  // Cashiers and managers can only access their assigned branch
  if (currentUser.role === 'cashier' || currentUser.role === 'manager') {
    return allBranches.filter(b => b.id === currentUser.branchId)
  }

  return []
}

/**
 * Log unauthorized access attempt
 * @param {Object} currentUser - Current logged-in user
 * @param {string} resource - Resource being accessed
 * @param {string} branchId - Branch ID attempted to access
 */
export function logUnauthorizedAccess(currentUser, resource, branchId) {
  const timestamp = new Date().toISOString()
  console.error(`🚫 UNAUTHORIZED ACCESS ATTEMPT [${timestamp}]`)
  console.error(`   User: ${currentUser?.name} (${currentUser?.role})`)
  console.error(`   User Branch: ${currentUser?.branchId}`)
  console.error(`   Attempted Resource: ${resource}`)
  console.error(`   Attempted Branch: ${branchId}`)
  
  // TODO: Could send this to a security audit log in production
}
