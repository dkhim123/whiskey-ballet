// Inventory real-time listener
import { db } from '../config/firebase';
import { subscribeToCollection } from './subscribeToCollection';

export function subscribeToInventory(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'inventory',
    adminId,
    onUpdate,
    onError
  });
}

// Transactions real-time listener
export function subscribeToTransactions(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'transactions',
    adminId,
    onUpdate,
    onError
  });
}

// Customers real-time listener
export function subscribeToCustomers(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'customers',
    adminId,
    onUpdate,
    onError
  });
}

// Suppliers real-time listener
export function subscribeToSuppliers(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'suppliers',
    adminId,
    onUpdate,
    onError
  });
}

export { subscribeToSuppliers, subscribeToTransactions, subscribeToInventory, subscribeToExpenses }; // Add other functions as needed
