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

// Expenses real-time listener
export function subscribeToExpenses(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'expenses',
    adminId,
    onUpdate,
    onError
  });
}

// Users real-time listener
export function subscribeToUsers(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'users',
    adminId,
    onUpdate,
    onError
  });
}

// Settings real-time listener
export function subscribeToSettings(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'settings',
    adminId,
    onUpdate,
    onError
  });
}
