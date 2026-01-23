/**
 * Time and date formatting utilities
 */

/**
 * Format a timestamp to relative time (e.g., "2 hours ago")
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Formatted relative time string
 */
export const formatRelativeTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

/**
 * Format a date to a localized string
 * @param {string|Date} date - The date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  const dateObj = new Date(date)
  return dateObj.toLocaleDateString(undefined, options)
}

/**
 * Format a date to include time
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (date) => {
  const dateObj = new Date(date)
  return dateObj.toLocaleString()
}
