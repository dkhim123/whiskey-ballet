/**
 * Common Date Utilities
 * Centralized date functions to avoid duplication
 */

/**
 * Get today's date at midnight (normalized)
 */
export function getTodayAtMidnight() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/**
 * Get today as ISO date string (YYYY-MM-DD)
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Check if a date is today
 */
export function isToday(date) {
  const today = getTodayAtMidnight()
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  return today.getTime() === compareDate.getTime()
}

/**
 * Format time ago from timestamp
 */
export function formatTimeAgo(timestamp) {
  const timeDiff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(timeDiff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes} min ago`
  return 'Just now'
}

/**
 * Normalize date to midnight for comparison
 */
export function normalizeDate(date) {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}
