/**
 * Database Cleanup Utility (Offline Mode)
 * WARNING: This will delete ALL data from local storage
 * Use with extreme caution - this action is irreversible!
 */

/**
 * Clear all local storage data (except user accounts and session)
 */
export const clearLocalStorage = () => {
  try {
    const keys = Object.keys(localStorage)
    console.log(`🗑️ Clearing ${keys.length} items from localStorage`)
    
    const usersDb = localStorage.getItem('pos-users-db')
    const userSession = localStorage.getItem('pos-user-session')
    const loginAttempts = localStorage.getItem('pos-login-attempts')
    
    localStorage.clear()
    
    if (usersDb) {
      localStorage.setItem('pos-users-db', usersDb)
      console.log('✅ Preserved user accounts')
    }
    if (userSession) {
      localStorage.setItem('pos-user-session', userSession)
      console.log('✅ Preserved user session')
    }
    if (loginAttempts) {
      localStorage.setItem('pos-login-attempts', loginAttempts)
      console.log('✅ Preserved login attempts tracking')
    }
    
    console.log('✅ Local storage cleared successfully')
    return { success: true, cleared: keys.length }
  } catch (error) {
    console.error('❌ Error clearing local storage:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Clear Firebase data (offline mode - not available)
 */
export const clearFirebaseData = async () => {
  return { 
    success: false, 
    error: 'Firebase not available in offline mode',
    offline: true
  }
}

/**
 * Clear all data (offline mode)
 */
export const clearAllData = async () => {
  console.log('🗑️ Starting data cleanup (offline mode)...')
  
  const results = {
    localStorage: clearLocalStorage(),
    firebase: await clearFirebaseData()
  }
  
  const success = results.localStorage.success
  
  if (success) {
    console.log('✅ Cleanup finished successfully')
  } else {
    console.log('⚠️ Cleanup completed with errors')
  }
  
  return {
    success,
    results,
    message: success ? 'All local data cleared' : 'Some data may not have been cleared'
  }
}

/**
 * Safe cleanup with confirmation
 */
export const clearAllDataWithConfirmation = async () => {
  const confirmation1 = confirm(
    '⚠️ WARNING: DELETE ALL LOCAL DATA!\n\n' +
    'This includes:\n' +
    '• All products\n' +
    '• All transactions\n' +
    '• All customers\n' +
    '• All suppliers\n\n' +
    'This CANNOT be undone!\n\n' +
    'Are you sure?'
  )
  
  if (!confirmation1) {
    console.log('❌ Cleanup cancelled')
    return { success: false, cancelled: true }
  }
  
  const confirmation2 = confirm('🚨 FINAL WARNING!\n\nClick OK to delete all data.')
  
  if (!confirmation2) {
    console.log('❌ Cleanup cancelled')
    return { success: false, cancelled: true }
  }
  
  const userInput = prompt('Type "DELETE ALL DATA" to confirm:')
  
  if (userInput !== 'DELETE ALL DATA') {
    console.log('❌ Cleanup cancelled - incorrect confirmation')
    alert('Cleanup cancelled - incorrect confirmation text')
    return { success: false, cancelled: true }
  }
  
  console.log('✅ User confirmed - proceeding...')
  
  const results = await clearAllData()
  
  if (results.success) {
    alert('✅ All local data deleted!\n\nClick OK to refresh.')
    window.location.reload()
  } else {
    alert('⚠️ Cleanup completed with errors.\n\nCheck console.')
  }
  
  return results
}

// Global access
if (typeof window !== 'undefined') {
  window.clearAllData = clearAllDataWithConfirmation
  window.clearLocalStorage = clearLocalStorage
  
  console.log('🛠️ Cleanup utilities loaded (offline):')
  console.log('  • clearAllData() - Clear with confirmation')
  console.log('  • clearLocalStorage() - Clear storage only')
}
