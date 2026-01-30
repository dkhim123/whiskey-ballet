// Generic Firestore real-time collection subscription utility
// Usage: subscribeToCollection({
//   db, collectionPath, adminId, onUpdate, onError
// })

import { collection, query, where, onSnapshot } from 'firebase/firestore';

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
export function subscribeToCollection({ db, collectionPath, adminId, onUpdate, onError }) {
  if (db && typeof window !== 'undefined' && db.type === 'firestore') {
    const colRef = collection(db, collectionPath);
    const q = query(colRef, where('adminId', '==', adminId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        onUpdate(data);
      },
      (error) => {
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } else {
    // IndexedDB fallback: strict adminId filtering
    import('../utils/indexedDBStorage').then(({ getAllItems, STORES }) => {
      let storeName = collectionPath;
      // Map known collection paths to store names if needed
      if (storeName === 'transactions') storeName = STORES.TRANSACTIONS;
      if (storeName === 'inventory') storeName = STORES.INVENTORY;
      if (storeName === 'customers') storeName = STORES.CUSTOMERS;
      if (storeName === 'branches') storeName = STORES.BRANCHES;
      getAllItems(storeName, adminId).then(items => {
        // Strict adminId filtering (defense-in-depth)
          const filtered = (items || []).filter(item => item.adminId === adminId);
          // If any item does not match adminId, purge all local data
          if ((items || []).some(item => item.adminId !== adminId)) {
            import('../utils/clearLocalData').then(({ default: clearLocalData }) => clearLocalData()).catch(err => {
              console.error('Error clearing local data:', err);
              if (onError) onError(err);
            });
            onUpdate([]);
          } else {
            onUpdate(filtered);
          }
      }).catch(error => {
        console.error('Error getting items from IndexedDB:', error);
        if (onError) onError(error);
      });
    }).catch(error => {
      console.error('Error importing indexedDBStorage:', error);
      if (onError) onError(error);
    });
    return () => {};
  }
}
