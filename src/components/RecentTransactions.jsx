"use client"

import { useState, useMemo } from "react"
import TransactionDetailsModal from "./TransactionDetailsModal"

export default function RecentTransactions({ transactions, fullTransactions = [] }) {
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [timeFilter, setTimeFilter] = useState('recent') // 'recent', '1hr', '2hrs', 'today', 'all'
  const [isExpanded, setIsExpanded] = useState(false)

  // Filter transactions by time
  const filteredTransactions = useMemo(() => {
    if (timeFilter === 'recent') {
      return transactions.slice(0, 5) // Show only last 5 by default
    }

    const now = Date.now()
    let cutoffTime

    switch (timeFilter) {
      case '1hr':
        cutoffTime = now - (60 * 60 * 1000) // 1 hour ago
        break
      case '2hrs':
        cutoffTime = now - (2 * 60 * 60 * 1000) // 2 hours ago
        break
      case 'today':
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        cutoffTime = today.getTime()
        break
      case 'all':
        return transactions // Show all
      default:
        return transactions.slice(0, 5)
    }

    return transactions.filter(tx => {
      // Parse time from "5 min ago", "2h ago", etc.
      const timeParts = tx.time.match(/(\d+)\s*(min|h|d)/)
      if (!timeParts) return true // Include "Just now"

      const value = parseInt(timeParts[1])
      const unit = timeParts[2]

      let txTime = now
      if (unit === 'min') txTime = now - (value * 60 * 1000)
      else if (unit === 'h') txTime = now - (value * 60 * 60 * 1000)
      else if (unit === 'd') txTime = now - (value * 24 * 60 * 60 * 1000)

      return txTime >= cutoffTime
    })
  }, [transactions, timeFilter])

  const displayTransactions = isExpanded ? filteredTransactions : filteredTransactions.slice(0, 5)

  const handleTransactionClick = (tx) => {
    // Find the full transaction data from storage
    const fullTx = fullTransactions.find(t => t.id === tx.id)
    if (fullTx) {
      setSelectedTransaction(fullTx)
    } else {
      // Fallback to display data if full transaction not found
      setSelectedTransaction({
        ...tx,
        items: [],
        paymentMethod: tx.type?.toLowerCase() === 'm-pesa' ? 'mpesa' : 'cash',
        total: tx.amount,
        subtotal: tx.amount,
        discount: 0,
        discountAmount: 0,
        itemCount: tx.items || 0,
        timestamp: new Date().toISOString()
      })
    }
  }

  return (
    <>
      <div className="bg-card border border-border rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] flex flex-col max-h-[600px]">
        {/* Header with Time Filters */}
        <div className="p-6 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-bold text-foreground mb-3">Recent Transactions</h2>
          
          {/* Time Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'recent', label: '📌 Last 5', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' },
              { id: '1hr', label: '🕐 1 Hour', color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' },
              { id: '2hrs', label: '🕑 2 Hours', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30' },
              { id: 'today', label: '📅 Today', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30' },
              { id: 'all', label: '📊 All', color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => {
                  setTimeFilter(filter.id)
                  setIsExpanded(filter.id !== 'recent')
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all ${
                  timeFilter === filter.id
                    ? filter.color + ' shadow-md scale-105'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List with Fixed Height */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div className="space-y-3">
            {displayTransactions.length > 0 ? (
              displayTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => handleTransactionClick(tx)}
                  className="flex items-center justify-between p-4 bg-muted/40 rounded-lg hover:bg-muted/60 transition-all cursor-pointer border border-border/50 hover:border-primary/50 hover:shadow-md"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleTransactionClick(tx)
                    }
                  }}
                >
                  <div className="flex-1 flex items-center">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{tx.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {tx.items} items • {tx.time}
                        {tx.cashier && <span> • by {tx.cashier}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-primary">KES {(tx.amount ?? 0).toLocaleString()}</p>
                    <span className="text-muted-foreground">›</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions in this period</p>
              </div>
            )}
          </div>
        </div>

        {/* View All / Show Less Toggle */}
        {filteredTransactions.length > 5 && timeFilter === 'recent' && (
          <div className="p-4 border-t border-border flex-shrink-0 bg-muted/20">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-4 py-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-2"
            >
              {isExpanded ? (
                <>
                  <span>Show Less</span>
                  <span className="text-lg">↑</span>
                </>
              ) : (
                <>
                  <span>View All ({filteredTransactions.length} total)</span>
                  <span className="text-lg">↓</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </>
  )
}
