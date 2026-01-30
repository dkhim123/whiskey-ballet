/**
 * Unit Tests for Branch Access Control
 * Tests multi-branch isolation logic
 */

import {
  filterInventoryByBranch,
  filterTransactionsByBranch,
  filterExpensesByBranch,
  canAccessBranch,
  ensureBranchId,
  getAccessibleBranches
} from '../branchAccessControl'

describe('Branch Access Control', () => {
  
  // Test Data
  const sampleInventory = [
    { id: 1, name: 'Product A', branchId: 'kasarani', quantity: 10 },
    { id: 2, name: 'Product B', branchId: 'kasarani', quantity: 5 },
    { id: 3, name: 'Product C', branchId: 'uon', quantity: 8 },
    { id: 4, name: 'Product D', branchId: 'uon', quantity: 12 },
    { id: 5, name: 'Product E', branchId: 'non-road', quantity: 15 },
    { id: 6, name: 'Product F (No Branch)', quantity: 20 } // Missing branchId
  ]

  const sampleTransactions = [
    { id: 'txn1', userId: 'john-id', branchId: 'kasarani', total: 1000 },
    { id: 'txn2', userId: 'john-id', branchId: 'kasarani', total: 1500 },
    { id: 'txn3', userId: 'rachel-id', branchId: 'kasarani', total: 2000 },
    { id: 'txn4', userId: 'mary-id', branchId: 'uon', total: 2500 },
    { id: 'txn5', userId: 'peter-id', branchId: 'non-road', total: 3000 },
    { id: 'txn6', userId: 'john-id', total: 500 } // Missing branchId
  ]

  const adminUser = { id: 'admin-1', name: 'Admin', role: 'admin' }
  const johnCashier = { id: 'john-id', name: 'John', role: 'cashier', branchId: 'kasarani' }
  const rachelCashier = { id: 'rachel-id', name: 'Rachel', role: 'cashier', branchId: 'kasarani' }
  const maryCashier = { id: 'mary-id', name: 'Mary', role: 'cashier', branchId: 'uon' }
  const peterCashier = { id: 'peter-id', name: 'Peter', role: 'cashier', branchId: 'non-road' }
  const unassignedCashier = { id: 'unassigned-id', name: 'Unassigned', role: 'cashier' }

  describe('filterInventoryByBranch', () => {
    
    test('Admin sees all inventory when no branch selected', () => {
      const result = filterInventoryByBranch(sampleInventory, adminUser, null)
      expect(result).toHaveLength(6)
      expect(result).toEqual(sampleInventory)
    })

    test('Admin sees only selected branch inventory', () => {
      const result = filterInventoryByBranch(sampleInventory, adminUser, 'kasarani')
      expect(result).toHaveLength(2)
      expect(result.every(item => item.branchId === 'kasarani')).toBe(true)
      expect(result.map(i => i.name)).toEqual(['Product A', 'Product B'])
    })

    test('Cashier sees only their branch inventory', () => {
      const result = filterInventoryByBranch(sampleInventory, johnCashier)
      expect(result).toHaveLength(2)
      expect(result.every(item => item.branchId === 'kasarani')).toBe(true)
    })

    test('Cashiers in same branch see same inventory', () => {
      const johnResult = filterInventoryByBranch(sampleInventory, johnCashier)
      const rachelResult = filterInventoryByBranch(sampleInventory, rachelCashier)
      expect(johnResult).toEqual(rachelResult)
    })

    test('Cashiers in different branches see different inventory', () => {
      const johnResult = filterInventoryByBranch(sampleInventory, johnCashier)
      const maryResult = filterInventoryByBranch(sampleInventory, maryCashier)
      
      expect(johnResult).toHaveLength(2)
      expect(maryResult).toHaveLength(2)
      expect(johnResult[0].branchId).toBe('kasarani')
      expect(maryResult[0].branchId).toBe('uon')
      expect(johnResult).not.toEqual(maryResult)
    })

    test('Products without branchId are excluded from cashier view', () => {
      const result = filterInventoryByBranch(sampleInventory, johnCashier)
      expect(result.every(item => item.branchId !== undefined)).toBe(true)
      expect(result.find(item => item.name === 'Product F (No Branch)')).toBeUndefined()
    })

    test('Cashier without branchId sees empty inventory', () => {
      const result = filterInventoryByBranch(sampleInventory, unassignedCashier)
      expect(result).toHaveLength(0)
    })

    test('Returns empty array for null inventory', () => {
      const result = filterInventoryByBranch(null, johnCashier)
      expect(result).toEqual([])
    })

    test('Returns empty array for undefined user', () => {
      const result = filterInventoryByBranch(sampleInventory, null)
      expect(result).toEqual([])
    })
  })

  describe('filterTransactionsByBranch', () => {
    
    test('Admin sees all transactions when no branch selected', () => {
      const result = filterTransactionsByBranch(sampleTransactions, adminUser, null, null)
      expect(result).toHaveLength(6)
    })

    test('Admin can filter by branch', () => {
      const result = filterTransactionsByBranch(sampleTransactions, adminUser, 'kasarani', null)
      expect(result).toHaveLength(3)
      expect(result.every(txn => txn.branchId === 'kasarani')).toBe(true)
    })

    test('Admin can filter by branch and cashier', () => {
      const result = filterTransactionsByBranch(sampleTransactions, adminUser, 'kasarani', 'john-id')
      expect(result).toHaveLength(2)
      expect(result.every(txn => txn.branchId === 'kasarani' && txn.userId === 'john-id')).toBe(true)
    })

    test('Cashier sees only their branch transactions', () => {
      const result = filterTransactionsByBranch(sampleTransactions, johnCashier)
      expect(result).toHaveLength(3) // John sees ALL kasarani transactions (john, rachel)
      expect(result.every(txn => txn.branchId === 'kasarani')).toBe(true)
    })

    test('Cashier cannot see other branch transactions', () => {
      const johnResult = filterTransactionsByBranch(sampleTransactions, johnCashier)
      const maryResult = filterTransactionsByBranch(sampleTransactions, maryCashier)
      
      expect(johnResult.every(txn => txn.branchId !== 'uon')).toBe(true)
      expect(maryResult.every(txn => txn.branchId !== 'kasarani')).toBe(true)
    })

    test('Transactions without branchId excluded from cashier view', () => {
      const result = filterTransactionsByBranch(sampleTransactions, johnCashier)
      expect(result.find(txn => txn.id === 'txn6')).toBeUndefined()
    })

    test('Cashier with no branchId cannot access transactions', () => {
      const cashierWithoutBranch = { role: 'cashier', branchId: null };
      const result = filterTransactionsByBranch(sampleTransactions, cashierWithoutBranch);
      expect(result).toHaveLength(0);
    })

    test('Transactions with missing branchId are excluded from branch-specific views', () => {
      const result = filterTransactionsByBranch(sampleTransactions, johnCashier);
      expect(result.find(txn => !txn.branchId)).toBeUndefined();
    })
  })

  describe('canAccessBranch', () => {
    
    test('Admin can access any branch', () => {
      expect(canAccessBranch(adminUser, 'kasarani')).toBe(true)
      expect(canAccessBranch(adminUser, 'uon')).toBe(true)
      expect(canAccessBranch(adminUser, 'non-road')).toBe(true)
      expect(canAccessBranch(adminUser, 'random-branch')).toBe(true)
    })

    test('Cashier can only access their assigned branch', () => {
      expect(canAccessBranch(johnCashier, 'kasarani')).toBe(true)
      expect(canAccessBranch(johnCashier, 'uon')).toBe(false)
      expect(canAccessBranch(johnCashier, 'non-road')).toBe(false)
    })

    test('Returns false for null user', () => {
      expect(canAccessBranch(null, 'kasarani')).toBe(false)
    })
  })

  describe('ensureBranchId', () => {
    
    test('Preserves existing valid branchId', () => {
      const item = { id: 1, name: 'Product', branchId: 'kasarani' }
      const result = ensureBranchId(item, johnCashier)
      expect(result.branchId).toBe('kasarani')
    })

    test('Adds branchId if missing', () => {
      const item = { id: 1, name: 'Product' }
      const result = ensureBranchId(item, johnCashier)
      expect(result.branchId).toBe('kasarani')
      expect(result.createdBy).toBe('john-id')
    })

    test('Prevents cashier from saving to wrong branch', () => {
      const item = { id: 1, name: 'Product', branchId: 'uon' } // Wrong branch!
      const result = ensureBranchId(item, johnCashier)
      expect(result.branchId).toBe('kasarani') // Forced to cashier's branch
    })

    test('Admin can save to any branch', () => {
      const item = { id: 1, name: 'Product', branchId: 'uon' }
      const result = ensureBranchId(item, adminUser)
      expect(result.branchId).toBe('uon') // Preserved
    })
  })

  describe('getAccessibleBranches', () => {
    const allBranches = [
      { id: 'kasarani', name: 'Kasarani Branch' },
      { id: 'uon', name: 'Uon Road Branch' },
      { id: 'non-road', name: 'Non Road Branch' }
    ]

    test('Admin can access all branches', () => {
      const result = getAccessibleBranches(adminUser, allBranches);
      expect(result).toHaveLength(3);
      expect(result).toEqual(allBranches);
    });

    test('Cashier can only access their assigned branch', () => {
      const result = getAccessibleBranches(johnCashier, allBranches);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(johnCashier.branchId);
    });

    test('Cashier with no branchId cannot access any branch', () => {
      const cashierWithoutBranch = { role: 'cashier', branchId: null };
      const result = getAccessibleBranches(cashierWithoutBranch, allBranches);
      expect(result).toHaveLength(0);
    });

    test('Returns empty array for null user', () => {
      const result = getAccessibleBranches(null, allBranches)
      expect(result).toEqual([])
    })
  })

  describe('Edge Cases and Security', () => {
    
    test('Empty inventory array handled correctly', () => {
      const result = filterInventoryByBranch([], johnCashier)
      expect(result).toEqual([])
    })

    test('Cashier cannot bypass branch filter with undefined branchId', () => {
      const inventory = [{ id: 1, name: 'Product', branchId: undefined }]
      const result = filterInventoryByBranch(inventory, johnCashier)
      expect(result).toHaveLength(0) // Excluded!
    })

    test('Different branch IDs are case-sensitive', () => {
      const inventory = [
        { id: 1, branchId: 'Kasarani' },
        { id: 2, branchId: 'kasarani' }
      ]
      const cashier = { role: 'cashier', branchId: 'kasarani' }
      const result = filterInventoryByBranch(inventory, cashier)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(2)
    })
  })
})

describe('Integration Tests - Multi-Branch Scenarios', () => {
  
  test('Scenario: Two cashiers in same branch share inventory', () => {
    const inventory = [
      { id: 1, name: 'Whisky A', branchId: 'kasarani', quantity: 10 },
      { id: 2, name: 'Whisky B', branchId: 'kasarani', quantity: 5 }
    ]
    
    const john = { role: 'cashier', branchId: 'kasarani' }
    const rachel = { role: 'cashier', branchId: 'kasarani' }
    
    const johnView = filterInventoryByBranch(inventory, john)
    const rachelView = filterInventoryByBranch(inventory, rachel)
    
    expect(johnView).toEqual(rachelView)
    expect(johnView).toHaveLength(2)
  })

  test('Scenario: Admin monitors multiple branches', () => {
    const transactions = [
      { id: '1', branchId: 'kasarani', total: 1000 },
      { id: '2', branchId: 'uon', total: 2000 },
      { id: '3', branchId: 'non-road', total: 3000 }
    ]
    
    const admin = { role: 'admin' }
    
    // View all
    const allTxns = filterTransactionsByBranch(transactions, admin, null)
    expect(allTxns).toHaveLength(3)
    
    // View kasarani
    const kasaraniTxns = filterTransactionsByBranch(transactions, admin, 'kasarani')
    expect(kasaraniTxns).toHaveLength(1)
    expect(kasaraniTxns[0].total).toBe(1000)
    
    // View uon
    const uonTxns = filterTransactionsByBranch(transactions, admin, 'uon')
    expect(uonTxns).toHaveLength(1)
    expect(uonTxns[0].total).toBe(2000)
  })

  test('Scenario: Complete branch isolation', () => {
    const inventory = [
      { id: 1, branchId: 'kasarani' },
      { id: 2, branchId: 'uon' }
    ]
    
    const kasaraniCashier = { role: 'cashier', branchId: 'kasarani' }
    const uonCashier = { role: 'cashier', branchId: 'uon' }
    
    const kasaraniView = filterInventoryByBranch(inventory, kasaraniCashier)
    const uonView = filterInventoryByBranch(inventory, uonCashier)
    
    // Complete isolation
    expect(kasaraniView).toHaveLength(1)
    expect(uonView).toHaveLength(1)
    expect(kasaraniView[0].id).toBe(1)
    expect(uonView[0].id).toBe(2)
    
    // No overlap
    expect(kasaraniView[0]).not.toEqual(uonView[0])
  })
})
