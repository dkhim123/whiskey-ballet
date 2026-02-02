"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import AccountabilityModal from "../components/AccountabilityModal"
import BranchSelector from "../components/BranchSelector"
import { getAdminIdForStorage } from "../utils/auth"
import { readData, writeData, readSharedData, writeSharedData } from "../utils/storage"
// TODO: Implement subscribeToExpenses for admin real-time
import { exportExpensesToCSV } from "../utils/csvExport"

export default function ExpensesPage({ currentUser }) {
  const [expenses, setExpenses] = useState([])
  const [allExpenses, setAllExpenses] = useState([]) // Store all expenses for admin
  const [selectedBranch, setSelectedBranch] = useState(currentUser?.role === 'admin' ? '' : currentUser?.branchId || '')
  const [settings, setSettings] = useState({
    spendingLimitPercentage: 50,
    enableSpendingAlerts: true
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [dateRange, setDateRange] = useState('month') // today, week, month, all
  const [showAccountabilityModal, setShowAccountabilityModal] = useState(false)
  const [accountabilityType, setAccountabilityType] = useState(null)

  // Real-time Firestore expenses listener for admin
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
      const adminId = getAdminIdForStorage(currentUser);
      let unsub = null;
      unsub = require('../services/realtimeExtraListeners').subscribeToExpenses(adminId, (data) => {
        setAllExpenses(data);
      });
      return () => { if (unsub) unsub(); };
    }
    // Cashier logic remains as is
  }, [currentUser, selectedBranch]);

  const [metrics, setMetrics] = useState({ income: 0, expenses: 0, cashIncome: 0, mpesaIncome: 0 })
  const [filteredExpenses, setFilteredExpenses] = useState([])

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        // Calculate metrics inline to avoid stale closure issues
        const userId = currentUser?.id
        if (!userId) {
          setMetrics({ income: 0, expenses: 0, cashIncome: 0, mpesaIncome: 0 })
          setFilteredExpenses([])
          return
        }

        const adminId = getAdminIdForStorage(currentUser)
        const sharedData = await readSharedData(adminId)
        const transactions = sharedData.transactions || []
        
        // Calculate start date based on dateRange
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
            startDate = new Date(0) // Beginning of time
            break
          default:
            startDate.setMonth(now.getMonth() - 1)
        }

        // Calculate income from transactions (only count completed transactions)
        // Apply branch filtering to transactions
        const filteredTransactions = transactions.filter(t => {
          const matchesDate = new Date(t.timestamp) >= startDate
          const matchesStatus = t.paymentStatus === 'completed' || !t.paymentStatus
          
          // Branch filtering
          let matchesBranch = true
          if (currentUser.role === 'cashier' || currentUser.role === 'manager') {
            // Strict: non-admins only see items explicitly assigned to their branch
            matchesBranch = !!t.branchId && t.branchId === currentUser.branchId
          } else if (currentUser.role === 'admin' && selectedBranch) {
            matchesBranch = t.branchId === selectedBranch
          }
          
          return matchesDate && matchesStatus && matchesBranch
        })
        
        // Calculate income from sales AND loan repayments
        const salesIncome = filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0)
        const salesCashIncome = filteredTransactions
          .filter(t => t.paymentMethod === 'cash')
          .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0)
        const salesMpesaIncome = filteredTransactions
          .filter(t => t.paymentMethod === 'mpesa')
          .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0)

        // Helper function for expense branch filtering
        const expenseMatchesBranch = (exp) => {
          if (currentUser.role === 'cashier' || currentUser.role === 'manager') {
            // Strict: non-admins only see items explicitly assigned to their branch
            return !!exp.branchId && exp.branchId === currentUser.branchId
          } else if (currentUser.role === 'admin' && selectedBranch) {
            return exp.branchId === selectedBranch
          }
          return true // Admin with no branch filter sees all
        }

        // Add loan repayments to income (money received from customers, exclude soft-deleted)
        const loanRepayments = expenses
          .filter(e => !e.deletedAt && new Date(e.date) >= startDate && e.type === 'income' && expenseMatchesBranch(e))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
        
        // Break down loan repayments by payment method (exclude soft-deleted)
        const loanCashIncome = expenses
          .filter(e => !e.deletedAt && new Date(e.date) >= startDate && e.type === 'income' && (e.paymentMethod === 'Cash' || e.paymentMethod === 'cash') && expenseMatchesBranch(e))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
        
        const loanMpesaIncome = expenses
          .filter(e => !e.deletedAt && new Date(e.date) >= startDate && e.type === 'income' && (e.paymentMethod === 'M-Pesa' || e.paymentMethod === 'mpesa') && expenseMatchesBranch(e))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
        
        const income = salesIncome + loanRepayments
        const cashIncome = salesCashIncome + loanCashIncome
        const mpesaIncome = salesMpesaIncome + loanMpesaIncome

        // Calculate expenses (exclude income entries like loan repayments and soft-deleted items)
        const expensesTotal = expenses
          .filter(e => !e.deletedAt && new Date(e.date) >= startDate && e.type !== 'income' && expenseMatchesBranch(e))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

        console.log(`💰 Metrics calculated: Income=${income}, Expenses=${expensesTotal} (Branch: ${selectedBranch || 'All'}, Range: ${dateRange})`)
        setMetrics({ income, expenses: expensesTotal, cashIncome, mpesaIncome })

        // Calculate filtered expenses for display
        const filtered = expenses.filter(exp => {
          if (exp.deletedAt) return false
          
          // Branch filtering
          let matchesBranch = true
          if (currentUser.role === 'cashier' || currentUser.role === 'manager') {
            // Cashiers only see their branch's expenses
            matchesBranch = !!exp.branchId && exp.branchId === currentUser.branchId
          } else if (currentUser.role === 'admin' && selectedBranch) {
            // Admin filtering by specific branch
            matchesBranch = exp.branchId === selectedBranch
          }
          // If admin hasn't selected a branch, show all (matchesBranch stays true)
          
          const expDate = new Date(exp.date)
          const matchesDate = expDate >= startDate
          const matchesSearch = searchTerm === "" || 
            exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            exp.category.toLowerCase().includes(searchTerm.toLowerCase())
          return matchesBranch && matchesDate && matchesSearch
        })
        
        console.log(`🔍 Filtered expenses: ${filtered.length} (Branch: ${selectedBranch || 'All'}, Search: "${searchTerm}", Range: ${dateRange})`)
        setFilteredExpenses(filtered)
      } catch (error) {
        console.error('Error loading metrics:', error)
        setMetrics({ income: 0, expenses: 0, cashIncome: 0, mpesaIncome: 0 })
        setFilteredExpenses([])
      }
    }
    loadMetrics()
  }, [expenses, dateRange, currentUser, searchTerm, selectedBranch])

  const totalExpenses = filteredExpenses.reduce((sum, e) => {
    const amount = parseFloat(e.amount) || 0
    // Income entries (loan repayments) should reduce expenses
    return e.type === 'income' ? sum - amount : sum + amount
  }, 0)
  const expensePercentage = metrics.income > 0 ? (metrics.expenses / metrics.income) * 100 : 0
  const isOverLimit = settings.enableSpendingAlerts && expensePercentage > settings.spendingLimitPercentage

  const handleAddExpense = async (newExpense) => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      const adminId = getAdminIdForStorage(currentUser)
      
      // Read from appropriate storage
      let data, currentExpenses
      if (currentUser.role === 'cashier') {
        data = await readData(userId)
        currentExpenses = data.expenses || []
      } else {
        data = await readSharedData(adminId)
        currentExpenses = data.expenses || []
      }
      
      const maxId = Math.max(...currentExpenses.map(e => e.id), 0)
      
      const expenseToAdd = {
        ...newExpense,
        id: maxId + 1,
        createdAt: new Date().toISOString(),
        branchId: currentUser.branchId, // Track which branch this expense belongs to
        userId: currentUser.id, // Track who created it
        userName: currentUser.name, // Track who created it by name
      }

      const updatedExpenses = [...currentExpenses, expenseToAdd]
      
      console.log(`➕ Adding expense: ${expenseToAdd.description} (${expenseToAdd.amount}) to ${currentUser.role === 'admin' ? 'shared' : 'user'} storage`)
      
      // Save to appropriate storage
      if (currentUser.role === 'cashier') {
        await writeData({
          ...data,
          expenses: updatedExpenses
        }, userId)
      } else {
        await writeSharedData({
          ...data,
          expenses: updatedExpenses
        }, adminId)
      }

      setExpenses(updatedExpenses)
      setAllExpenses(updatedExpenses)
      setShowAddModal(false)
      alert('Expense added successfully!')
    } catch (error) {
      console.error('Error adding expense:', error)
      alert('Failed to add expense')
    }
  }

  const handleEditExpense = async (updatedExpense) => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      const adminId = getAdminIdForStorage(currentUser)
      
      // Read from appropriate storage
      let data, currentExpenses
      if (currentUser.role === 'cashier') {
        data = await readData(userId)
        currentExpenses = data.expenses || []
      } else {
        data = await readSharedData(adminId)
        currentExpenses = data.expenses || []
      }
      
      const updatedExpenses = currentExpenses.map(e => 
        e.id === updatedExpense.id ? updatedExpense : e
      )

      // Save to appropriate storage
      if (currentUser.role === 'cashier') {
        await writeData({
          ...data,
          expenses: updatedExpenses
        }, userId)
      } else {
        await writeSharedData({
          ...data,
          expenses: updatedExpenses
        }, adminId)
      }

      // Update local state - need to refresh from storage
      const filteredByBranch = selectedBranch 
        ? updatedExpenses.filter(e => e.branchId === selectedBranch)
        : updatedExpenses
      setExpenses(filteredByBranch)
      setAllExpenses(updatedExpenses)
      setShowEditModal(false)
      alert('Expense updated successfully!')
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('Failed to update expense')
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      const userId = currentUser?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      const adminId = getAdminIdForStorage(currentUser)
      
      // Read from appropriate storage
      let data, currentExpenses
      if (currentUser.role === 'cashier') {
        data = await readData(userId)
        currentExpenses = data.expenses || []
      } else {
        data = await readSharedData(adminId)
        currentExpenses = data.expenses || []
      }
      
      // Soft delete: mark as deleted instead of removing
      const updatedExpenses = currentExpenses.map(e => 
        e.id === expenseId
          ? { ...e, deletedAt: new Date().toISOString(), deletedBy: userId }
          : e
      )

      // Save to appropriate storage
      if (currentUser.role === 'cashier') {
        await writeData({
          ...data,
          expenses: updatedExpenses
        }, userId)
      } else {
        await writeSharedData({
          ...data,
          expenses: updatedExpenses
        }, adminId)
      }

      // Update local state
      const filteredByBranch = selectedBranch 
        ? updatedExpenses.filter(e => e.branchId === selectedBranch && !e.deletedAt)
        : updatedExpenses.filter(e => !e.deletedAt)
      setExpenses(filteredByBranch)
      setAllExpenses(updatedExpenses)
      alert('Expense deleted successfully!')
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('Failed to delete expense')
    }
  }

  const handleUpdateSettings = async (newSettings) => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      const data = await readData(userId)
      
      await writeData({
        ...data,
        settings: {
          ...data.settings,
          spendingLimitPercentage: newSettings.spendingLimitPercentage,
          enableSpendingAlerts: newSettings.enableSpendingAlerts
        }
      }, userId)

      setSettings(newSettings)
      setShowSettingsModal(false)
      alert('Settings updated successfully!')
    } catch (error) {
      console.error('Error updating settings:', error)
      alert('Failed to update settings')
    }
  }

  const handleExportCSV = () => {
    const dateRangeText = dateRange === 'today' ? 'today' :
                         dateRange === 'week' ? 'week' :
                         dateRange === 'month' ? 'month' : 'all'
    const filename = `expenses_${dateRangeText}_${new Date().toISOString().split('T')[0]}.csv`
    exportExpensesToCSV(filteredExpenses, filename)
    alert(`Exported ${filteredExpenses.length} expense(s) to ${filename}`)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Expense Tracker"
        subtitle="Track business expenses and monitor spending limits"
        actions={[
          <button
            key="export"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-success hover:bg-success/90 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg mr-2"
            disabled={filteredExpenses.length === 0}
          >
            📥 Export CSV
          </button>,
          <button
            key="settings"
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg mr-2"
          >
            ⚙️ Settings
          </button>,
          <button
            key="add"
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
          >
            + Add Expense
          </button>,
        ]}
      />

      {/* Branch Filter - Admin Only */}
      {currentUser?.role === 'admin' && (
        <div className="px-6 py-4 bg-muted/30 border-b border-border">
          <BranchSelector
            currentUser={currentUser}
            selectedBranch={selectedBranch}
            onBranchChange={(branchId) => {
              setSelectedBranch(branchId)
            }}
          />
          <p className="text-sm text-muted-foreground mt-2">
            ℹ️ Note: Expenses are currently tracked per-user. Multi-branch expense aggregation coming soon.
          </p>
        </div>
      )}

      {/* Cashier Branch Info */}
      {currentUser?.role === 'cashier' && currentUser.branchId && (
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-blue-900 dark:text-blue-300 font-medium">
              Tracking expenses for your branch
            </span>
          </div>
        </div>
      )}

      <div className="p-6 flex-1 overflow-auto">
        {/* Spending Limit Alert */}
        {isOverLimit && (
          <div className="mb-4 bg-linear-to-r from-destructive/10 via-destructive/5 to-destructive/10 border-2 border-destructive rounded-xl p-5 shadow-lg animate-pulse-slow">
            <h3 className="font-bold text-destructive mb-2 flex items-center gap-3 text-xl">
              <span className="text-3xl">⚠️</span>
              <span>Spending Limit Exceeded!</span>
            </h3>
            <p className="text-foreground text-base">
              Your expenses are at <span className="font-bold text-destructive text-lg">{expensePercentage.toFixed(1)}%</span> of income, 
              exceeding your limit of <span className="font-bold text-destructive text-lg">{settings.spendingLimitPercentage}%</span>.
              <br/>
              <span className="text-sm text-muted-foreground mt-1 block">
                Consider reducing expenses or reviewing your spending limit settings.
              </span>
            </p>
          </div>
        )}

        {/* Date Range Filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          {['today', 'week', 'month', 'all'].map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                dateRange === range
                  ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                  : 'bg-card text-foreground border border-border hover:bg-muted hover:scale-105'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div 
            className="bg-linear-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer"
            onClick={() => {
              setAccountabilityType('sales')
              setShowAccountabilityModal(true)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setAccountabilityType('sales')
                setShowAccountabilityModal(true)
              }
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm opacity-90 font-medium">💰 Total Income</div>
              <div className="bg-white/20 rounded-lg px-3 py-1 text-xs font-bold">
                {dateRange.toUpperCase()}
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">KES {metrics.income.toLocaleString()}</div>
            <div className="text-sm opacity-90 space-y-1">
              <div className="flex justify-between">
                <span>💵 Cash:</span>
                <span className="font-semibold">KES {metrics.cashIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>📱 M-Pesa:</span>
                <span className="font-semibold">KES {metrics.mpesaIncome.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div 
            className="bg-linear-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer"
            onClick={() => {
              setAccountabilityType('expenses')
              setShowAccountabilityModal(true)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setAccountabilityType('expenses')
                setShowAccountabilityModal(true)
              }
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm opacity-90 font-medium">💸 Total Expenses</div>
              <div className="bg-white/20 rounded-lg px-3 py-1 text-xs font-bold">
                {dateRange.toUpperCase()}
              </div>
            </div>
            <div className="text-4xl font-bold mb-2">KES {metrics.expenses.toLocaleString()}</div>
            <div className="text-sm opacity-90">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} recorded
            </div>
          </div>
          <div className="bg-linear-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
            <div className="text-sm opacity-90 mb-3 font-medium">📊 Net Profit</div>
            <div className={`text-4xl font-bold mb-2`}>
              KES {(metrics.income - metrics.expenses).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">
              <div className="flex justify-between items-center">
                <span>Expense Ratio:</span>
                <span className={`font-bold text-lg ${isOverLimit ? 'text-yellow-300' : 'text-white'}`}>
                  {expensePercentage.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 bg-white/20 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all ${isOverLimit ? 'bg-yellow-300' : 'bg-white'}`}
                  style={{ width: `${Math.min(expensePercentage, 100)}%` }}
                ></div>
              </div>
              <div className="text-xs mt-1 opacity-75">
                Limit: {settings.spendingLimitPercentage}%
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search expenses by description or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
          />
        </div>

        {/* Expenses Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Description</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Amount</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense, idx) => (
                  <tr key={expense.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/20 hover:bg-muted/40 transition-colors"}>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-foreground">
                        {new Date(expense.date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(expense.date).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-semibold">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <span className="font-semibold text-destructive">
                        KES {expense.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            setSelectedExpense(expense)
                            setShowEditModal(true)
                          }}
                          className="px-3 py-1 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors text-xs font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="px-3 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">
                    {searchTerm ? 'No expenses found matching your search' : 'No expenses yet. Add your first expense!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddExpenseModal onAdd={handleAddExpense} onClose={() => setShowAddModal(false)} />
      )}

      {showEditModal && selectedExpense && (
        <EditExpenseModal
          expense={selectedExpense}
          onSave={handleEditExpense}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          onSave={handleUpdateSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

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

// Add Expense Modal Component
function AddExpenseModal({ onAdd, onClose }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: "Operations",
    description: "",
    amount: 0,
  })

  const categories = [
    "Operations",
    "Utilities",
    "Rent",
    "Salaries",
    "Supplies",
    "Marketing",
    "Transport",
    "Maintenance",
    "Other"
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.description) {
      alert("Description is required")
      return
    }
    if (formData.amount <= 0) {
      alert("Amount must be greater than 0")
      return
    }
    onAdd(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-md w-full border-2 border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Add New Expense</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Category *</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              list="expense-categories-add"
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              placeholder="e.g., Operations, Used to buy chairs"
              required
            />
            <datalist id="expense-categories-add">
              {categories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground mt-1">
              Select from suggestions or type your own custom category
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground resize-none"
              rows="3"
              placeholder="What was this expense for?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Amount (KES) *</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Expense Modal Component
function EditExpenseModal({ expense, onSave, onClose }) {
  const [formData, setFormData] = useState({
    date: expense.date.split('T')[0],
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
  })

  const categories = [
    "Operations",
    "Utilities",
    "Rent",
    "Salaries",
    "Supplies",
    "Marketing",
    "Transport",
    "Maintenance",
    "Other"
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.description) {
      alert("Description is required")
      return
    }
    if (formData.amount <= 0) {
      alert("Amount must be greater than 0")
      return
    }
    onSave({ ...expense, ...formData })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-md w-full border-2 border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Edit Expense</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Category *</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              list="expense-categories-edit"
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              placeholder="e.g., Operations, Used to buy chairs"
              required
            />
            <datalist id="expense-categories-edit">
              {categories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground mt-1">
              Select from suggestions or type your own custom category
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground resize-none"
              rows="3"
              placeholder="What was this expense for?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Amount (KES) *</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Settings Modal Component
function SettingsModal({ settings, onSave, onClose }) {
  const [formData, setFormData] = useState({
    spendingLimitPercentage: settings.spendingLimitPercentage,
    enableSpendingAlerts: settings.enableSpendingAlerts,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : parseFloat(value) || 0,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.spendingLimitPercentage < 0 || formData.spendingLimitPercentage > 100) {
      alert("Spending limit must be between 0 and 100")
      return
    }
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-md w-full border-2 border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Spending Limit Settings</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Spending Limit (% of Income)
            </label>
            <input
              type="number"
              name="spendingLimitPercentage"
              value={formData.spendingLimitPercentage}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              min="0"
              max="100"
              step="1"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              You'll be alerted when expenses exceed this percentage of your income
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="enableSpendingAlerts"
              checked={formData.enableSpendingAlerts}
              onChange={handleChange}
              className="w-5 h-5 rounded border-2 border-border"
            />
            <label className="text-sm font-medium text-foreground">
              Enable spending limit alerts
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
