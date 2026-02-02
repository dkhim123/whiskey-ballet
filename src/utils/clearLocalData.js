// utils/clearLocalData.js
// Central utility to clear all local data (IndexedDB + localStorage) safely

const INDEXEDDB_NAME = 'WhiskeyBalletPOS'
const SYNC_QUEUE_KEY = 'pos-sync-queue'
const BRANCH_QUEUE_KEY = 'branch-offline-queue'

/**
 * Checks if there are any pending offline writes (unsynced data)
 * Returns true if safe to clear, false if pending writes exist
 */
export async function isSafeToClear() {
  // Important: this runs during login/logout. It must never hang.
  // Our current sync system stores pending writes in localStorage.
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return true

    const syncQueueRaw = localStorage.getItem(SYNC_QUEUE_KEY)
    const syncQueue = syncQueueRaw ? JSON.parse(syncQueueRaw) : []

    const branchQueueRaw = localStorage.getItem(BRANCH_QUEUE_KEY)
    const branchQueue = branchQueueRaw ? JSON.parse(branchQueueRaw) : []

    return (syncQueue?.length || 0) === 0 && (branchQueue?.length || 0) === 0
  } catch (e) {
    // If we can't read/parse the queues, assume it's NOT safe to wipe data.
    console.warn('isSafeToClear failed; assuming NOT safe:', e)
    return false
  }
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
           // Do NOT nuke all localStorage; keep offline users and other app config.
           clearLocalStorageKeys()
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
export async function clearLocalDataIfSafe(options = { deleteIndexedDB: false }) {
  const safe = await isSafeToClear()
  if (!safe) {
    alert('Cannot clear local data: pending offline sync. Please connect to the internet and sync first.')
    return false
  }

  // Default behavior: only clear *session/branch* keys (fast, cannot hang).
  // Deleting IndexedDB is an explicit opt-in.
  clearLocalStorageKeys()
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()

  if (options?.deleteIndexedDB) {
    await clearIndexedDBAndStorage()
  }

  return true
}

/**
 * Force clear all local data (use with caution, may lose unsynced data)
 */
export async function forceClearLocalData() {
  // Force clear deletes IndexedDB too (may lose unsynced data)
  await clearIndexedDBAndStorage()
  return true
}
