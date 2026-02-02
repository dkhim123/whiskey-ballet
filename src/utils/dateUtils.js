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
 * Get milliseconds since epoch from any timestamp format.
 * Handles: Firestore Timestamp (object with .toDate or .seconds), ISO string, or number.
 * Returns NaN if invalid.
 */
export function getTimestampMs(timestamp) {
  if (timestamp == null) return NaN
  // Firestore Timestamp: has .toDate() or .seconds
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate().getTime()
  if (typeof timestamp?.seconds === 'number') return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1e6
  const d = new Date(timestamp)
  return isNaN(d.getTime()) ? NaN : d.getTime()
}

/**
 * Format time ago from timestamp
 */
export function formatTimeAgo(timestamp) {
  const timeDiff = Date.now() - getTimestampMs(timestamp)
  const minutes = Math.floor(timeDiff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes} min ago`
  return 'Just now'
}

/**
 * Check if a timestamp falls within the last N milliseconds (e.g. last 24h).
 */
export function isWithinLastMs(timestamp, ms) {
  const ts = getTimestampMs(timestamp)
  return !Number.isNaN(ts) && ts >= Date.now() - ms
}

/**
 * Normalize date to midnight for comparison
 */
export function normalizeDate(date) {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}
