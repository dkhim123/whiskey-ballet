"use client"

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import TopBar from "../components/TopBar"
import AdminTrashBin from "../components/AdminTrashBin"
import TransactionDetailsModal from "../components/TransactionDetailsModal"
import { readSharedData, writeSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"
import { exportTransactionsToCSV } from "../utils/csvExport"
import { getFirstName } from "../utils/nameHelpers"

// Transaction ID display length for UI
const TRANSACTION_ID_DISPLAY_LENGTH = 8

export default function TransactionsHistoryPage({ currentUser }) {
  const [transactions, setTransactions] = useState([])
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [showTrashBin, setShowTrashBin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCancelled, setShowCancelled] = useState(true) // Show cancelled by default
  
  // Filter states
  const [dateFilter, setDateFilter] = useState('all') // 'today', 'week', 'month', 'all', 'custom'
  const [paymentFilter, setPaymentFilter] = useState('all') // 'all', 'cash', 'mpesa'
  const [monthFilter, setMonthFilter] = useState('') // YYYY-MM format
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadTransactions()
  }, [currentUser])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const userId = currentUser?.id
      if (!userId) {
        console.error('No user ID available')
        return
      }
      
      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      const allTransactions = sharedData.transactions || []
      
      // Sort by timestamp descending (newest first)
      // Shows all transactions regardless of payment status (completed, pending, or cancelled)
      const sortedTransactions = allTransactions
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      
      setTransactions(sortedTransactions)
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelTransaction = async (transaction) => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        toast.error('Authentication Error', {
          description: 'You must be logged in to cancel transactions'
        })
        return
      }

      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      
      // Find and update the transaction
      const updatedTransactions = sharedData.transactions.map(t => 
        t.id === transaction.id 
          ? { 
              ...t, 
              paymentStatus: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancelledBy: currentUser.name || 'Admin'
            }
          : t
      )

      // Reverse inventory changes - restore quantities that were sold
      const currentInventory = sharedData.inventory || []
      const updatedInventory = currentInventory.map(item => {
        const transactionItem = transaction.items?.find(ti => ti.id === item.id)
        if (transactionItem && typeof transactionItem.quantity === 'number') {
          // Validate that we're adding back a positive quantity
          const quantityToRestore = Math.max(0, transactionItem.quantity)
          return {
            ...item,
            quantity: item.quantity + quantityToRestore
          }
        }
        return item
      })

      // Save updated data
      await writeSharedData({
        ...sharedData,
        transactions: updatedTransactions,
        inventory: updatedInventory
      }, adminId)

      // Reload transactions to reflect changes
      await loadTransactions()

      toast.success('Transaction Cancelled', {
        description: `Transaction ${transaction.id?.slice(-TRANSACTION_ID_DISPLAY_LENGTH) || 'Unknown'} has been cancelled and inventory restored.`,
        duration: 5000
      })
    } catch (error) {
      console.error('Error cancelling transaction:', error)
      toast.error('Cancellation Failed', {
        description: 'Failed to cancel transaction. Please try again.',
        duration: 5000
      })
      throw error
    }
  }

  // Apply filters
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions]
    
    // Filter cancelled transactions if needed
    if (!showCancelled) {
      filtered = filtered.filter(t => t.paymentStatus !== 'cancelled')
    }
    
    // Payment method filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(t => t.paymentMethod === paymentFilter)
    }
    
    // Date filters
    const now = new Date()
    
    if (dateFilter === 'today') {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      filtered = filtered.filter(t => new Date(t.timestamp) >= startOfDay)
    } else if (dateFilter === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(now.getDate() - 7)
      filtered = filtered.filter(t => new Date(t.timestamp) >= weekAgo)
    } else if (dateFilter === 'month') {
      const monthAgo = new Date()
      monthAgo.setMonth(now.getMonth() - 1)
      filtered = filtered.filter(t => new Date(t.timestamp) >= monthAgo)
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(customEndDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter(t => {
        const date = new Date(t.timestamp)
        return date >= start && date <= end
      })
    }
    
    // Monthly filter (separate from date filter)
    if (monthFilter) {
      const parts = monthFilter.split('-')
      if (parts.length === 2) {
        const year = parseInt(parts[0])
        const month = parseInt(parts[1])
        if (!isNaN(year) && !isNaN(month)) {
          filtered = filtered.filter(t => {
            const date = new Date(t.timestamp)
            return date.getFullYear() === year && 
                   date.getMonth() === month - 1
          })
        }
      }
    }
    
    return filtered
  }, [transactions, dateFilter, paymentFilter, monthFilter, customStartDate, customEndDate, showCancelled])

  // Paginate transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredTransactions, currentPage])

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)

  // Calculate summary statistics (excluding cancelled transactions)
  const summary = useMemo(() => {
    const activeTransactions = filteredTransactions.filter(t => t.paymentStatus !== 'cancelled')
    const total = activeTransactions.reduce((sum, t) => sum + (t.total || 0), 0)
    const cashTotal = activeTransactions
      .filter(t => t.paymentMethod === 'cash')
      .reduce((sum, t) => sum + (t.total || 0), 0)
    const mpesaTotal = activeTransactions
      .filter(t => t.paymentMethod === 'mpesa')
      .reduce((sum, t) => sum + (t.total || 0), 0)
    
    return {
      total,
      cashTotal,
      mpesaTotal,
      count: activeTransactions.length,
      average: activeTransactions.length > 0 ? total / activeTransactions.length : 0
    }
  }, [filteredTransactions])

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid Time'
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateTime = (timestamp) => {
    return `${formatDate(timestamp)} ${formatTime(timestamp)}`
  }

  // Get available months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set()
    transactions.forEach(t => {
      const date = new Date(t.timestamp)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      months.add(monthKey)
    })
    return Array.from(months).sort().reverse()
  }, [transactions])

  const resetFilters = () => {
    setDateFilter('all')
    setPaymentFilter('all')
    setMonthFilter('')
    setCustomStartDate('')
    setCustomEndDate('')
    setCurrentPage(1)
  }

  const handleExportTransactions = () => {
    const dateLabel = dateFilter === 'today' ? 'Today' :
                      dateFilter === 'week' ? 'Last-7-Days' :
                      dateFilter === 'month' ? 'Last-30-Days' :
                      dateFilter === 'custom' ? 'Custom-Range' :
                      monthFilter ? monthFilter : 'All'
    const paymentLabel = paymentFilter === 'all' ? 'All-Methods' :
                         paymentFilter === 'cash' ? 'Cash-Only' :
                         'MPesa-Only'
    
    const filename = `transactions-${dateLabel}-${paymentLabel}-${new Date().toISOString().split('T')[0]}.csv`
    exportTransactionsToCSV(filteredTransactions, filename)
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="📊 Transaction History" />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Filter Section */}
        <div className="bg-card border-2 border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">Filters</h3>
            <div className="flex gap-2">
              <button
                onClick={handleExportTransactions}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                title="Export Filtered Transactions to CSV"
              >
                <span>📥</span>
                <span>Export CSV</span>
              </button>
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Date Range
              </label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground font-medium"
              >
                <option value="all">📅 All Time</option>
                <option value="today">📅 Today</option>
                <option value="week">📊 Last 7 Days</option>
                <option value="month">📈 Last 30 Days</option>
                <option value="custom">🗓️ Custom Range</option>
              </select>
            </div>

            {/* Monthly Filter */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Filter by Month
              </label>
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground font-medium"
              >
                <option value="">All Months</option>
                {availableMonths.map(month => {
                  const [year, monthNum] = month.split('-')
                  const date = new Date(year, monthNum - 1)
                  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return (
                    <option key={month} value={month}>
                      {monthName}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Payment Method
              </label>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground font-medium"
              >
                <option value="all">💳 All Methods</option>
                <option value="cash">💵 Cash Only</option>
                <option value="mpesa">📱 M-Pesa Only</option>
              </select>
            </div>

            {/* Admin Trash Bin Button */}
            {currentUser?.role === 'admin' && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Admin Actions
                </label>
                <button
                  onClick={() => setShowTrashBin(true)}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>🗑️</span>
                  <span>Trash Bin</span>
                </button>
              </div>
            )}
          </div>

          {/* Show Cancelled Transactions Toggle */}
          <div className="mt-4 pt-4 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => {
                  setShowCancelled(e.target.checked)
                  setCurrentPage(1)
                }}
                className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">
                Show cancelled transactions
              </span>
            </label>
          </div>

          {/* Custom Date Range Inputs */}
          {dateFilter === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground font-medium"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border-2 border-border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Total Transactions</div>
            <div className="text-2xl font-bold text-foreground">{summary.count}</div>
          </div>
          <div className="bg-card border-2 border-border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Total Sales</div>
            <div className="text-2xl font-bold text-primary">KES {summary.total.toLocaleString()}</div>
          </div>
          <div className="bg-card border-2 border-border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Cash Sales</div>
            <div className="text-2xl font-bold text-green-600">KES {summary.cashTotal.toLocaleString()}</div>
          </div>
          <div className="bg-card border-2 border-border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">M-Pesa Sales</div>
            <div className="text-2xl font-bold text-blue-600">KES {summary.mpesaTotal.toLocaleString()}</div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-card border-2 border-border rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-bold text-foreground">
              Transactions ({filteredTransactions.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No transactions found
              </h3>
              <p className="text-muted-foreground">
                Try adjusting your filters to see more results
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Transaction ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Cashier
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        className={`hover:bg-muted/40 cursor-pointer transition-colors ${
                          transaction.paymentStatus === 'cancelled' ? 'opacity-60 bg-destructive/5' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">
                            {formatDate(transaction.timestamp)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatTime(transaction.timestamp)}
                          </div>
                          {transaction.paymentStatus === 'cancelled' && (
                            <div className="text-xs text-destructive font-semibold mt-1">
                              CANCELLED
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-foreground">
                            {transaction.id && typeof transaction.id === 'string' 
                              ? transaction.id.slice(-8) 
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">
                            {transaction.items?.length || 0} items
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            transaction.paymentMethod === 'mpesa'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {transaction.paymentMethod === 'mpesa' ? '📱 M-Pesa' : '💵 Cash'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-primary">
                            KES {(transaction.total || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-muted-foreground">
                            {getFirstName(transaction.cashier || transaction.cashierName || 'N/A')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-2 px-4">
                      <span className="text-sm text-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          currentUser={currentUser}
          onClose={() => setSelectedTransaction(null)}
          onCancel={handleCancelTransaction}
        />
      )}

      {/* Admin Trash Bin Modal */}
      {showTrashBin && (
        <AdminTrashBin
          adminId={getAdminIdForStorage(currentUser)}
          onClose={() => setShowTrashBin(false)}
          onRestore={() => loadTransactions()}
        />
      )}
    </div>
  )
}
