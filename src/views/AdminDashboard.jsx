"use client"

import { useState, useEffect, useMemo } from "react"
import { X } from "lucide-react"
import TopBar from "../components/TopBar"
import DashboardCard from "../components/DashboardCard"
import RecentTransactions from "../components/RecentTransactions"
import AccountabilityModal from "../components/AccountabilityModal"
import ActivityFeed from "../components/ActivityFeed"
import BranchSelector from "../components/BranchSelector"
import { getAdminIdForStorage } from "../utils/auth"
import { 
  subscribeToInventory, 
  subscribeToTransactions, 
  subscribeToExpenses, 
  subscribeToUsers, 
  subscribeToSettings 
} from "../services/realtimeListeners"
import { toast } from "sonner"
import { isExpired, isExpiringSoon } from "../utils/dateHelpers"
import { checkIfMigrationNeeded, migrateDataToBranchIsolation } from "../utils/dataMigration"

export default function AdminDashboard({ currentUser, onPageChange }) {
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedCashier, setSelectedCashier] = useState('')
  const [inventoryData, setInventoryData] = useState([])
  const [transactionsData, setTransactionsData] = useState([])
  const [expensesData, setExpensesData] = useState([])
  const [usersData, setUsersData] = useState([])
  const [settingsData, setSettingsData] = useState(null)
  const [showAccountabilityModal, setShowAccountabilityModal] = useState(false)
  const [accountabilityType, setAccountabilityType] = useState(null)
  const [dismissedNotifications, setDismissedNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissedDashboardNotifications')
      return saved ? JSON.parse(saved) : {}
    } catch (error) {
      console.error('Error loading dismissed notifications:', error)
      return {}
    }
  })

  // Check for data migration on mount
  useEffect(() => {
    const checkMigration = async () => {
      if (currentUser?.role === 'admin') {
        const needsMigration = await checkIfMigrationNeeded(currentUser)
        if (needsMigration) {
          const confirmed = window.confirm(
            'System Update Required\n\n' +
            'Your system needs a one-time update to enable proper branch isolation.\n\n' +
            'This will assign all existing data to branches to ensure cashiers only see their branch data.\n\n' +
            'Click OK to proceed with the update (recommended).'
          )
          if (confirmed) {
            const defaultBranch = prompt(
              'Enter the default Branch ID for existing data:\n' +
              '(This will be assigned to items that don\'t have a branch yet)',
              'uon'
            )
            if (defaultBranch) {
              const result = await migrateDataToBranchIsolation(currentUser, defaultBranch.trim())
              if (result.success) {
                toast.success(`Migration complete! ${result.migratedCount} items updated.`)
                window.location.reload()
              } else {
                toast.error('Migration failed: ' + result.error)
              }
            }
          }
        }
      }
    }
    checkMigration()
  }, [currentUser])

  // Subscribe to all data sources
  useEffect(() => {
    if (!currentUser) return

    const adminId = getAdminIdForStorage(currentUser)
    
    const unsubscribers = [
      subscribeToInventory(adminId, setInventoryData),
      subscribeToTransactions(adminId, setTransactionsData),
      subscribeToExpenses(adminId, setExpensesData),
      subscribeToUsers(adminId, setUsersData),
      subscribeToSettings(adminId, (data) => setSettingsData(data[0] || null))
    ]

    return () => {
      unsubscribers.forEach(unsub => unsub && unsub())
    }
  }, [currentUser])

  // Filter cashiers for selected branch
  const cashiers = useMemo(() => {
    if (!selectedBranch || !usersData.length) return []
    return usersData.filter(user => 
      user.role === 'cashier' && 
      user.branchId === selectedBranch &&
      user.isActive
    )
  }, [selectedBranch, usersData])

  // Calculate dashboard metrics
  const dashboardData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Filter transactions by date and selected filters
    let todayTransactions = transactionsData.filter(t => {
      const transDate = new Date(t.timestamp)
      transDate.setHours(0, 0, 0, 0)
      return transDate.getTime() === today.getTime()
    })

    // Apply branch filter
    if (selectedBranch) {
      todayTransactions = todayTransactions.filter(t => t.branchId === selectedBranch)
    }

    // Apply cashier filter
    if (selectedCashier) {
      todayTransactions = todayTransactions.filter(t => t.userId === selectedCashier)
    }

    // Calculate financial metrics
    const cashCollected = todayTransactions
      .filter(t => t.paymentMethod === 'cash' && (t.paymentStatus === 'completed' || !t.paymentStatus))
      .reduce((sum, t) => sum + ((t.total || t.amount) ?? 0), 0)
      
    const mpesaCollected = todayTransactions
      .filter(t => t.paymentMethod === 'mpesa' && (t.paymentStatus === 'completed' || !t.paymentStatus))
      .reduce((sum, t) => sum + ((t.total || t.amount) ?? 0), 0)
      
    const expectedTotal = cashCollected + mpesaCollected

    // Calculate today's expenses
    let todayExpenses = expensesData.filter(e => {
      const expenseDate = new Date(e.date)
      expenseDate.setHours(0, 0, 0, 0)
      return expenseDate.getTime() === today.getTime()
    })

    // Apply branch filter to expenses
    if (selectedBranch) {
      todayExpenses = todayExpenses.filter(e => e.branchId === selectedBranch)
    }

    const totalExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    const profit = expectedTotal - totalExpenses

    // Get spending limit from settings
    const spendingLimitPercentage = settingsData?.spendingLimitPercentage || 50
    const isOverSpendingLimit = totalExpenses > (expectedTotal * spendingLimitPercentage / 100)

    // Filter inventory by branch
    let filteredInventory = inventoryData
    if (selectedBranch) {
      filteredInventory = inventoryData.filter(item => item.branchId === selectedBranch)
    }

    // Calculate inventory alerts
    const lowStockCount = filteredInventory.filter(item => item.quantity <= item.reorderLevel).length
    const expiredCount = filteredInventory.filter(item => item.expiryDate && isExpired(item.expiryDate)).length
    const expiringSoonCount = filteredInventory.filter(item => 
      item.expiryDate && isExpiringSoon(item.expiryDate) && !isExpired(item.expiryDate)
    ).length

    // Format recent transactions
    const recentTransactions = todayTransactions
      .slice(-5)
      .reverse()
      .map(t => {
        const timeDiff = Date.now() - new Date(t.timestamp).getTime()
        const minutes = Math.floor(timeDiff / 60000)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)
        
        let timeAgo
        if (days > 0) timeAgo = `${days}d ago`
        else if (hours > 0) timeAgo = `${hours}h ago`
        else if (minutes > 0) timeAgo = `${minutes} min ago`
        else timeAgo = 'Just now'
        
        return {
          id: t.id,
          type: t.paymentMethod === 'mpesa' ? 'M-Pesa' : t.paymentMethod === 'credit' ? 'Credit' : 'Cash',
          amount: t.total,
          time: timeAgo,
          items: t.itemCount,
          cashier: t.cashier || 'System',
          cashierId: t.cashierId
        }
      })

    return {
      cashCollected,
      mpesaCollected,
      expectedTotal,
      salesCount: todayTransactions.length,
      lowStockAlerts: lowStockCount,
      expiredItems: expiredCount,
      expiringSoonItems: expiringSoonCount,
      recentTransactions,
      fullTransactions: transactionsData,
      totalExpenses,
      profit,
      spendingLimitPercentage,
      isOverSpendingLimit
    }
  }, [transactionsData, expensesData, inventoryData, settingsData, selectedBranch, selectedCashier])

  const dismissNotification = (type) => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const newDismissed = { ...dismissedNotifications, [type]: today }
      setDismissedNotifications(newDismissed)
      localStorage.setItem('dismissedDashboardNotifications', JSON.stringify(newDismissed))
    } catch (error) {
      console.error('Error saving dismissed notification:', error)
    }
  }

  const isNotificationDismissed = (type) => {
    const today = new Date().toISOString().split('T')[0]
    return dismissedNotifications[type] === today
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Admin Dashboard" subtitle="Overview of daily operations and wines & spirits earnings" />

      {/* Branch and Cashier Filters - Admin Only */}
      {currentUser?.role === 'admin' && (
        <div className="px-3 sm:px-6 py-4 bg-muted/30 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <BranchSelector
                currentUser={currentUser}
                selectedBranch={selectedBranch}
                onBranchChange={(branchId) => {
                  setSelectedBranch(branchId)
                  setSelectedCashier('') // Reset cashier when branch changes
                }}
              />
            </div>
            {selectedBranch && cashiers.length > 0 && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Filter by Cashier
                </label>
                <select
                  value={selectedCashier}
                  onChange={(e) => setSelectedCashier(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  <option value="">All Cashiers ({cashiers.length})</option>
                  {cashiers.map(cashier => (
                    <option key={cashier.id} value={cashier.id}>
                      {cashier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(selectedBranch || selectedCashier) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                <span className="text-xs font-medium text-primary">
                  {selectedBranch && selectedCashier ? 'Branch & Cashier Filter Active' :
                   selectedBranch ? 'Branch Filter Active' :
                   'Cashier Filter Active'}
                </span>
                <button
                  onClick={() => {
                    setSelectedBranch('')
                    setSelectedCashier('')
                  }}
                  className="text-xs text-primary hover:text-primary/80 underline"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-3 sm:p-6 flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <DashboardCard
            title="Total Earnings"
            value={`KES ${(dashboardData.expectedTotal || 0).toLocaleString()}`}
            icon="💰"
            variant="success"
            subtitle="All sales today"
            onClick={() => {
              setAccountabilityType('sales')
              setShowAccountabilityModal(true)
            }}
          />
          <DashboardCard
            title="Cash Collected"
            value={`KES ${(dashboardData.cashCollected || 0).toLocaleString()}`}
            icon="💵"
            variant="primary"
            subtitle="Today's cash sales"
            onClick={() => {
              setAccountabilityType('cash')
              setShowAccountabilityModal(true)
            }}
          />
          <DashboardCard
            title="M-Pesa Collected"
            value={`KES ${(dashboardData.mpesaCollected || 0).toLocaleString()}`}
            icon="📱"
            variant="secondary"
            subtitle="Today's M-Pesa sales"
            onClick={() => {
              setAccountabilityType('mpesa')
              setShowAccountabilityModal(true)
            }}
          />
          <DashboardCard
            title="Total Expenses"
            value={`KES ${(dashboardData.totalExpenses || 0).toLocaleString()}`}
            icon="💸"
            variant={dashboardData.isOverSpendingLimit ? "destructive" : "warning"}
            subtitle={dashboardData.isOverSpendingLimit ? `Over ${dashboardData.spendingLimitPercentage}% limit!` : "Today"}
            onClick={() => {
              setAccountabilityType('expenses')
              setShowAccountabilityModal(true)
            }}
          />
          <DashboardCard
            title="Net Profit"
            value={`KES ${(dashboardData.profit || 0).toLocaleString()}`}
            icon={(dashboardData.profit || 0) >= 0 ? "📈" : "📉"}
            variant={(dashboardData.profit || 0) >= 0 ? "success" : "destructive"}
            subtitle="Earnings - Expenses"
            onClick={() => {
              setAccountabilityType('profit')
              setShowAccountabilityModal(true)
            }}
          />
        </div>

        {/* Alerts Section - Full Width */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {dashboardData.isOverSpendingLimit && !isNotificationDismissed('spending') && (
            <div className="bg-destructive/10 border-2 border-destructive/50 rounded-lg p-4 animate-pulse hover:scale-[1.02] transition-transform relative">
              <button
                onClick={() => dismissNotification('spending')}
                className="absolute top-2 right-2 p-1 hover:bg-destructive/20 rounded-full transition-colors"
                title="Dismiss for today"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-destructive mb-1">Spending Limit Alert</p>
                  <p className="text-xs text-muted-foreground">
                    Expenses exceed {dashboardData.spendingLimitPercentage}% of earnings
                  </p>
                  <p className="text-xs text-destructive font-semibold mt-2">
                    KES {(dashboardData.totalExpenses || 0).toLocaleString()} / {(((dashboardData.expectedTotal || 0) * (dashboardData.spendingLimitPercentage || 0)) / 100).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          {dashboardData.lowStockAlerts > 0 && !isNotificationDismissed('lowstock') && (
            <div className="bg-warning/10 border-2 border-warning/50 rounded-lg p-4 hover:scale-[1.02] transition-transform cursor-pointer relative" onClick={() => onPageChange && onPageChange('inventory')}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  dismissNotification('lowstock')
                }}
                className="absolute top-2 right-2 p-1 hover:bg-warning/20 rounded-full transition-colors"
                title="Dismiss for today"
              >
                <X className="w-4 h-4 text-warning" />
              </button>
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-warning mb-1">Low Stock Alert</p>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.lowStockAlerts} products below reorder level
                  </p>
                  <p className="text-xs text-warning font-semibold mt-2">Click to view inventory →</p>
                </div>
              </div>
            </div>
          )}
          {dashboardData.expiredItems > 0 && !isNotificationDismissed('expired') && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-4 hover:scale-[1.02] transition-transform cursor-pointer relative" onClick={() => onPageChange && onPageChange('inventory')}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  dismissNotification('expired')
                }}
                className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded-full transition-colors"
                title="Dismiss for today"
              >
                <X className="w-4 h-4 text-red-700 dark:text-red-300" />
              </button>
              <div className="flex items-start gap-3">
                <div className="text-2xl">⛔</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-1">Expired Products</p>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.expiredItems} products have expired
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 font-semibold mt-2">Click to view inventory →</p>
                </div>
              </div>
            </div>
          )}
          {dashboardData.expiringSoonItems > 0 && !isNotificationDismissed('expiringsoon') && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 rounded-lg p-4 hover:scale-[1.02] transition-transform cursor-pointer relative" onClick={() => onPageChange && onPageChange('inventory')}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  dismissNotification('expiringsoon')
                }}
                className="absolute top-2 right-2 p-1 hover:bg-orange-500/20 rounded-full transition-colors"
                title="Dismiss for today"
              >
                <X className="w-4 h-4 text-orange-700 dark:text-orange-300" />
              </button>
              <div className="flex items-start gap-3">
                <div className="text-2xl">⏰</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-700 dark:text-orange-300 mb-1">Expiring Soon</p>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData.expiringSoonItems} products expiring within 7 days
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold mt-2">Click to view inventory →</p>
                </div>
              </div>
            </div>
          )}
          {dashboardData.lowStockAlerts === 0 && (
            <div className="bg-success/10 border-2 border-success/50 rounded-lg p-4 hover:scale-[1.02] transition-transform">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-success mb-1">Inventory Status</p>
                  <p className="text-xs text-muted-foreground">
                    All products are well stocked
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-primary/10 border-2 border-primary/50 rounded-lg p-4 hover:scale-[1.02] transition-transform">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📊</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-primary mb-1">Sales Today</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {dashboardData.salesCount}
                </p>
                <p className="text-xs text-muted-foreground">transactions completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Full Width */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <span>⚡</span>
            <span>Quick Actions</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => onPageChange && onPageChange('pos')}
              className="bg-linear-to-br from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 border-2 border-blue-500/30 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg"
            >
              <div className="text-3xl mb-2">🛒</div>
              <div className="text-sm font-bold text-blue-700 dark:text-blue-400">New Sale</div>
              <div className="text-xs text-muted-foreground mt-1">Start transaction</div>
            </button>
            <button
              onClick={() => onPageChange && onPageChange('inventory')}
              className="bg-linear-to-br from-purple-500/10 to-purple-600/5 hover:from-purple-500/20 hover:to-purple-600/10 border-2 border-purple-500/30 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg"
            >
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm font-bold text-purple-700 dark:text-purple-400">Inventory</div>
              <div className="text-xs text-muted-foreground mt-1">Manage stock</div>
            </button>
            <button
              onClick={() => onPageChange && onPageChange('reports')}
              className="bg-linear-to-br from-green-500/10 to-green-600/5 hover:from-green-500/20 hover:to-green-600/10 border-2 border-green-500/30 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg"
            >
              <div className="text-3xl mb-2">📊</div>
              <div className="text-sm font-bold text-green-700 dark:text-green-400">Reports</div>
              <div className="text-xs text-muted-foreground mt-1">View analytics</div>
            </button>
            <button
              onClick={() => onPageChange && onPageChange('expenses')}
              className="bg-linear-to-br from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10 border-2 border-orange-500/30 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg"
            >
              <div className="text-3xl mb-2">💸</div>
              <div className="text-sm font-bold text-orange-700 dark:text-orange-400">Expenses</div>
              <div className="text-xs text-muted-foreground mt-1">Track spending</div>
            </button>
          </div>
        </div>

        {/* Two Column Layout: Recent Transactions + Activity Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RecentTransactions 
            transactions={dashboardData.recentTransactions} 
            fullTransactions={dashboardData.fullTransactions}
          />
          <ActivityFeed currentUser={currentUser} limit={8} branchId={selectedBranch} />
        </div>
      </div>

      {/* Accountability Modal */}
      {showAccountabilityModal && (
        <AccountabilityModal
          type={accountabilityType}
          onClose={() => setShowAccountabilityModal(false)}
          dateRange="today"
          currentUser={currentUser}
          selectedBranch={selectedBranch}
        />
      )}
    </div>
  )
}
