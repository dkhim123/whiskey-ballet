// Generic Firestore real-time collection subscription utility
// Usage: subscribeToCollection({
//   db, collectionPath, adminId, onUpdate, onError
// })

import { collection, onSnapshot, query as fsQuery } from 'firebase/firestore';

/**
 * Subscribe to a Firestore collection for a specific admin (real-time updates)
 * @param {Object} params
 * @param {object} params.db - Firestore db instance
 * @param {string} params.collectionPath - Path to the collection (e.g., 'transactions')
 * @param {string} params.adminId - Admin/organization ID to filter by
 * @param {function} params.onUpdate - Callback for data updates (array of docs)
 * @param {function} [params.onError] - Callback for errors
 * @returns {function} Unsubscribe function
 */
export function subscribeToCollection({ db, collectionPath, adminId, onUpdate, onError, queryConstraints = [] }) {
  // Firestore instances don't have a stable `type` field; the previous check caused
  // realtime subscriptions to be skipped and forced IndexedDB fallback.
  //
  // This app's canonical cloud path is:
  //   organizations/{adminId}/{collectionPath}
  //
  // (adminId is already encoded in the path, so no `where('adminId','==',...)` needed)
  if (db && typeof window !== 'undefined' && adminId) {
    let colRef = collection(db, 'organizations', adminId, collectionPath);
    if (Array.isArray(queryConstraints) && queryConstraints.length > 0) {
      colRef = fsQuery(colRef, ...queryConstraints)
    }
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        // Preserve stored numeric id when present (e.g. inventory uses id: 1,2,...; Firestore doc id is b_branch_1).
        // Using doc.id for everything would break inventory branch isolation on subsequent writes.
        const data = snapshot.docs.map(doc => {
          const d = doc.data()
          const id = d?.id !== undefined && d?.id !== null ? d.id : doc.id
          return { ...d, id }
        })
        onUpdate(data)
      },
      (error) => {
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } else {
    // IndexedDB fallback: poll for updates (no real-time in IndexedDB)
    const POLL_INTERVAL_MS = 5000; // Refresh every 5 seconds when offline
    let intervalId = null;

    const fetchFromIndexedDB = () => {
      import('../utils/indexedDBStorage').then(({ getAllItems, STORES }) => {
        let storeName = collectionPath;
        if (storeName === 'transactions') storeName = STORES.TRANSACTIONS;
        if (storeName === 'inventory') storeName = STORES.INVENTORY;
        if (storeName === 'customers') storeName = STORES.CUSTOMERS;
        if (storeName === 'expenses') storeName = STORES.EXPENSES;
        if (storeName === 'branches') storeName = STORES.BRANCHES;
        if (storeName === 'users') storeName = STORES.USERS;
        if (storeName === 'settings') storeName = STORES.SETTINGS;
        getAllItems(storeName, adminId).then(items => {
          const filtered = (items || []).filter(item => item.adminId === adminId);
          if ((items || []).some(item => item.adminId !== adminId)) {
            import('../utils/clearLocalData').then(({ default: clearLocalData }) => clearLocalData()).catch(err => {
              if (onError) onError(err);
            });
            onUpdate([]);
          } else {
            onUpdate(filtered);
          }
        }).catch(error => {
          if (onError) onError(error);
        });
      }).catch(error => {
        if (onError) onError(error);
      });
    };

    fetchFromIndexedDB(); // Initial fetch
    intervalId = setInterval(fetchFromIndexedDB, POLL_INTERVAL_MS);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }
}
