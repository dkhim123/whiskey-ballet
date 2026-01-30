/**
 * Subscribe to all branches for the current admin (real-time updates)
 * @param {function} onUpdate - Callback for data updates (array of branches)
 * @param {function} onError - Callback for errors
 * @returns {function} Unsubscribe function
 */
export function subscribeToBranches(onUpdate, onError) {
  const adminId = getCurrentAdminId();
  if (isFirebaseConfigured() && db) {
    const branchesCol = collection(db, 'organizations', adminId, COLLECTION_NAME);
    const unsubscribe = onSnapshot(
      branchesCol,
      (snapshot) => {
        const branches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        onUpdate(branches);
      },
      (error) => {
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } else {
    // Fallback: strictly filter by adminId and purge on mismatch
    (async () => {
      try {
        const indexedDb = await getDB();
        const tx = indexedDb.transaction(STORES.BRANCHES, 'readonly');
        const store = tx.objectStore(STORES.BRANCHES);
        const index = store.index('adminId');
        const request = index.getAll(adminId);
        request.onsuccess = () => {
          const items = request.result || [];
          const filtered = items.filter(b => b.adminId === adminId && b.isActive);
          if (items.some(b => b.adminId !== adminId)) {
            import('../utils/clearLocalData').then(({ default: clearLocalData }) => clearLocalData());
            onUpdate([]);
          } else {
            onUpdate(filtered);
          }
        };
        request.onerror = () => {
          if (onError) onError(request.error);
        };
      } catch (error) {
        if (onError) onError(error);
      }
    })();
    return () => {}; // no-op unsubscribe
  }
}
/**
 * Branch Service - Manages branch data with hybrid storage (IndexedDB + Firebase)
 * Stores branches locally for offline access and syncs to Firestore for real-time updates
 */

import { db, isFirebaseConfigured } from '../config/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { getDB, STORES } from '../utils/indexedDBStorage';

const STORAGE_KEY = 'pos-branches';
const COLLECTION_NAME = 'branches';

// Offline queue for operations when Firebase is unavailable
let offlineQueue = [];

// Track if event listeners have been initialized to prevent duplicates
let listenersInitialized = false;

/**
 * Get current admin ID from localStorage
 */
function getCurrentAdminId() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  return currentUser.adminId || currentUser.id;
}

/**
 * Save branch to localStorage (quick access)
 */
function saveBranchLocally(branch) {
  try {
    const branches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const existingIndex = branches.findIndex(b => b.id === branch.id);
    
    if (existingIndex >= 0) {
      branches[existingIndex] = branch;
    } else {
      branches.push(branch);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branches));
    return true;
  } catch (error) {
    console.error('Error saving branch locally:', error);
    return false;
  }
}

/**
 * Save branch to IndexedDB (persistent storage)
 */
async function saveBranchToIndexedDB(branch) {
  try {
    const indexedDb = await getDB();
    const tx = indexedDb.transaction(STORES.BRANCHES, 'readwrite');
    const store = tx.objectStore(STORES.BRANCHES);
    
    await store.put(branch);
    await tx.done;
    
    return true;
  } catch (error) {
    console.error('Error saving branch to IndexedDB:', error);
    return false;
  }
}

/**
 * Save branch to Firebase Firestore
 */
async function saveBranchToFirebase(branch) {
  // Temporarily disable Firebase to avoid errors
  return false;
  
  /* Firebase sync disabled - uncomment when ready
  if (!isFirebaseConfigured() || !db) {
    console.warn('Firebase not configured, skipping cloud sync');
    return false;
  }

  try {
    const adminId = getCurrentAdminId();
    const branchRef = doc(db, 'organizations', adminId, COLLECTION_NAME, branch.id);
    
    await setDoc(branchRef, {
      ...branch,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('✅ Branch synced to Firebase:', branch.name);
    return true;
  } catch (error) {
    console.error('Error saving branch to Firebase:', error);
    // Add to offline queue
    offlineQueue.push({ action: 'save', data: branch });
    return false;
  }
  */
}

/**
 * Create a new branch (hybrid storage)
 * @param {Object} branchData - { name, description }
 * @returns {Promise<Object>} Created branch object
 */
export async function createBranch(branchData) {
  const adminId = getCurrentAdminId();
  const branchId = `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const branch = {
    id: branchId,
    adminId,
    name: branchData.name,
    description: branchData.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true
  };

  // Save to all storage layers
  saveBranchLocally(branch);
  await saveBranchToIndexedDB(branch);
  // Firebase temporarily disabled
  // await saveBranchToFirebase(branch);

  console.log('✅ Branch created:', branch.name);
  return branch;
}

/**
 * Get all branches for current admin
 * @returns {Promise<Array>} Array of branch objects
 */
export async function getAllBranches() {
  const adminId = getCurrentAdminId();
  
  try {
    // Firebase temporarily disabled - using IndexedDB only
    
    // Load from IndexedDB
    const indexedDb = await getDB();
    const tx = indexedDb.transaction(STORES.BRANCHES, 'readonly');
    const store = tx.objectStore(STORES.BRANCHES);
    
    // Need to wait for the request to complete
    const getAllRequest = store.getAll();
    const allBranches = await new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
    
    // Strict adminId filtering and purge if ghost data found
    const userBranches = allBranches.filter(b => b.adminId === adminId && b.isActive);
    if ((allBranches || []).some(b => b.adminId !== adminId)) {
      import('../utils/clearLocalData').then(({ default: clearLocalData }) => clearLocalData());
      return [];
    }
    return userBranches;
  } catch (error) {
    console.error('Error loading branches from IndexedDB:', error);
    
    // Final fallback to localStorage
    const branches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // ...existing code...
    return branches.filter(b => b.isActive);
  }
}


/**
 * Subscribe to a single branch by ID (real-time updates)
 * @param {string} branchId - Branch ID
 * @param {function} onUpdate - Callback for data updates
 * @param {function} onError - Callback for errors
 * @returns {function} Unsubscribe function
 */
export function subscribeToBranch(branchId, onUpdate, onError) {
  const adminId = getCurrentAdminId();
  if (isFirebaseConfigured() && db) {
    const branchRef = doc(db, 'organizations', adminId, COLLECTION_NAME, branchId);
    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      branchRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate({ id: snapshot.id, ...snapshot.data() });
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } else {
    // Fallback: immediately call onUpdate with local/IndexedDB data
    (async () => {
      try {
        const indexedDb = await getDB();
        const tx = indexedDb.transaction(STORES.BRANCHES, 'readonly');
        const store = tx.objectStore(STORES.BRANCHES);
        const branch = await store.get(branchId);
        if (branch && branch.adminId === adminId) {
          onUpdate(branch);
        } else {
          onUpdate(null);
        }
      } catch (error) {
        if (onError) onError(error);
      }
    })();
    return () => {}; // no-op unsubscribe
  }
}

/**
 * Get a single branch by ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object|null>} Branch object or null if not found
 */
export async function getBranch(branchId) {
  if (!branchId) {
    throw new Error('Branch ID is required');
  }

  const adminId = getCurrentAdminId();
  
  try {
    // Load from IndexedDB
    const indexedDb = await getDB();
    const tx = indexedDb.transaction(STORES.BRANCHES, 'readonly');
    const store = tx.objectStore(STORES.BRANCHES);
    
    const getRequest = store.get(branchId);
    const branch = await new Promise((resolve, reject) => {
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    });
    
    // Verify branch belongs to current admin
    if (branch && branch.adminId === adminId) {
      return branch;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading branch from IndexedDB:', error);
    
    // Fallback to localStorage
    const branches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return branches.find(b => b.id === branchId && b.adminId === adminId) || null;
  }
}

/**
 * Update an existing branch
 * @param {string} branchId - Branch ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated branch object
 */
export async function updateBranch(branchId, updates) {
  if (!branchId) {
    throw new Error('Branch ID is required to update a branch.');
  }

  const adminId = getCurrentAdminId();
  const existingBranch = await getBranch(branchId);

  if (!existingBranch) {
    throw new Error('Branch not found');
  }

  const updatedBranch = {
    ...existingBranch,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Update all storage layers
  saveBranchLocally(updatedBranch);
  await saveBranchToIndexedDB(updatedBranch);
  await saveBranchToFirebase(updatedBranch);

  console.log('✅ Branch updated:', updatedBranch.name);
  return updatedBranch;
}

/**
 * Delete a branch (soft delete - sets isActive to false)
 * @param {string} branchId - Branch ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteBranch(branchId) {
  return await updateBranch(branchId, { isActive: false });
}

/**
 * Get all cashiers assigned to a specific branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of user objects
 */
export async function getBranchCashiers(branchId) {
  try {
    console.log('🔍 getBranchCashiers called with branchId:', branchId, typeof branchId);
    
    // Read users from localStorage (same key as auth.js)
    const USERS_STORAGE_KEY = 'pos-users-db';
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    const allUsers = stored ? JSON.parse(stored) : [];
    
    console.log('👥 All users from localStorage:', allUsers.map(u => ({
      name: u.name,
      role: u.role,
      branchId: u.branchId,
      branchIdType: typeof u.branchId
    })));
    
    const branchCashiers = allUsers.filter(user => {
      const matches = user.branchId === branchId && user.role === 'cashier';
      if (user.role === 'cashier') {
        console.log(`Cashier ${user.name}: branchId="${user.branchId}" vs searching="${branchId}" - Match: ${matches}`);
      }
      return matches;
    });
    
    console.log('✅ Found', branchCashiers.length, 'cashiers for branch', branchId);
    return branchCashiers;
  } catch (error) {
    console.error('Error getting branch cashiers:', error);
    return [];
  }
}

/**
 * Get default branch ID for current admin
 * If only one branch exists, return it. Otherwise, return null.
 * @returns {Promise<string|null>} Branch ID or null
 */
export async function getDefaultBranchId() {
  const branches = await getAllBranches();
  
  if (branches.length === 1) {
    return branches[0].id;
  }
  
  // Check localStorage for user's last selected branch
  const lastBranchId = localStorage.getItem('lastSelectedBranch');
  if (lastBranchId && branches.some(b => b.id === lastBranchId)) {
    return lastBranchId;
  }
  
  return null;
}

/**
 * Set default branch for quick access
 * @param {string} branchId - Branch ID
 */
export function setDefaultBranch(branchId) {
  localStorage.setItem('lastSelectedBranch', branchId);
}

/**
 * Process offline queue when connection is restored
 */
export async function processOfflineQueue() {
  if (offlineQueue.length === 0) return;
  
  console.log(`📤 Processing ${offlineQueue.length} offline operations...`);
  
  const queue = [...offlineQueue];
  offlineQueue = [];
  
  for (const operation of queue) {
    try {
      if (operation.action === 'save') {
        await saveBranchToFirebase(operation.data);
      }
    } catch (error) {
      console.error('Error processing offline operation:', error);
      offlineQueue.push(operation); // Re-add to queue
    }
  }
}

/**
 * Initialize branch service (check for offline queue)
 */
export function initializeBranchService() {
  // Load offline queue from localStorage if exists
  try {
    const savedQueue = localStorage.getItem('branch-offline-queue');
    if (savedQueue) {
      offlineQueue = JSON.parse(savedQueue);
      localStorage.removeItem('branch-offline-queue');
      
      // Firebase temporarily disabled
      // Process queue when online
      // if (navigator.onLine && isFirebaseConfigured() && db) {
      //   processOfflineQueue();
      // }
    }
  } catch (error) {
    console.error('Error loading offline queue:', error);
  }

  // Only add event listeners once to prevent memory leaks
  if (!listenersInitialized) {
    listenersInitialized = true;
    
    // Save queue on page unload
    window.addEventListener('beforeunload', () => {
      if (offlineQueue.length > 0) {
        localStorage.setItem('branch-offline-queue', JSON.stringify(offlineQueue));
      }
    });

    // Firebase temporarily disabled
    // Process queue when connection is restored
    // window.addEventListener('online', () => {
    //   if (isFirebaseConfigured() && db) {
    //     processOfflineQueue();
    //   }
    // });
  }
}
