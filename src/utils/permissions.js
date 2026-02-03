/**
 * Centralized permissions logic for role-based access control
 * 
 * Roles:
 * - admin: Owner/Monitor (no branchId, read-only access to monitoring features)
 * - manager: Branch Manager (has branchId, manages branch operations + creates cashiers)
 * - cashier: Cashier (has branchId, POS + limited features)
 */

/**
 * Feature constants for permission checking
 */
export const FEATURES = {
  // View-only features (monitoring)
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_REPORTS: 'view_reports',
  VIEW_EXPENSES: 'view_expenses',
  VIEW_TRANSACTIONS: 'view_transactions',
  VIEW_BRANCH_REPORTS: 'view_branch_reports',
  
  // Operational features
  POS: 'pos',
  INVENTORY_VIEW: 'inventory_view',
  INVENTORY_MANAGE: 'inventory_manage',
  
  // User management
  MANAGE_USERS_BRANCH: 'manage_users_branch', // manager can manage cashiers in their branch
  
  // Settings
  ADMIN_SETTINGS: 'admin_settings',
  BRANCH_MANAGEMENT: 'branch_management',
  
  // Data operations
  MANAGE_CUSTOMERS: 'manage_customers',
  MANAGE_SUPPLIERS: 'manage_suppliers',
  MANAGE_PURCHASE_ORDERS: 'manage_purchase_orders',
  MANAGE_EXPENSES: 'manage_expenses',
  PROCESS_SALES: 'process_sales'
}

/**
 * Get base permissions for a role (before user-specific overrides)
 */
const getBasePermissions = (role) => {
  const permissions = {}
  
  switch (role) {
    case 'admin':
      // Admin: Monitoring only, no operational features
      permissions[FEATURES.VIEW_DASHBOARD] = true
      permissions[FEATURES.VIEW_REPORTS] = true
      permissions[FEATURES.VIEW_EXPENSES] = true
      permissions[FEATURES.VIEW_TRANSACTIONS] = true
      permissions[FEATURES.ADMIN_SETTINGS] = true
      permissions[FEATURES.BRANCH_MANAGEMENT] = true
      
      // Admin CANNOT do operational work
      permissions[FEATURES.POS] = false
      permissions[FEATURES.INVENTORY_MANAGE] = false
      permissions[FEATURES.INVENTORY_VIEW] = true // Read-only view
      permissions[FEATURES.MANAGE_USERS_BRANCH] = false
      permissions[FEATURES.MANAGE_CUSTOMERS] = false
      permissions[FEATURES.MANAGE_SUPPLIERS] = false
      permissions[FEATURES.MANAGE_PURCHASE_ORDERS] = false
      permissions[FEATURES.MANAGE_EXPENSES] = false
      permissions[FEATURES.PROCESS_SALES] = false
      break
      
    case 'manager':
      // Manager: Full branch operations + cashier management
      permissions[FEATURES.VIEW_DASHBOARD] = true
      permissions[FEATURES.VIEW_REPORTS] = true
      permissions[FEATURES.VIEW_EXPENSES] = true
      permissions[FEATURES.VIEW_TRANSACTIONS] = true
      permissions[FEATURES.VIEW_BRANCH_REPORTS] = true
      
      permissions[FEATURES.POS] = false // Managers typically don't operate POS
      permissions[FEATURES.INVENTORY_VIEW] = true
      permissions[FEATURES.INVENTORY_MANAGE] = true
      permissions[FEATURES.MANAGE_USERS_BRANCH] = true // Can create/manage cashiers
      permissions[FEATURES.MANAGE_CUSTOMERS] = true
      permissions[FEATURES.MANAGE_SUPPLIERS] = true
      permissions[FEATURES.MANAGE_PURCHASE_ORDERS] = true
      permissions[FEATURES.MANAGE_EXPENSES] = true
      permissions[FEATURES.PROCESS_SALES] = false
      
      permissions[FEATURES.ADMIN_SETTINGS] = false
      permissions[FEATURES.BRANCH_MANAGEMENT] = false
      break
      
    case 'cashier':
      // Cashier: POS + limited features
      permissions[FEATURES.POS] = true
      permissions[FEATURES.PROCESS_SALES] = true
      permissions[FEATURES.INVENTORY_VIEW] = true
      permissions[FEATURES.VIEW_BRANCH_REPORTS] = false // Can be toggled per user
      
      permissions[FEATURES.INVENTORY_MANAGE] = false
      permissions[FEATURES.MANAGE_USERS_BRANCH] = false
      permissions[FEATURES.MANAGE_CUSTOMERS] = false
      permissions[FEATURES.MANAGE_SUPPLIERS] = false
      permissions[FEATURES.MANAGE_PURCHASE_ORDERS] = false
      permissions[FEATURES.MANAGE_EXPENSES] = false
      
      permissions[FEATURES.VIEW_DASHBOARD] = true
      permissions[FEATURES.VIEW_REPORTS] = false
      permissions[FEATURES.VIEW_EXPENSES] = false
      permissions[FEATURES.VIEW_TRANSACTIONS] = false
      permissions[FEATURES.ADMIN_SETTINGS] = false
      permissions[FEATURES.BRANCH_MANAGEMENT] = false
      break
      
    default:
      // Unknown role: no permissions
      Object.values(FEATURES).forEach(feature => {
        permissions[feature] = false
      })
  }
  
  return permissions
}

/**
 * Get effective permissions for a user, including user-specific overrides
 * @param {Object} user - User object with role and optional permissions
 * @returns {Object} - Map of feature -> boolean
 */
export const getEffectivePermissions = (user) => {
  if (!user || !user.role) {
    // No user or role: deny all
    const denied = {}
    Object.values(FEATURES).forEach(feature => {
      denied[feature] = false
    })
    return denied
  }
  
  // Start with base permissions for the role
  const basePermissions = getBasePermissions(user.role)
  
  // Apply user-specific permission overrides (simple toggles)
  // These are stored in user.permissions as booleans
  if (user.permissions && typeof user.permissions === 'object') {
    // Map user permission keys to feature constants
    const permissionMap = {
      process_sales: FEATURES.PROCESS_SALES,
      view_inventory: FEATURES.INVENTORY_VIEW,
      manage_customers: FEATURES.MANAGE_CUSTOMERS,
      manage_expenses: FEATURES.MANAGE_EXPENSES,
      view_branch_reports: FEATURES.VIEW_BRANCH_REPORTS
    }
    
    Object.keys(permissionMap).forEach(key => {
      if (typeof user.permissions[key] === 'boolean') {
        const feature = permissionMap[key]
        // Only allow toggling if base role doesn't explicitly deny critical features
        // For example, admin can never get POS access via override
        if (user.role !== 'admin' || basePermissions[feature] !== false) {
          basePermissions[feature] = user.permissions[key]
        }
      }
    })
  }
  
  return basePermissions
}

/**
 * Check if a user has permission for a specific feature
 * @param {Object} user - User object
 * @param {string} feature - Feature constant from FEATURES
 * @returns {boolean} - True if user has permission
 */
export const can = (user, feature) => {
  const permissions = getEffectivePermissions(user)
  return permissions[feature] === true
}

/**
 * Check if user has required branchId for operational features
 * @param {Object} user - User object
 * @param {string} feature - Feature constant from FEATURES
 * @returns {Object} - { allowed: boolean, reason: string }
 */
export const canWithBranchCheck = (user, feature) => {
  // Check base permission first
  if (!can(user, feature)) {
    return { allowed: false, reason: 'Permission denied' }
  }
  
  // Operational features that require branchId
  const requiresBranch = [
    FEATURES.POS,
    FEATURES.INVENTORY_MANAGE,
    FEATURES.MANAGE_CUSTOMERS,
    FEATURES.MANAGE_SUPPLIERS,
    FEATURES.MANAGE_PURCHASE_ORDERS,
    FEATURES.MANAGE_EXPENSES,
    FEATURES.PROCESS_SALES,
    FEATURES.MANAGE_USERS_BRANCH
  ]
  
  if (requiresBranch.includes(feature)) {
    // Admin should never reach this (already denied above), but double-check
    if (user.role === 'admin') {
      return { allowed: false, reason: 'Admin cannot perform operational tasks' }
    }
    
    // Managers and cashiers need branchId for operations
    if (!user.branchId) {
      return { 
        allowed: false, 
        reason: 'You must be assigned to a branch to perform this action. Please contact your administrator.' 
      }
    }
  }
  
  return { allowed: true, reason: '' }
}

/**
 * Get list of pages accessible to a user based on their role
 * @param {Object} user - User object
 * @returns {Array<string>} - Array of page IDs
 */
export const getAccessiblePages = (user) => {
  if (!user || !user.role) return ['login']
  
  const permissions = getEffectivePermissions(user)
  const pages = ['profile', 'user-guide'] // Always accessible
  
  // Add role-specific pages
  if (user.role === 'admin') {
    pages.push(
      'admin-dashboard',
      'inventory',
      'reports',
      'expenses',
      'transactions-history',
      'admin-settings',
      'branch-management'
    )
  } else if (user.role === 'manager') {
    pages.push(
      'manager-dashboard',
      'inventory',
      'customers',
      'suppliers',
      'purchase-orders',
      'supplier-payments',
      'reports',
      'transactions-history',
      'branch-staff'
    )
  } else if (user.role === 'cashier') {
    pages.push(
      'cashier-dashboard',
      'pos',
      'inventory',
      'customers'
    )
    
    // Optional pages based on permissions
    if (permissions[FEATURES.VIEW_BRANCH_REPORTS]) {
      pages.push('reports', 'transactions-history')
    }
    if (permissions[FEATURES.MANAGE_SUPPLIERS]) {
      pages.push('suppliers', 'purchase-orders')
    }
  }
  
  return pages
}
