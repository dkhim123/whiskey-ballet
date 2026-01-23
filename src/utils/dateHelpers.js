/**
 * Helper functions for date and expiry calculations
 */

/**
 * Check if a product is expired
 * @param {string|Date} expiryDate - The expiry date to check
 * @returns {boolean} - True if expired, false otherwise
 */
export const isExpired = (expiryDate) => {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

/**
 * Check if a product is expiring soon (within 7 days)
 * @param {string|Date} expiryDate - The expiry date to check
 * @returns {boolean} - True if expiring soon, false otherwise
 */
export const isExpiringSoon = (expiryDate) => {
  if (!expiryDate) return false
  const expiry = new Date(expiryDate)
  const today = new Date()
  const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry <= 7 && daysUntilExpiry >= 0
}

/**
 * Parse form input value based on field type
 * @param {string} name - Field name
 * @param {any} value - Field value
 * @param {string} type - Input type (checkbox, etc.)
 * @param {boolean} checked - Checkbox checked state
 * @returns {any} - Parsed value
 */
export const parseFormValue = (name, value, type, checked) => {
  if (type === "checkbox") return checked
  if (name === "loanAmount" || name === "creditLimit" || name === "discountRate") {
    return Number.parseFloat(value) || 0
  }
  return value
}
