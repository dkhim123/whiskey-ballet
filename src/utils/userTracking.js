/**
 * User tracking utilities for audit trail and accountability
 */

/**
 * Create a user snapshot for tracking purposes
 * This ensures consistent user data structure across all tracking fields
 * @param {object} user - The current user object
 * @returns {object} User snapshot with id, name, and role
 */
export const createUserSnapshot = (user) => {
  if (!user) {
    return {
      id: null,
      name: 'Unknown',
      role: 'unknown'
    }
  }

  return {
    id: user.id,
    name: user.name || user.email || 'Unknown',
    role: user.role || 'unknown'
  }
}

/**
 * Format receivedBy field for display (handles backward compatibility)
 * Supports both old string format and new object format
 * @param {string|object} receivedBy - The receivedBy field (string or object)
 * @returns {string} Formatted string for display
 */
export const formatReceivedBy = (receivedBy) => {
  if (!receivedBy) {
    return 'Unknown'
  }

  // Handle string format (old data)
  if (typeof receivedBy === 'string') {
    return receivedBy
  }

  // Handle object format (new data) - check for null explicitly before typeof
  if (receivedBy !== null && typeof receivedBy === 'object') {
    const name = receivedBy.name || 'Unknown'
    const role = receivedBy.role || 'Unknown'
    return `${name} (${role})`
  }

  return 'Unknown'
}

/**
 * Get display name from receivedBy field (name only, no role)
 * @param {string|object} receivedBy - The receivedBy field
 * @returns {string} User name
 */
export const getReceivedByName = (receivedBy) => {
  if (!receivedBy) {
    return 'Unknown'
  }

  if (typeof receivedBy === 'string') {
    return receivedBy
  }

  if (receivedBy !== null && typeof receivedBy === 'object') {
    return receivedBy.name || 'Unknown'
  }

  return 'Unknown'
}

/**
 * Get role from receivedBy field
 * @param {string|object} receivedBy - The receivedBy field
 * @returns {string|null} User role or null if not available
 */
export const getReceivedByRole = (receivedBy) => {
  if (!receivedBy || typeof receivedBy !== 'object') {
    return null
  }

  return receivedBy.role || null
}
