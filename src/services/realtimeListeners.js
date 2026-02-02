// Inventory real-time listener
import { db } from '../config/firebase';
import { subscribeToCollection } from './subscribeToCollection';
import { where } from 'firebase/firestore'

export function subscribeToInventory(adminId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'inventory',
    adminId,
    onUpdate,
    onError
  });
}

// Inventory listener scoped to a single branch (required for strict branch isolation rules)
export function subscribeToInventoryByBranch(adminId, branchId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'inventory',
    adminId,
    onUpdate,
    onError,
    queryConstraints: branchId ? [where('branchId', '==', branchId)] : [],
  })
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

export function subscribeToTransactionsByBranch(adminId, branchId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'transactions',
    adminId,
    onUpdate,
    onError,
    queryConstraints: branchId ? [where('branchId', '==', branchId)] : [],
  })
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

export function subscribeToExpensesByBranch(adminId, branchId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'expenses',
    adminId,
    onUpdate,
    onError,
    queryConstraints: branchId ? [where('branchId', '==', branchId)] : [],
  })
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

export function subscribeToUsersByBranch(adminId, branchId, onUpdate, onError) {
  return subscribeToCollection({
    db,
    collectionPath: 'users',
    adminId,
    onUpdate,
    onError,
    queryConstraints: branchId ? [where('branchId', '==', branchId)] : [],
  })
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
