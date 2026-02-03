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
  subscribeToSettings,
  subscribeToInventoryByBranch,
  subscribeToTransactionsByBranch,
  subscribeToExpensesByBranch,
  subscribeToUsersByBranch
} from "../services/realtimeListeners"
import { toast } from "sonner"
import { isExpired, isExpiringSoon } from "../utils/dateHelpers"
import { getTodayAtMidnight, getTodayISO, formatTimeAgo, getTimestampMs } from "../utils/dateUtils"
import { checkIfMigrationNeeded, migrateDataToBranchIsolation } from "../utils/dataMigration"
import { getAllBranches } from "../services/branchService"
import { readSharedData } from "../utils/storage"

export default function AdminDashboard({ currentUser, onPageChange }) {
  const isAdminView = currentUser?.role === 'admin'
  const isManagerView = currentUser?.role === 'manager'

  // Resolved branch name for manager view (shows "Nakuru Branch" instead of branch ID)
  const [branchDisplayName, setBranchDisplayName] = useState('')

  const [selectedBranch, setSelectedBranch] = useState(() => {
    // Admin: persisted branch filter; Manager: locked to their branch
      if (typeof window === 'undefined') return isManagerView ? (currentUser?.branchId || '') : ''
    try {
      return isManagerView ? (currentUser?.branchId || '') : (localStorage.getItem('adminSelectedBranch') || '')
    } catch {
      return isManagerView ? (currentUser?.branchId || '') : ''
    }
  })
  const [selectedCashier, setSelectedCashier] = useState('')
  const [dateRange, setDateRange] = useState(() => (isManagerView ? 'week' : 'today')) // 'today' | 'week' | 'month'
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
    } catch {
      return {}
    }
  })

  // Check for data migration on mount
  useEffect(() => {
    const checkMigration = async () => {
      if (isAdminView) {
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
  }, [currentUser, isAdminView])

  // Manager branch is locked (keep in sync with profile updates)
  useEffect(() => {
    if (!isManagerView) return
    const b = currentUser?.branchId || ''
    setSelectedBranch(b)
    setSelectedCashier('')
  }, [isManagerView, currentUser?.branchId])

  // Resolve manager's branch ID to human-readable name for "Locked" display
  useEffect(() => {
    if (!isManagerView) {
      setBranchDisplayName('')
      return
    }
    const branchId = selectedBranch || currentUser?.branchId || ''
    if (!branchId) {
      setBranchDisplayName('')
      return
    }
    let cancelled = false
    getAllBranches()
      .then((branches) => {
        if (cancelled) return
        const match = (branches || []).find((b) => b.id === branchId)
        setBranchDisplayName(match?.name || branchId)
      })
      .catch(() => {
        if (!cancelled) setBranchDisplayName(branchId)
      })
    return () => { cancelled = true }
  }, [isManagerView, selectedBranch, currentUser?.branchId])

  // Subscribe to all data sources + initial load from storage (ensures data shows even before first snapshot)
  useEffect(() => {
    if (!currentUser) return

    const adminId = getAdminIdForStorage(currentUser)
    if (!adminId) return

    const branchId = isManagerView ? (currentUser?.branchId || '') : null

    // Seed state immediately from storage so dashboard shows data while subscription connects
    readSharedData(adminId).then((data) => {
      if (!data) return
      setInventoryData(prev => (prev.length ? prev : (data.inventory || [])))
      setTransactionsData(prev => (prev.length ? prev : (data.transactions || [])))
      setExpensesData(prev => (prev.length ? prev : (data.expenses || [])))
    }).catch(() => {})

    const unsubscribers = isManagerView
      ? [
          subscribeToInventoryByBranch(adminId, branchId, setInventoryData),
          subscribeToTransactionsByBranch(adminId, branchId, setTransactionsData),
          subscribeToExpensesByBranch(adminId, branchId, setExpensesData),
          subscribeToUsersByBranch(adminId, branchId, setUsersData),
          subscribeToSettings(adminId, (data) => setSettingsData(data[0] || null)),
        ]
      : [
          subscribeToInventory(adminId, setInventoryData),
          subscribeToTransactions(adminId, setTransactionsData),
          subscribeToExpenses(adminId, setExpensesData),
          subscribeToUsers(adminId, setUsersData),
          subscribeToSettings(adminId, (data) => setSettingsData(data[0] || null)),
        ]

    return () => {
      unsubscribers.forEach(unsub => unsub && unsub())
    }
  }, [currentUser, isManagerView])

  // Normalize branch ID for comparison (handles case/whitespace mismatches)
  const normalizeBranchId = (id) => (id != null ? String(id).trim().toLowerCase() : '')

  // Filter cashiers for selected branch
  const cashiers = useMemo(() => {
    if (!selectedBranch || !usersData.length) return []
    const selNorm = normalizeBranchId(selectedBranch)
    return usersData.filter(user =>
      user.role === 'cashier' &&
      normalizeBranchId(user.branchId) === selNorm &&
      user.isActive !== false
    )
  }, [selectedBranch, usersData])

  // Calculate dashboard metrics
  const dashboardData = useMemo(() => {
    const now = new Date()
    const startDate = new Date()
    if (dateRange === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (dateRange === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else if (dateRange === 'month') {
      startDate.setMonth(now.getMonth() - 1)
    } else {
      startDate.setHours(0, 0, 0, 0)
    }

    // Filter transactions by date and selected filters (use getTimestampMs for Firestore Timestamp or ISO)
    const startMs = startDate.getTime()
    let rangeTransactions = (transactionsData || []).filter(t => {
      const transMs = getTimestampMs(t.timestamp)
      return !Number.isNaN(transMs) && transMs >= startMs
    })

    // Apply branch filter (normalized comparison; when "All branches" selected, include all including those without branchId)
    if (selectedBranch) {
      const selNorm = normalizeBranchId(selectedBranch)
      rangeTransactions = rangeTransactions.filter(t => {
        const tBranch = normalizeBranchId(t.branchId)
        return tBranch && tBranch === selNorm
      })
    }

    // Apply cashier filter (match userId or cashierId)
    if (selectedCashier) {
      rangeTransactions = rangeTransactions.filter(t =>
        t.userId === selectedCashier || t.cashierId === selectedCashier
      )
    }

    // Completed sales: cash/mpesa with paymentStatus completed or undefined; exclude credit pending
    const isCompletedSale = (t) => {
      const status = t.paymentStatus
      if (status === 'pending' && t.paymentMethod === 'credit') return false
      return status === 'completed' || !status
    }
    const getAmount = (t) => (t.total != null ? t.total : t.amount) ?? 0

    const cashCollected = rangeTransactions
      .filter(t => t.paymentMethod === 'cash' && isCompletedSale(t))
      .reduce((sum, t) => sum + getAmount(t), 0)

    const mpesaCollected = rangeTransactions
      .filter(t => t.paymentMethod === 'mpesa' && isCompletedSale(t))
      .reduce((sum, t) => sum + getAmount(t), 0)
      
    const expectedTotal = cashCollected + mpesaCollected

    // Calculate expenses in range (use getTimestampMs for Firestore Timestamp or ISO)
    let rangeExpenses = (expensesData || []).filter(e => {
      const dateMs = getTimestampMs(e.date)
      return !Number.isNaN(dateMs) && dateMs >= startMs
    })

    // Apply branch filter to expenses (normalized)
    if (selectedBranch) {
      const selNorm = normalizeBranchId(selectedBranch)
      rangeExpenses = rangeExpenses.filter(e => normalizeBranchId(e.branchId) === selNorm)
    }

    const totalExpenses = rangeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    const profit = expectedTotal - totalExpenses

    // Get spending limit from settings
    const spendingLimitPercentage = settingsData?.spendingLimitPercentage || 50
    const isOverSpendingLimit = totalExpenses > (expectedTotal * spendingLimitPercentage / 100)

    // Filter inventory by branch (normalized)
    let filteredInventory = inventoryData
    if (selectedBranch) {
      const selNorm = normalizeBranchId(selectedBranch)
      filteredInventory = inventoryData.filter(item => normalizeBranchId(item.branchId) === selNorm)
    }

    // Calculate inventory alerts
    const lowStockCount = filteredInventory.filter(item => item.quantity <= item.reorderLevel).length
    const expiredCount = filteredInventory.filter(item => item.expiryDate && isExpired(item.expiryDate)).length
    const expiringSoonCount = filteredInventory.filter(item => 
      item.expiryDate && isExpiringSoon(item.expiryDate) && !isExpired(item.expiryDate)
    ).length

    // Format recent transactions
    const recentTransactions = rangeTransactions
      .slice(-5)
      .reverse()
      .map(t => ({
        id: t.id,
        type: t.paymentMethod === 'mpesa' ? 'M-Pesa' : t.paymentMethod === 'credit' ? 'Credit' : 'Cash',
        amount: t.total,
        time: formatTimeAgo(t.timestamp),
        items: t.itemCount,
        cashier: t.cashier || 'System',
        cashierId: t.cashierId
      }))

    return {
      cashCollected,
      mpesaCollected,
      expectedTotal,
      salesCount: rangeTransactions.length,
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
  }, [transactionsData, expensesData, inventoryData, settingsData, selectedBranch, selectedCashier, dateRange])

  const dateRangeLabel =
    dateRange === 'today' ? 'Today'
    : dateRange === 'week' ? 'Last 7 days'
    : 'Last 30 days'

  const dismissNotification = (type) => {
    try {
      const today = getTodayISO()
      const newDismissed = { ...dismissedNotifications, [type]: today }
      setDismissedNotifications(newDismissed)
      localStorage.setItem('dismissedDashboardNotifications', JSON.stringify(newDismissed))
    } catch (error) {
      // Silent error handling
    }
  }

  const isNotificationDismissed = (type) => {
    const today = getTodayISO()
    return dismissedNotifications[type] === today
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={isManagerView ? "Branch Dashboard" : "Admin Dashboard"}
        subtitle={
          isManagerView
            ? `Branch overview • ${dateRangeLabel}`
            : "Overview of daily operations and wines & spirits earnings"
        }
      />

      {/* Branch, Cashier & Date Filters - Admin Only */}
      {isAdminView && (
        <div className="px-3 sm:px-6 py-4 bg-muted/30 border-b border-border">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
            <div className="flex-1 min-w-0">
              <BranchSelector
                currentUser={currentUser}
                selectedBranch={selectedBranch}
                onBranchChange={(branchId) => {
                  setSelectedBranch(branchId)
                  try {
                    localStorage.setItem('adminSelectedBranch', branchId || '')
                  } catch {}
                  setSelectedCashier('') // Reset cashier when branch changes
                }}
              />
            </div>
            {selectedBranch && cashiers.length > 0 && (
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Filter by Cashier
                </label>
                <select
                  value={selectedCashier}
                  onChange={(e) => setSelectedCashier(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground font-medium transition-all"
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
            <div className="flex items-end gap-2 flex-wrap shrink-0">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Date Range</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'week', label: '7 Days' },
                    { id: 'month', label: '30 Days' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setDateRange(opt.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${
                        dateRange === opt.id
                          ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                          : 'bg-background/80 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {(selectedBranch || selectedCashier) && (
                <button
                  onClick={() => {
                    setSelectedBranch('')
                    setSelectedCashier('')
                  }}
                  className="px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg border-2 border-primary/30 transition-colors self-end"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manager: branch locked + cashier filter + date range */}
      {isManagerView && (
        <div className="px-3 sm:px-6 py-4 bg-muted/30 border-b border-border">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Branch</div>
              <div className="mt-1 inline-flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg">
                <span className="text-xs text-muted-foreground">Locked:</span>
                <span className="text-sm font-bold text-foreground">{branchDisplayName || selectedBranch || currentUser?.branchId || '—'}</span>
              </div>
            </div>

            {cashiers.length > 0 && (
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

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Last 7 days' },
                { id: 'month', label: 'Last 30 days' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDateRange(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all ${
                    dateRange === opt.id
                      ? 'bg-primary/10 text-primary border-primary/30 shadow-md'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
            subtitle={`${dateRangeLabel} sales`}
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
            subtitle={`${dateRangeLabel} cash sales`}
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
            subtitle={`${dateRangeLabel} M-Pesa sales`}
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
            subtitle={dashboardData.isOverSpendingLimit ? `Over ${dashboardData.spendingLimitPercentage}% limit!` : dateRangeLabel}
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
                <p className="text-sm font-bold text-primary mb-1">{dateRangeLabel} Sales</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {dashboardData.salesCount}
                </p>
                <p className="text-xs text-muted-foreground">transactions completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Full Width (Admin: Monitoring Only) */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <span>⚡</span>
            <span>Quick Actions</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Admin can only access monitoring pages, not operational pages */}
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
            <button
              onClick={() => onPageChange && onPageChange('transactions-history')}
              className="bg-linear-to-br from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 border-2 border-blue-500/30 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg"
            >
              <div className="text-3xl mb-2">📋</div>
              <div className="text-sm font-bold text-blue-700 dark:text-blue-400">Transactions</div>
              <div className="text-xs text-muted-foreground mt-1">View history</div>
            </button>
            {isAdminView ? (
              <button
                onClick={() => onPageChange && onPageChange('branch-management')}
                className="bg-linear-to-br from-purple-500/10 to-purple-600/5 hover:from-purple-500/20 hover:to-purple-600/10 border-2 border-purple-500/30 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg"
              >
                <div className="text-3xl mb-2">🏢</div>
                <div className="text-sm font-bold text-purple-700 dark:text-purple-400">Branches</div>
                <div className="text-xs text-muted-foreground mt-1">Manage locations</div>
              </button>
            ) : (
              <button
                onClick={() => onPageChange && onPageChange('inventory')}
                className="bg-linear-to-br from-purple-500/10 to-purple-600/5 hover:from-purple-500/20 hover:to-purple-600/10 border-2 border-purple-500/30 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg"
              >
                <div className="text-3xl mb-2">📦</div>
                <div className="text-sm font-bold text-purple-700 dark:text-purple-400">Inventory</div>
                <div className="text-xs text-muted-foreground mt-1">View stock</div>
              </button>
            )}
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
          dateRange={dateRange}
          currentUser={currentUser}
          selectedBranch={selectedBranch}
        />
      )}
    </div>
  )
}
