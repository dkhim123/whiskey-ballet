"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import DashboardCard from "../components/DashboardCard"
import RecentTransactions from "../components/RecentTransactions"
import AccountabilityModal from "../components/AccountabilityModal"
import { readSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"

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
        if (!userId) {
          console.error('No user ID available')
          return
        }
        
        // Read from SHARED storage for transactions (visible to all users)
        const adminId = getAdminIdForStorage(currentUser)
        const sharedData = await readSharedData(adminId)
        const allTransactions = sharedData.transactions || []
        
        // Filter transactions created by THIS cashier only
        const transactions = allTransactions.filter(t => t.userId === userId)
        
        // Get today's date at midnight
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Filter today's transactions (include ALL transactions - cash, mpesa, and credit)
        const todayTransactions = transactions.filter(t => {
          const transDate = new Date(t.timestamp)
          transDate.setHours(0, 0, 0, 0)
          // Include ALL transactions regardless of payment status
          return transDate.getTime() === today.getTime()
        })
        
        // Calculate metrics
        const dailyTotal = todayTransactions.reduce((sum, t) => sum + (t.total ?? 0), 0)
        const transactionsCount = todayTransactions.length
        const averageSale = transactionsCount > 0 ? Math.round(dailyTotal / transactionsCount) : 0
        
        // Format recent transactions (last 5)
        const recentTransactions = transactions
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
              type: t.paymentMethod === 'mpesa' ? 'M-Pesa' : 
                    t.paymentMethod === 'credit' ? 'Credit' : 'Cash',
              amount: t.total ?? 0,
              time: timeAgo,
              items: t.itemCount ?? 0
            }
          })
        
        setDashboardData({
          dailyTotal,
          transactionsCount,
          averageSale,
          recentTransactions,
          fullTransactions: transactions
        })
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      }
    }
    
    loadDashboardData()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [currentUser])

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
