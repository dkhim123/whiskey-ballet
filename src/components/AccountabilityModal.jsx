"use client"

import { useState, useEffect } from "react"
import { readSharedData, readData } from "../utils/storage"
import { getAllUsers, getAdminIdForStorage } from "../utils/auth"
import { exportTransactionsToCSV, exportExpensesToCSV } from "../utils/csvExport"

// Constants for unknown user fallback values
const UNKNOWN_USER = {
  name: 'Unknown User',
  email: 'unknown@email.com',
  role: 'unknown'
}

export default function AccountabilityModal({ type, onClose, dateRange = 'today', currentUser }) {
  const [accountabilityData, setAccountabilityData] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalAmount, setTotalAmount] = useState(0)
  const [allTransactions, setAllTransactions] = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [expandedUserId, setExpandedUserId] = useState(null)

  useEffect(() => {
    const loadAccountabilityData = async () => {
      try {
        setLoading(true)
        
        // Get all users to map userId to user details
        const users = await getAllUsers()
        const userMap = users.reduce((map, user) => {
          map[user.id] = user
          return map
        }, {})
        
        // Calculate date range
        const now = new Date()
        let startDate = new Date()
        
        switch (dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0)
            break
          case 'week':
            startDate.setDate(now.getDate() - 7)
            break
          case 'month':
            startDate.setMonth(now.getMonth() - 1)
            break
          case 'all':
            startDate = new Date(0)
            break
          default:
            startDate.setHours(0, 0, 0, 0)
        }
        
         if (type === 'sales' || type === 'cash' || type === 'mpesa') {
          // Use the proper helper function to get admin ID
          const adminId = getAdminIdForStorage(currentUser)
          const sharedData = await readSharedData(adminId)
          const transactions = sharedData.transactions || []
          
          // Filter transactions by date range, payment method, and completion status
          const filteredTransactions = transactions.filter(t => {
            const transDate = new Date(t.timestamp)
            const matchesDate = transDate >= startDate
            const isCompleted = t.paymentStatus === 'completed' || !t.paymentStatus
            
            // Filter by payment method if type is 'cash' or 'mpesa'
            let matchesPaymentMethod = true
            if (type === 'cash') {
              matchesPaymentMethod = t.paymentMethod === 'cash'
            } else if (type === 'mpesa') {
              matchesPaymentMethod = t.paymentMethod === 'mpesa'
            }
            
            // For cashiers, only show their own transactions
            const matchesUser = currentUser?.role === 'admin' || t.userId === currentUser?.id
            
            return matchesDate && isCompleted && matchesPaymentMethod && matchesUser
          })
          
          // Store filtered transactions for export
          setAllTransactions(filteredTransactions)
          
          // Group transactions by userId using reduce
          const { salesByUser, total } = filteredTransactions.reduce((acc, transaction) => {
            const userId = transaction.userId
            const amount = transaction.total || 0
            
            if (!acc.salesByUser[userId]) {
              acc.salesByUser[userId] = {
                userId,
                userName: userMap[userId]?.name || UNKNOWN_USER.name,
                userEmail: userMap[userId]?.email || UNKNOWN_USER.email,
                userRole: userMap[userId]?.role || UNKNOWN_USER.role,
                totalEarnings: 0,
                transactionCount: 0,
                transactions: [] // Store actual transactions for details view
              }
            }
            
            acc.salesByUser[userId].totalEarnings += amount
            acc.salesByUser[userId].transactionCount += 1
            acc.salesByUser[userId].transactions.push(transaction)
            acc.total += amount
            
            return acc
          }, { salesByUser: {}, total: 0 })
          
          setAccountabilityData(Object.values(salesByUser))
          setTotalAmount(total)
        } else if (type === 'expenses') {
          // Load expenses from all users in parallel
          const users = await getAllUsers()
          
          // Fetch all user data in parallel using Promise.all
          const userDataPromises = users.map(user => 
            readData(user.id).then(userData => ({ user, userData }))
          )
          const usersData = await Promise.all(userDataPromises)
          
          // Process expenses data
          const { expensesByUser, total, allFilteredExpenses } = usersData.reduce((acc, { user, userData }) => {
            const expenses = userData.expenses || []
            
            // Filter expenses by date range (exclude income entries like loan repayments)
            const filteredExpenses = expenses.filter(e => {
              const expenseDate = new Date(e.date)
              return expenseDate >= startDate && e.type !== 'income'
            })
            
            // Add to all filtered expenses for export
            acc.allFilteredExpenses.push(...filteredExpenses)
            
            if (filteredExpenses.length > 0) {
              const userTotal = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
              
              acc.expensesByUser[user.id] = {
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                userRole: user.role,
                totalExpenses: userTotal,
                expenseCount: filteredExpenses.length
              }
              
              acc.total += userTotal
            }
            
            return acc
          }, { expensesByUser: {}, total: 0, allFilteredExpenses: [] })
          
          setAllExpenses(allFilteredExpenses)
          
          setAccountabilityData(Object.values(expensesByUser))
          setTotalAmount(total)
        } else if (type === 'profit') {
          // Load both sales and expenses data
          const adminId = currentUser?.role === 'admin' ? currentUser?.id : currentUser?.adminId
          const sharedData = await readSharedData(adminId)
          const transactions = sharedData.transactions || []
          
          // Get all users
          const users = await getAllUsers()
          
          // Calculate profit by user
          const profitByUser = {}
          let totalProfit = 0
          
          // Calculate sales per user
          const filteredTransactions = transactions.filter(t => {
            const transDate = new Date(t.timestamp)
            const matchesDate = transDate >= startDate
            const isCompleted = t.paymentStatus === 'completed' || !t.paymentStatus
            return matchesDate && isCompleted
          })
          
          filteredTransactions.forEach(t => {
            const userId = t.userId
            if (!profitByUser[userId]) {
              profitByUser[userId] = {
                userId,
                userName: userMap[userId]?.name || UNKNOWN_USER.name,
                userEmail: userMap[userId]?.email || UNKNOWN_USER.email,
                userRole: userMap[userId]?.role || UNKNOWN_USER.role,
                totalSales: 0,
                totalExpenses: 0,
                netProfit: 0
              }
            }
            profitByUser[userId].totalSales += (t.total || 0)
          })
          
          // Calculate expenses per user
          const userDataPromises = users.map(user => 
            readData(user.id).then(userData => ({ user, userData }))
          )
          const usersData = await Promise.all(userDataPromises)
          
          usersData.forEach(({ user, userData }) => {
            const expenses = userData.expenses || []
            const filteredExpenses = expenses.filter(e => {
              const expenseDate = new Date(e.date)
              return expenseDate >= startDate && e.type !== 'income'
            })
            
            const userExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
            
            if (!profitByUser[user.id]) {
              profitByUser[user.id] = {
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                userRole: user.role,
                totalSales: 0,
                totalExpenses: 0,
                netProfit: 0
              }
            }
            profitByUser[user.id].totalExpenses = userExpenses
          })
          
          // Calculate net profit
          Object.values(profitByUser).forEach(user => {
            user.netProfit = user.totalSales - user.totalExpenses
            totalProfit += user.netProfit
          })
          
          setAccountabilityData(Object.values(profitByUser))
          setTotalAmount(totalProfit)
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Error loading accountability data:', error)
        setLoading(false)
      }
    }
    
    loadAccountabilityData()
  }, [type, dateRange])

  const handleExportCSV = () => {
    const dateRangeText = dateRange === 'today' ? 'today' :
                         dateRange === 'week' ? 'week' :
                         dateRange === 'month' ? 'month' : 'all'
    
    if (type === 'sales' || type === 'cash' || type === 'mpesa') {
      const filename = `${type}_${dateRangeText}_${new Date().toISOString().split('T')[0]}.csv`
      exportTransactionsToCSV(allTransactions, filename)
      alert(`Exported ${allTransactions.length} transaction(s) to ${filename}`)
    } else if (type === 'expenses') {
      const filename = `expenses_${dateRangeText}_${new Date().toISOString().split('T')[0]}.csv`
      exportExpensesToCSV(allExpenses, filename)
      alert(`Exported ${allExpenses.length} expense(s) to ${filename}`)
    }
  }

  const getTitle = () => {
    if (type === 'sales') {
      return 'Sales Accountability'
    } else if (type === 'cash') {
      return 'Cash Collections'
    } else if (type === 'mpesa') {
      return 'M-Pesa Collections'
    } else if (type === 'expenses') {
      return 'Expenses Accountability'
    } else if (type === 'profit') {
      return 'Profit Analysis'
    }
    return 'Accountability'
  }

  const getDescription = () => {
    const periodText = dateRange === 'today' ? 'today' : 
                       dateRange === 'week' ? 'this week' : 
                       dateRange === 'month' ? 'this month' : 
                       'all time'
    
    if (type === 'sales') {
      return `Sales breakdown by user for ${periodText}`
    } else if (type === 'cash') {
      return `Cash sales breakdown by user for ${periodText}`
    } else if (type === 'mpesa') {
      return `M-Pesa sales breakdown by user for ${periodText}`
    } else if (type === 'expenses') {
      return `Expenses breakdown by user for ${periodText}`
    } else if (type === 'profit') {
      return `Profit analysis for ${periodText}`
    }
    return `Breakdown by user for ${periodText}`
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-3xl w-full border-2 border-border max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground mb-1">{getTitle()}</h2>
              <p className="text-sm text-muted-foreground">{getDescription()}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={loading || accountabilityData.length === 0}
                className="px-3 py-2 bg-success hover:bg-success/90 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📥 Export CSV
              </button>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading accountability data...</p>
            </div>
          ) : accountabilityData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No {type === 'sales' ? 'Sales' : 'Expenses'} Data Available
              </h3>
              <p className="text-muted-foreground mb-4">
                {type === 'sales' 
                  ? `No completed sales transactions found for ${dateRange === 'today' ? 'today' : dateRange === 'week' ? 'this week' : dateRange === 'month' ? 'this month' : 'all time'}.`
                  : `No expenses recorded for ${dateRange === 'today' ? 'today' : dateRange === 'week' ? 'this week' : dateRange === 'month' ? 'this month' : 'all time'}.`
                }
              </p>
              <div className="bg-muted/40 border border-border rounded-lg p-4 max-w-md mx-auto text-left">
                <h4 className="font-semibold text-sm text-foreground mb-2">💡 Possible reasons:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  {type === 'sales' ? (
                    <>
                      <li>No sales have been made in this period</li>
                      <li>All transactions are still pending (credit sales)</li>
                      <li>Try selecting a different date range above</li>
                      <li>Check if transactions were created by different users</li>
                    </>
                  ) : (
                    <>
                      <li>No expenses have been recorded yet</li>
                      <li>Try selecting a different date range</li>
                      <li>Click "Add Expense" to start tracking</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Total {type === 'sales' || type === 'cash' || type === 'mpesa' ? 'Sales' : type === 'expenses' ? 'Expenses' : 'Profit'}
                    </p>
                    <p className="text-3xl font-bold text-foreground">KES {totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Contributors</p>
                    <p className="text-2xl font-bold text-primary">{accountabilityData.length}</p>
                  </div>
                </div>
              </div>

              {/* User Breakdown */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">Breakdown by User</h3>
                {accountabilityData.map((userData, index) => (
                  <div
                    key={userData.userId}
                    className="bg-muted/40 border border-border rounded-lg overflow-hidden"
                  >
                    <div 
                      className="p-5 hover:bg-muted/60 transition-colors cursor-pointer"
                      onClick={() => setExpandedUserId(expandedUserId === userData.userId ? null : userData.userId)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-lg font-semibold text-foreground">{userData.userName}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              userData.userRole === 'admin' 
                                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300' 
                                : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            }`}>
                              {userData.userRole}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            📧 {userData.userEmail}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {type === 'sales' || type === 'cash' || type === 'mpesa'
                              ? `${userData.transactionCount} transaction${userData.transactionCount !== 1 ? 's' : ''}`
                              : type === 'expenses'
                              ? `${userData.expenseCount} expense${userData.expenseCount !== 1 ? 's' : ''}`
                              : `Sales: KES ${(userData.totalSales || 0).toLocaleString()}, Expenses: KES ${(userData.totalExpenses || 0).toLocaleString()}`
                            }
                            <span className="text-xs ml-2">
                              {expandedUserId === userData.userId ? '▼' : '▶'} Click to {expandedUserId === userData.userId ? 'hide' : 'view'} details
                            </span>
                          </p>
                        </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">
                          {type === 'sales' || type === 'cash' || type === 'mpesa' ? 'Earnings' : type === 'expenses' ? 'Expenses' : 'Net Profit'}
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          KES {(
                            type === 'sales' || type === 'cash' || type === 'mpesa' ? (userData.totalEarnings || 0) : 
                            type === 'expenses' ? (userData.totalExpenses || 0) :
                            (userData.netProfit || 0)
                          ).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {totalAmount > 0 
                            ? `${((type === 'sales' || type === 'cash' || type === 'mpesa' ? (userData.totalEarnings || 0) : type === 'expenses' ? (userData.totalExpenses || 0) : (userData.netProfit || 0)) / totalAmount * 100).toFixed(1)}% of total`
                            : '0% of total'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-500"
                        style={{ 
                          width: totalAmount > 0 
                            ? `${(((type === 'sales' || type === 'cash' || type === 'mpesa' ? (userData.totalEarnings || 0) : type === 'expenses' ? (userData.totalExpenses || 0) : (userData.netProfit || 0)) / totalAmount * 100).toFixed(1))}%`
                            : '0%'
                        }}
                      ></div>
                    </div>
                    </div>

                    {/* Expandable Transaction Details */}
                    {expandedUserId === userData.userId && (type === 'sales' || type === 'cash' || type === 'mpesa') && userData.transactions && userData.transactions.length > 0 && (
                      <div className="border-t border-border bg-card/50 p-4">
                        <h5 className="font-semibold text-sm text-foreground mb-3">
                          Transaction Details ({userData.transactions.length})
                        </h5>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {userData.transactions.map((transaction) => (
                            <div key={transaction.id} className="bg-muted/30 border border-border rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-semibold text-sm text-foreground">
                                    {new Date(transaction.timestamp).toLocaleString('en-KE', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {transaction.paymentMethod === 'mpesa' ? 'M-Pesa' : 
                                     transaction.paymentMethod === 'credit' ? 'Credit' : 'Cash'}
                                  </p>
                                </div>
                                <p className="font-bold text-primary">KES {(transaction.total || 0).toLocaleString()}</p>
                              </div>
                              {transaction.items && transaction.items.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Items Sold:</p>
                                  <ul className="space-y-1">
                                    {transaction.items.map((item, idx) => (
                                      <li key={idx} className="text-xs text-foreground flex justify-between">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span className="font-semibold">KES {((item.price || 0) * (item.quantity || 0)).toLocaleString()}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
