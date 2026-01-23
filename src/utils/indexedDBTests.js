/**
 * IndexedDB Storage Performance Tests
 * Tests storage with 5000-10000 products and transactions
 */

import {
  STORES,
  initDB,
  putBatch,
  getAllItems,
  getItem,
  deleteItem,
  clearAdminData,
  getStorageStats,
  isIndexedDBAvailable
} from '../utils/indexedDBStorage'

import {
  migrateAdminData,
  migrateAllAdmins,
  verifyMigration,
  isMigrationCompleted
} from '../utils/migrationUtility'

// Test utilities
const generateTestProducts = (count, adminId) => {
  const products = []
  const categories = ['Whisky', 'Brandy', 'Wine', 'Beer', 'Vodka', 'Rum', 'Liqueur', 'Gin']
  
  for (let i = 1; i <= count; i++) {
    products.push({
      id: i,
      name: `Test Product ${i}`,
      sku: `SKU-${String(i).padStart(6, '0')}`,
      category: categories[i % categories.length],
      quantity: Math.floor(Math.random() * 100) + 10,
      reorderLevel: 10,
      costPrice: Math.floor(Math.random() * 5000) + 500,
      sellingPrice: Math.floor(Math.random() * 8000) + 1000,
      price: Math.floor(Math.random() * 8000) + 1000,
      barcode: `BC${String(i).padStart(10, '0')}`,
      alcoholPercentage: Math.floor(Math.random() * 40) + 10,
      bottleSize: ['750ml', '1L', '500ml'][i % 3],
      inventoryUnits: 'bottle',
      vatRate: 0.16
    })
  }
  
  return products
}

const generateTestTransactions = (count, adminId) => {
  const transactions = []
  const paymentMethods = ['cash', 'mpesa', 'credit']
  const paymentStatuses = ['completed', 'pending']
  
  for (let i = 1; i <= count; i++) {
    const paymentMethod = paymentMethods[i % paymentMethods.length]
    transactions.push({
      id: `TXN-${String(i).padStart(8, '0')}`,
      date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      total: Math.floor(Math.random() * 50000) + 1000,
      paymentMethod,
      paymentStatus: paymentMethod === 'credit' ? 'pending' : 'completed',
      items: [
        {
          id: Math.floor(Math.random() * 100) + 1,
          name: `Product ${Math.floor(Math.random() * 100) + 1}`,
          quantity: Math.floor(Math.random() * 5) + 1,
          price: Math.floor(Math.random() * 5000) + 500
        }
      ],
      cashier: `Cashier ${(i % 3) + 1}`,
      customerId: i % 10 === 0 ? `CUST-${i}` : null
    })
  }
  
  return transactions
}

// Test suite
const runTests = async () => {
  console.log('🧪 Starting IndexedDB Storage Tests...')
  console.log('=' .repeat(60))
  
  // Check if IndexedDB is available
  if (!isIndexedDBAvailable()) {
    console.error('❌ IndexedDB is not available in this environment')
    return
  }
  
  console.log('✅ IndexedDB is available')
  
  const testAdminId = 'test-admin-1'
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  }
  
  // Test 1: Initialize database
  try {
    console.log('\n📝 Test 1: Initialize database')
    const db = await initDB()
    if (db) {
      console.log('✅ Database initialized successfully')
      results.passed++
      results.tests.push({ name: 'Initialize database', status: 'PASSED' })
    } else {
      throw new Error('Database initialization returned null')
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    results.failed++
    results.tests.push({ name: 'Initialize database', status: 'FAILED', error: error.message })
  }
  
  // Test 2: Store 5000 products
  try {
    console.log('\n📝 Test 2: Store 5000 products')
    const products = generateTestProducts(5000, testAdminId)
    const startTime = Date.now()
    const result = await putBatch(STORES.INVENTORY, testAdminId, products)
    const endTime = Date.now()
    
    if (result.success === 5000 && result.errors === 0) {
      console.log(`✅ Stored 5000 products successfully in ${endTime - startTime}ms`)
      console.log(`   Average: ${((endTime - startTime) / 5000).toFixed(2)}ms per product`)
      results.passed++
      results.tests.push({ name: 'Store 5000 products', status: 'PASSED', time: endTime - startTime })
    } else {
      throw new Error(`Expected 5000 success, got ${result.success} (${result.errors} errors)`)
    }
  } catch (error) {
    console.error('❌ Storing 5000 products failed:', error)
    results.failed++
    results.tests.push({ name: 'Store 5000 products', status: 'FAILED', error: error.message })
  }
  
  // Test 3: Retrieve all 5000 products
  try {
    console.log('\n📝 Test 3: Retrieve all 5000 products')
    const startTime = Date.now()
    const products = await getAllItems(STORES.INVENTORY, testAdminId)
    const endTime = Date.now()
    
    if (products.length === 5000) {
      console.log(`✅ Retrieved 5000 products successfully in ${endTime - startTime}ms`)
      results.passed++
      results.tests.push({ name: 'Retrieve 5000 products', status: 'PASSED', time: endTime - startTime })
    } else {
      throw new Error(`Expected 5000 products, got ${products.length}`)
    }
  } catch (error) {
    console.error('❌ Retrieving 5000 products failed:', error)
    results.failed++
    results.tests.push({ name: 'Retrieve 5000 products', status: 'FAILED', error: error.message })
  }
  
  // Test 4: Store 10000 transactions
  try {
    console.log('\n📝 Test 4: Store 10000 transactions')
    const transactions = generateTestTransactions(10000, testAdminId)
    const startTime = Date.now()
    const result = await putBatch(STORES.TRANSACTIONS, testAdminId, transactions)
    const endTime = Date.now()
    
    if (result.success === 10000 && result.errors === 0) {
      console.log(`✅ Stored 10000 transactions successfully in ${endTime - startTime}ms`)
      console.log(`   Average: ${((endTime - startTime) / 10000).toFixed(2)}ms per transaction`)
      results.passed++
      results.tests.push({ name: 'Store 10000 transactions', status: 'PASSED', time: endTime - startTime })
    } else {
      throw new Error(`Expected 10000 success, got ${result.success} (${result.errors} errors)`)
    }
  } catch (error) {
    console.error('❌ Storing 10000 transactions failed:', error)
    results.failed++
    results.tests.push({ name: 'Store 10000 transactions', status: 'FAILED', error: error.message })
  }
  
  // Test 5: Retrieve all 10000 transactions
  try {
    console.log('\n📝 Test 5: Retrieve all 10000 transactions')
    const startTime = Date.now()
    const transactions = await getAllItems(STORES.TRANSACTIONS, testAdminId)
    const endTime = Date.now()
    
    if (transactions.length === 10000) {
      console.log(`✅ Retrieved 10000 transactions successfully in ${endTime - startTime}ms`)
      results.passed++
      results.tests.push({ name: 'Retrieve 10000 transactions', status: 'PASSED', time: endTime - startTime })
    } else {
      throw new Error(`Expected 10000 transactions, got ${transactions.length}`)
    }
  } catch (error) {
    console.error('❌ Retrieving 10000 transactions failed:', error)
    results.failed++
    results.tests.push({ name: 'Retrieve 10000 transactions', status: 'FAILED', error: error.message })
  }
  
  // Test 6: Get single item by ID
  try {
    console.log('\n📝 Test 6: Get single item by ID')
    const startTime = Date.now()
    const product = await getItem(STORES.INVENTORY, testAdminId, 2500)
    const endTime = Date.now()
    
    if (product && product.id === 2500) {
      console.log(`✅ Retrieved single product successfully in ${endTime - startTime}ms`)
      results.passed++
      results.tests.push({ name: 'Get single item', status: 'PASSED', time: endTime - startTime })
    } else {
      throw new Error('Failed to retrieve product by ID')
    }
  } catch (error) {
    console.error('❌ Getting single item failed:', error)
    results.failed++
    results.tests.push({ name: 'Get single item', status: 'FAILED', error: error.message })
  }
  
  // Test 7: Admin isolation - verify different admin can't see data
  try {
    console.log('\n📝 Test 7: Admin isolation')
    const otherAdminId = 'test-admin-2'
    const products = await getAllItems(STORES.INVENTORY, otherAdminId)
    
    if (products.length === 0) {
      console.log('✅ Admin isolation verified - other admin sees no data')
      results.passed++
      results.tests.push({ name: 'Admin isolation', status: 'PASSED' })
    } else {
      throw new Error(`Expected 0 products for different admin, got ${products.length}`)
    }
  } catch (error) {
    console.error('❌ Admin isolation test failed:', error)
    results.failed++
    results.tests.push({ name: 'Admin isolation', status: 'FAILED', error: error.message })
  }
  
  // Test 8: Get storage statistics
  try {
    console.log('\n📝 Test 8: Get storage statistics')
    const stats = await getStorageStats(testAdminId)
    
    if (stats && stats.inventory === 5000 && stats.transactions === 10000) {
      console.log('✅ Storage statistics correct')
      console.log('   Stats:', stats)
      results.passed++
      results.tests.push({ name: 'Storage statistics', status: 'PASSED' })
    } else {
      throw new Error(`Unexpected stats: ${JSON.stringify(stats)}`)
    }
  } catch (error) {
    console.error('❌ Storage statistics test failed:', error)
    results.failed++
    results.tests.push({ name: 'Storage statistics', status: 'FAILED', error: error.message })
  }
  
  // Test 9: Clear admin data
  try {
    console.log('\n📝 Test 9: Clear admin data')
    const deletedCount = await clearAdminData(STORES.INVENTORY, testAdminId)
    const remainingProducts = await getAllItems(STORES.INVENTORY, testAdminId)
    
    if (deletedCount === 5000 && remainingProducts.length === 0) {
      console.log('✅ Admin data cleared successfully')
      results.passed++
      results.tests.push({ name: 'Clear admin data', status: 'PASSED' })
    } else {
      throw new Error(`Expected to delete 5000, deleted ${deletedCount}, ${remainingProducts.length} remaining`)
    }
  } catch (error) {
    console.error('❌ Clear admin data failed:', error)
    results.failed++
    results.tests.push({ name: 'Clear admin data', status: 'FAILED', error: error.message })
  }
  
  // Print summary
  console.log('\n' + '=' .repeat(60))
  console.log('📊 Test Summary')
  console.log('=' .repeat(60))
  console.log(`Total Tests: ${results.passed + results.failed}`)
  console.log(`✅ Passed: ${results.passed}`)
  console.log(`❌ Failed: ${results.failed}`)
  console.log('\nDetailed Results:')
  results.tests.forEach((test, index) => {
    const icon = test.status === 'PASSED' ? '✅' : '❌'
    const timeInfo = test.time ? ` (${test.time}ms)` : ''
    console.log(`${index + 1}. ${icon} ${test.name}${timeInfo}`)
    if (test.error) {
      console.log(`   Error: ${test.error}`)
    }
  })
  
  return results
}

// Export for use in browser console or test runner
if (typeof window !== 'undefined') {
  window.runIndexedDBTests = runTests
}

export { runTests, generateTestProducts, generateTestTransactions }
