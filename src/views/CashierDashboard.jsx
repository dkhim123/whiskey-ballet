"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import DashboardCard from "../components/DashboardCard"
import RecentTransactions from "../components/RecentTransactions"
import AccountabilityModal from "../components/AccountabilityModal"
import { readSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToTransactions, subscribeToTransactionsByBranch } from "../services/realtimeListeners"
import { formatTimeAgo, isWithinLastMs } from "../utils/dateUtils"

export default function CashierDashboard({ currentUser }) {
  const [dashboardData, setDashboardData] = useState({
    dailyTotal: 0,
    transactionsCount: 0,
    averageSale: 0,
    recentTransactions: [],
    fullTransactions: []
  })
  const [showAccountabilityModal, setShowAccountabilityModal] = useState(false)
  const [accountabilityType, setAccountabilityType] = useState(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const userId = currentUser?.id
        if (!userId) return
        
        const adminId = getAdminIdForStorage(currentUser)
        const sharedData = await readSharedData(adminId)
        const allTransactions = sharedData.transactions || []
        
        // Filter transactions by cashier (userId or cashierId, normalized) and branch
        const branchId = currentUser?.branchId
        const norm = (v) => (v != null ? String(v).trim() : '')
        const transactions = allTransactions.filter(t => {
          const matchesUser = norm(t.userId) === norm(userId) || norm(t.cashierId) === norm(userId)
          const matchesBranch = !branchId || t.branchId === branchId
          return matchesUser && matchesBranch
        })
        
        // Get last 24h transactions (offline path: same logic as realtime so cards match)
        const oneDayMs = 24 * 60 * 60 * 1000
        const todayTransactions = transactions.filter(t => isWithinLastMs(t.timestamp, oneDayMs))
        
        // Calculate metrics
        const dailyTotal = todayTransactions.reduce((sum, t) => sum + (t.total ?? 0), 0)
        const transactionsCount = todayTransactions.length
        const averageSale = transactionsCount > 0 ? Math.round(dailyTotal / transactionsCount) : 0
        
        // Format recent transactions
        const recentTransactions = transactions
          .slice(-5)
          .reverse()
          .map(t => ({
            id: t.id,
            type: t.paymentMethod === 'mpesa' ? 'M-Pesa' : 
                  t.paymentMethod === 'credit' ? 'Credit' : 'Cash',
            amount: t.total ?? 0,
            time: formatTimeAgo(t.timestamp),
            items: t.itemCount ?? 0
          }))
        
        setDashboardData({
          dailyTotal,
          transactionsCount,
          averageSale,
          recentTransactions,
          fullTransactions: transactions
        })
      } catch (error) {
        // Silent error handling
      }
    }
    
    const adminId = currentUser ? getAdminIdForStorage(currentUser) : null
    const canUseRealtime =
      typeof window !== "undefined" &&
      !!adminId &&
      (typeof navigator === "undefined" ? true : navigator.onLine)

    if (!canUseRealtime) {
      loadDashboardData()
      const interval = setInterval(loadDashboardData, 30000)
      return () => clearInterval(interval)
    }

    const branchId = currentUser?.branchId
    const subscribe = branchId
      ? (cb) => subscribeToTransactionsByBranch(adminId, branchId, cb)
      : (cb) => subscribeToTransactions(adminId, cb)
    const unsub = subscribe((allTransactions) => {
      const userId = currentUser?.id
      if (!userId) return
      const norm = (v) => (v != null ? String(v).trim() : '')
      const transactions = (allTransactions || []).filter((t) => {
        const matchesUser = norm(t.userId) === norm(userId) || norm(t.cashierId) === norm(userId)
        const matchesBranch = !branchId || t.branchId === branchId
        return matchesUser && matchesBranch
      })

      // Use last 24 hours so cards reflect recent sales (e.g. "3h ago")
      const oneDayMs = 24 * 60 * 60 * 1000
      const last24hTransactions = transactions.filter((t) => isWithinLastMs(t.timestamp, oneDayMs))

      const dailyTotal = last24hTransactions.reduce((sum, t) => sum + (t.total ?? 0), 0)
      const transactionsCount = last24hTransactions.length
      const averageSale = transactionsCount > 0 ? Math.round(dailyTotal / transactionsCount) : 0

      const recentTransactions = transactions
        .slice(-5)
        .reverse()
        .map((t) => ({
          id: t.id,
          type:
            t.paymentMethod === "mpesa"
              ? "M-Pesa"
              : t.paymentMethod === "credit"
              ? "Credit"
              : "Cash",
          amount: t.total ?? 0,
          time: formatTimeAgo(t.timestamp),
          items: t.itemCount ?? 0,
        }))

      setDashboardData({
        dailyTotal,
        transactionsCount,
        averageSale,
        recentTransactions,
        fullTransactions: transactions,
      })
    })

    return () => {
      try {
        unsub && unsub()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.branchId])

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Cashier Dashboard" subtitle="Your daily sales summary" />

      <div className="p-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <DashboardCard
            title="Daily Total"
            value={`KES ${dashboardData.dailyTotal.toLocaleString()}`}
            icon="💰"
            variant="success"
            onClick={() => {
              setAccountabilityType('sales')
              setShowAccountabilityModal(true)
            }}
          />
          <DashboardCard
            title="Transactions"
            value={dashboardData.transactionsCount}
            icon="📋"
            variant="primary"
            onClick={() => {
              setAccountabilityType('sales')
              setShowAccountabilityModal(true)
            }}
          />
          <DashboardCard
            title="Average Sale"
            value={`KES ${dashboardData.averageSale.toLocaleString()}`}
            icon="📈"
            variant="warning"
            onClick={() => {
              setAccountabilityType('sales')
              setShowAccountabilityModal(true)
            }}
          />
        </div>

        <RecentTransactions 
          transactions={dashboardData.recentTransactions} 
          fullTransactions={dashboardData.fullTransactions}
        />
      </div>

      {/* Accountability Modal */}
      {showAccountabilityModal && (
        <AccountabilityModal
          type={accountabilityType}
          onClose={() => setShowAccountabilityModal(false)}
          dateRange="today"
          currentUser={currentUser}
        />
      )}
    </div>
  )
}
