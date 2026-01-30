/**
 * Branch ID Validation Utilities
 * Standardizes branchId handling across the application
 */

/**
 * Check if a branchId is valid (not null, undefined, empty string, or 'NO_BRANCH')
 * @param {*} branchId - Branch ID to validate
 * @returns {boolean} True if branchId is valid
 */
export function isValidBranchId(branchId) {
  return !!(branchId && branchId !== 'NO_BRANCH' && branchId !== '');
}

/**
 * Normalize branchId to null if invalid, otherwise return as-is
 * @param {*} branchId - Branch ID to normalize
 * @returns {string|null} Normalized branch ID or null
 */
export function normalizeBranchId(branchId) {
  return isValidBranchId(branchId) ? branchId : null;
}

/**
 * Validate that an entity has a valid branchId
 * @param {Object} entity - Entity to validate
 * @param {string} entityType - Type of entity for error message
 * @throws {Error} If branchId is invalid
 */
export function requireValidBranchId(entity, entityType = 'Entity') {
  if (!entity) {
    throw new Error(`${entityType} is required`);
  }
  if (!isValidBranchId(entity.branchId)) {
    throw new Error(`${entityType} must have a valid branchId`);
  }
}

/**
 * Ensure entity has branchId, using fallback if not present
 * @param {Object} entity - Entity to check
 * @param {string|null} fallbackBranchId - Fallback branchId to use
 * @returns {Object} Entity with branchId set
 */
export function ensureBranchId(entity, fallbackBranchId) {
  if (!entity) return entity;
  
  return {
    ...entity,
    branchId: isValidBranchId(entity.branchId) 
      ? entity.branchId 
      : normalizeBranchId(fallbackBranchId)
  };
}

/**
 * Filter items by branchId
 * @param {Array} items - Items to filter
 * @param {string|null} branchId - Branch ID to filter by (null returns all)
 * @returns {Array} Filtered items
 */
export function filterByBranchId(items, branchId) {
  if (!Array.isArray(items)) return [];
  if (!branchId) return items;
  
  return items.filter(item => item.branchId === branchId);
}

/**
 * Check if user has access to a specific branch
 * @param {Object} user - User object with role and branchId
 * @param {string} targetBranchId - Branch ID to check access for
 * @returns {boolean} True if user has access
 */
export function canAccessBranch(user, targetBranchId) {
  if (!user) return false;
  
  // Admins can access all branches
  if (user.role === 'admin') return true;
  
  // Cashiers and managers can only access their assigned branch
  return user.branchId === targetBranchId;
}
