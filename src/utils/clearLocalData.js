// utils/clearLocalData.js
// Central utility to clear all local data (IndexedDB + localStorage) safely

import db from './database'

const INDEXEDDB_NAME = 'WhiskeyBalletPOS'

/**
 * Checks if there are any pending offline writes (unsynced data)
 * Returns true if safe to clear, false if pending writes exist
 */
export async function isSafeToClear() {
  // Check SYNC_QUEUE for unsynced items
  const unsynced = await db.getUnsyncedItems('sync_queue')
  return !unsynced || unsynced.length === 0
}

/**
 * Clears all localStorage keys related to user/session/branches
 */
export function clearLocalStorageKeys() {
  localStorage.removeItem('pos-branches')
  localStorage.removeItem('currentUser')
  localStorage.removeItem('lastSelectedBranch')
  localStorage.removeItem('branch-offline-queue')
  localStorage.removeItem('lastSync')
  // Add more keys as needed
}

/**
 * Deletes the IndexedDB database for the app (version-agnostic)
 * Only clears local/session storage after successful DB deletion
 */
export function clearIndexedDBAndStorage() {
  return new Promise((resolve, reject) => {
    if (window.indexedDB) {
      const req = window.indexedDB.deleteDatabase(INDEXEDDB_NAME)
         req.onsuccess = function() { 
           localStorage.clear(); 
           if (typeof sessionStorage !== 'undefined') sessionStorage.clear(); 
           resolve(true); 
      }
         req.onerror = function() { reject(req.error) }
         req.onblocked = function() { reject('blocked') }
    } else {
      resolve(false)
    }
  })
}

/**
 * Main function to clear all local data, only if safe (no pending sync)
 * Returns true if cleared, false if not safe
 */
export async function clearLocalDataIfSafe() {
  const safe = await isSafeToClear()
  if (!safe) {
    alert('Cannot clear local data: pending offline sync. Please connect to the internet and sync first.')
    return false
  }
  await clearIndexedDBAndStorage()
  return true
}

/**
 * Force clear all local data (use with caution, may lose unsynced data)
 */
export async function forceClearLocalData() {
  await clearIndexedDBAndStorage()
  return true
}
