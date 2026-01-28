/**
 * Migration Script: Fix Customer Metadata (branchId and createdBy)
 * 
 * Run this in browser console while logged in as admin.
 * Simply paste and press Enter - it will run automatically.
 */

(async function fixCustomerMetadata() {
  console.log('🔧 Starting customer metadata fix...')
  
  try {
    // Get current user from localStorage
    const sessionData = localStorage.getItem('pos-user-session')
    if (!sessionData) {
      console.error('❌ No active session! Please login first.')
      return
    }
    
    const session = JSON.parse(sessionData)
    const currentUser = session.user
    
    if (!currentUser) {
      console.error('❌ No user found in session!')
      return
    }
    
    console.log(`👤 Running as: ${currentUser.name || currentUser.email} (${currentUser.role})`)
    
    // Open IndexedDB
    const dbRequest = indexedDB.open('SmartBizDB', 1)
    
    dbRequest.onerror = () => {
      console.error('❌ Failed to open database')
    }
    
    dbRequest.onsuccess = async (event) => {
      const db = event.target.result
      const adminId = currentUser.adminId || currentUser.id
      const storeName = `data_${adminId}`
      
      console.log(`📦 Accessing store: ${storeName}`)
      
      // Check if store exists
      if (!db.objectStoreNames.contains(storeName)) {
        console.error(`❌ Store ${storeName} not found!`)
        db.close()
        return
      }
      
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const getRequest = store.get('sharedData')
      
      getRequest.onsuccess = () => {
        const sharedData = getRequest.result || {}
        const customers = sharedData.customers || []
        
        console.log(`📊 Found ${customers.length} customers`)
        
        if (customers.length === 0) {
          console.log('✅ No customers to fix')
          db.close()
          return
        }
        
        let fixedCount = 0
        let alreadyOkCount = 0
        
        // Get branches
        const branchesData = localStorage.getItem('pos-branches')
        const branches = branchesData ? JSON.parse(branchesData) : []
        const defaultBranch = branches[0]?.id || currentUser.branchId || 'main'
        
        console.log(`🏢 Default branch for fixes: ${defaultBranch}`)
        
        const updatedCustomers = customers.map((customer) => {
          const needsFix = !customer.branchId || !customer.createdBy
          
          if (needsFix) {
            fixedCount++
            return {
              ...customer,
              branchId: customer.branchId || defaultBranch,
              createdBy: customer.createdBy || {
                id: currentUser.id,
                name: currentUser.name || currentUser.email || 'System',
                role: currentUser.role || 'admin'
              }
            }
          } else {
            alreadyOkCount++
            return customer
          }
        })
        
        // Save updated data
        sharedData.customers = updatedCustomers
        const putRequest = store.put(sharedData, 'sharedData')
        
        putRequest.onsuccess = () => {
          console.log('✅ Customer metadata fixed successfully!')
          console.log(`   ✔ Fixed: ${fixedCount} customers`)
          console.log(`   ✔ Already OK: ${alreadyOkCount} customers`)
          console.log('\n📋 Updated customers:')
          updatedCustomers.forEach((c, i) => {
            console.log(`   ${i + 1}. ${c.name} - Branch: ${c.branchId}, Created by: ${c.createdBy?.name}`)
          })
          console.log('\n🔄 Refreshing page in 2 seconds...')
          setTimeout(() => window.location.reload(), 2000)
          db.close()
        }
        
        putRequest.onerror = () => {
          console.error('❌ Failed to save updated customers')
          db.close()
        }
      }
      
      getRequest.onerror = () => {
        console.error('❌ Failed to read shared data')
        db.close()
      }
    }
    
    dbRequest.onupgradeneeded = () => {
      console.log('⚠️ Database upgrade needed - this is unexpected')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
})()

console.log('✅ Migration script loaded. Executing now...')
