/**
 * Helper functions for name formatting
 */

/**
 * Extract first name from a full name
 * @param {string} fullName - Full name (e.g., "John Doe" or "Jane")
 * @returns {string} First name only
 */
export const getFirstName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') {
    return 'User'
  }
  
  const trimmed = fullName.trim()
  if (!trimmed) {
    return 'User'
  }
  
  // Split by space and take first part
  const parts = trimmed.split(/\s+/)
  return parts[0]
}

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (e.g., "JD" for "John Doe")
 */
export const getInitials = (name) => {
  if (!name || typeof name !== 'string') {
    return 'U'
  }
  
  const trimmed = name.trim()
  if (!trimmed) {
    return 'U'
  }
  
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
