/**
 * Debug utilities for development mode
 * Conditionally logs only in development environment
 */

const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * Development-only console log
 */
export const devLog = (...args) => {
  if (isDevelopment) {
    console.log('[DEV]', ...args)
  }
}

/**
 * Development-only console warn
 */
export const devWarn = (...args) => {
  if (isDevelopment) {
    console.warn('[DEV WARNING]', ...args)
  }
}

/**
 * Development-only console error
 * Errors are always logged regardless of environment
 */
export const devError = (...args) => {
  console.error('[ERROR]', ...args)
}

/**
 * Development-only console table
 */
export const devTable = (data, label = '') => {
  if (isDevelopment) {
    console.log(`[DEV TABLE] ${label}`)
    console.table(data)
  }
}

/**
 * Development-only console group
 */
export const devGroup = (label, callback) => {
  if (isDevelopment) {
    console.group(`[DEV] ${label}`)
    callback()
    console.groupEnd()
  }
}

/**
 * Performance timing utility
 */
export const devTime = (label) => {
  if (isDevelopment) {
    console.time(`[DEV TIMER] ${label}`)
  }
}

export const devTimeEnd = (label) => {
  if (isDevelopment) {
    console.timeEnd(`[DEV TIMER] ${label}`)
  }
}

/**
 * Debug object with pretty formatting
 */
export const devDebug = (label, obj) => {
  if (isDevelopment) {
    console.log(`[DEV DEBUG] ${label}:`, JSON.stringify(obj, null, 2))
  }
}
