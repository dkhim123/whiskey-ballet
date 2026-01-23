/**
 * Admin Trash Bin Component
 * Displays soft-deleted items and allows admin-led recovery
 * Groups items by deletion session (5-minute windows)
 */

import { useState, useEffect, useTransition } from 'react'
import { 
  getDeletedItems, 
  restoreItem, 
  restoreAllDataByTimeRange 
} from '../utils/storage'

// Store names constants
const STORES = {
  INVENTORY: 'inventory',
  TRANSACTIONS: 'transactions',
  SUPPLIERS: 'suppliers',
  PURCHASE_ORDERS: 'purchaseOrders',
  GOODS_RECEIVED_NOTES: 'goodsReceivedNotes',
  SUPPLIER_PAYMENTS: 'supplierPayments',
  STOCK_ADJUSTMENTS: 'stockAdjustments',
  CUSTOMERS: 'customers',
  EXPENSES: 'expenses'
}

/**
 * Group deleted items by deletion session (5-minute windows)
 * @param {Array} items - Array of deleted items with deletedAt timestamps
 * @returns {Array} Array of deletion sessions
 */
const groupByDeletionSession = (items) => {
  if (!items || items.length === 0) return []
  
  // Sort by deletedAt descending (most recent first)
  const sortedItems = [...items].sort((a, b) => 
    new Date(b.deletedAt) - new Date(a.deletedAt)
  )
  
  const sessions = []
  const SESSION_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
  
  sortedItems.forEach(item => {
    const itemTime = new Date(item.deletedAt).getTime()
    
    // Find an existing session within 5 minutes
    const existingSession = sessions.find(session => {
      const sessionTime = new Date(session.startTime).getTime()
      return Math.abs(itemTime - sessionTime) <= SESSION_WINDOW_MS
    })
    
    if (existingSession) {
      existingSession.items.push(item)
      // Update time range
      const sessionStart = new Date(existingSession.startTime).getTime()
      const sessionEnd = new Date(existingSession.endTime).getTime()
      existingSession.startTime = new Date(Math.min(sessionStart, itemTime)).toISOString()
      existingSession.endTime = new Date(Math.max(sessionEnd, itemTime)).toISOString()
    } else {
      // Create new session
      sessions.push({
        startTime: item.deletedAt,
        endTime: item.deletedAt,
        items: [item],
        deletedBy: item.deletedBy
      })
    }
  })
  
  return sessions
}

const AdminTrashBin = ({ adminId, onClose, onRestore }) => {
  const [deletedData, setDeletedData] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedStore, setSelectedStore] = useState('inventory')
  const [isPending, startTransition] = useTransition()
  const [restoring, setRestoring] = useState(false)
  
  // Stores to check for deleted items
  const RESTORABLE_STORES = [
    { key: STORES.INVENTORY, label: 'Inventory' },
    { key: STORES.TRANSACTIONS, label: 'Transactions' },
    { key: STORES.SUPPLIERS, label: 'Suppliers' },
    { key: STORES.PURCHASE_ORDERS, label: 'Purchase Orders' },
    { key: STORES.GOODS_RECEIVED_NOTES, label: 'Goods Received Notes' },
    { key: STORES.SUPPLIER_PAYMENTS, label: 'Supplier Payments' },
    { key: STORES.STOCK_ADJUSTMENTS, label: 'Stock Adjustments' },
    { key: STORES.CUSTOMERS, label: 'Customers' },
    { key: STORES.EXPENSES, label: 'Expenses' }
  ]
  
  // Load deleted items
  useEffect(() => {
    const loadDeletedItems = async () => {
      setLoading(true)
      const data = {}
      
      for (const store of RESTORABLE_STORES) {
        try {
          const items = await getDeletedItems(store.key, adminId)
          data[store.key] = items
        } catch (error) {
          console.error(`Error loading deleted items from ${store.key}:`, error)
          data[store.key] = []
        }
      }
      
      setDeletedData(data)
      setLoading(false)
    }
    
    loadDeletedItems()
  }, [adminId])
  
  // Restore a single item
  const handleRestoreItem = async (storeName, itemId) => {
    setRestoring(true)
    
    startTransition(() => {
      // Wrap async operation in a synchronous callback
      (async () => {
        try {
          const success = await restoreItem(storeName, adminId, itemId)
          
          if (success) {
            // Remove from deleted list
            setDeletedData(prev => ({
              ...prev,
              [storeName]: prev[storeName].filter(item => item.id !== itemId)
            }))
            
            if (onRestore) {
              onRestore()
            }
            
            alert('Item restored successfully!')
          } else {
            alert('Failed to restore item')
          }
        } catch (error) {
          console.error('Error restoring item:', error)
          alert('Error restoring item: ' + error.message)
        } finally {
          setRestoring(false)
        }
      })()
    })
  }
  
  // Restore a deletion session (all items deleted within 5-minute window)
  const handleRestoreSession = async (session, storeName) => {
    setRestoring(true)
    
    startTransition(() => {
      // Wrap async operation in a synchronous callback
      (async () => {
        try {
          const result = await restoreAllDataByTimeRange(
            adminId,
            session.startTime,
            session.endTime
          )
          
          // Refresh deleted items
          const updatedItems = await getDeletedItems(storeName, adminId)
          setDeletedData(prev => ({
            ...prev,
            [storeName]: updatedItems
          }))
          
          if (onRestore) {
            onRestore()
          }
          
          alert(`Restored ${result.totalRestored} items from deletion session!`)
        } catch (error) {
          console.error('Error restoring session:', error)
          alert('Error restoring session: ' + error.message)
        } finally {
          setRestoring(false)
        }
      })()
    })
  }
  
  // Format date for display
  const formatDate = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Get item display name
  const getItemDisplayName = (item, storeName) => {
    switch (storeName) {
      case STORES.INVENTORY:
        return item.name || item.id
      case STORES.TRANSACTIONS:
        return `Transaction #${item.id.slice(-8)}`
      case STORES.SUPPLIERS:
        return item.name || item.id
      case STORES.CUSTOMERS:
        return item.name || item.id
      case STORES.EXPENSES:
        return item.description || item.id
      default:
        return item.name || item.id
    }
  }
  
  const currentStoreItems = deletedData[selectedStore] || []
  const sessions = groupByDeletionSession(currentStoreItems)
  const totalDeleted = Object.values(deletedData).reduce((sum, items) => sum + items.length, 0)
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">🗑️ Admin Trash Bin</h2>
            <p className="text-sm text-red-100">
              {totalDeleted} deleted items across all stores
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 text-2xl font-bold"
            disabled={restoring}
          >
            ×
          </button>
        </div>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading deleted items...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Store Tabs */}
            <div className="border-b overflow-x-auto">
              <div className="flex px-6 space-x-2">
                {RESTORABLE_STORES.map(store => {
                  const count = deletedData[store.key]?.length || 0
                  return (
                    <button
                      key={store.key}
                      onClick={() => setSelectedStore(store.key)}
                      className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                        selectedStore === store.key
                          ? 'border-red-600 text-red-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                      disabled={restoring}
                    >
                      {store.label}
                      {count > 0 && (
                        <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {currentStoreItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎉</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No deleted items
                  </h3>
                  <p className="text-gray-500">
                    This store has no items in the trash
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sessions.map((session, sessionIdx) => (
                    <div 
                      key={sessionIdx}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Session Header */}
                      <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            Deletion Session {sessions.length - sessionIdx}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {formatDate(session.startTime)}
                            {session.startTime !== session.endTime && 
                              ` - ${formatDate(session.endTime)}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {session.items.length} items
                            {session.deletedBy && ` • Deleted by user: ${session.deletedBy}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestoreSession(session, selectedStore)}
                          disabled={restoring || isPending}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {restoring || isPending ? 'Restoring...' : 'Restore Session'}
                        </button>
                      </div>
                      
                      {/* Session Items */}
                      <div className="divide-y">
                        {session.items.map((item, itemIdx) => (
                          <div 
                            key={itemIdx}
                            className="px-4 py-3 hover:bg-gray-50 flex justify-between items-center"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {getItemDisplayName(item, selectedStore)}
                              </p>
                              <p className="text-sm text-gray-500">
                                ID: {item.id}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRestoreItem(selectedStore, item.id)}
                              disabled={restoring || isPending}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {restoring || isPending ? '...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t px-6 py-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  ℹ️ Items are grouped by deletion time (5-minute windows)
                </p>
                <button
                  onClick={onClose}
                  disabled={restoring}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminTrashBin
