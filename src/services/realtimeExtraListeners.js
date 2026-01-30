// Real-time listeners for additional Firestore collections
import { db } from '../config/firebase';
import { subscribeToCollection } from './subscribeToCollection';

export function subscribeToPurchaseOrders(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'purchaseOrders',
    adminId,
    onUpdate,
    onError
  });
}

export function subscribeToSupplierPayments(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'supplierPayments',
    adminId,
    onUpdate,
    onError
  });
}

export function subscribeToGoodsReceivedNotes(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'goodsReceivedNotes',
    adminId,
    onUpdate,
    onError
  });
}

export function subscribeToExpenses(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'expenses',
    adminId,
    onUpdate,
    onError
  });
}
