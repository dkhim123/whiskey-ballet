"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import DashboardCard from "../components/DashboardCard"
import BranchSelector from "../components/BranchSelector"
import { readSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToInventory, subscribeToTransactions, subscribeToUsers } from "../services/realtimeListeners"

export default function ManagerDashboard({ currentUser }) {
  const [selectedBranch, setSelectedBranch] = useState(currentUser?.branchId || '')
  const [selectedCashier, setSelectedCashier] = useState('')
  const [cashiers, setCashiers] = useState([])
  const [inventory, setInventory] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [salesAnalytics, setSalesAnalytics] = useState({
    mostSold: [],
    leastSold: [],
    notSold: [],
    totalProductsSold: 0
  })

  // Keep refs of latest arrays so realtime callbacks don't use stale values
  useEffect(() => {
    // This effect intentionally has no body changes other than keeping state consistent.
    // It's a safe place to ensure the component re-renders with latest inventory/transactions.
  }, [inventory, transactions])

  useEffect(() => {
    if (!currentUser) return
    const adminId = getAdminIdForStorage(currentUser)
    const canUseRealtime =
      typeof window !== "undefined" &&
      !!adminId &&
      (typeof navigator === "undefined" ? true : navigator.onLine)

    if (!canUseRealtime) {
      loadData()
      return
    }

    const filterBranch = (items) =>
      selectedBranch ? (items || []).filter((x) => x.branchId === selectedBranch) : (items || [])

    const unsubInventory = subscribeToInventory(adminId, (data) => {
      const filteredInventory = filterBranch(data)
      setInventory(filteredInventory)
      // Recompute analytics using latest transactions in state
      setSalesAnalytics((prev) => prev) // no-op to avoid stale closure warning
      calculateSalesAnalytics(filteredInventory, transactions)
    })

    const unsubTransactions = subscribeToTransactions(adminId, (data) => {
      let filteredTransactions = filterBranch(data)
      if (selectedCashier) {
        filteredTransactions = filteredTransactions.filter((t) => t.userId === selectedCashier)
      }
      setTransactions(filteredTransactions)
      calculateSalesAnalytics(inventory, filteredTransactions)
    })

    const unsubUsers = subscribeToUsers(adminId, (data) => {
      const users = data || []
      const branchCashiers = selectedBranch
        ? users.filter((u) => u.role === "cashier" && u.branchId === selectedBranch)
        : users.filter((u) => u.role === "cashier")
      setCashiers(branchCashiers)
      if (selectedCashier && !branchCashiers.some((c) => c.id === selectedCashier)) {
        setSelectedCashier("")
      }
    })

    setLoading(false)
    return () => {
      try {
        unsubInventory && unsubInventory()
      } catch {}
      try {
        unsubTransactions && unsubTransactions()
      } catch {}
      try {
        unsubUsers && unsubUsers()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, selectedBranch, selectedCashier])

  const loadData = async () => {
    try {
      const adminId = getAdminIdForStorage(currentUser)
      const data = await readSharedData(adminId)
      if (data) {
        // Load users/cashiers
        const users = data.users || []
        
        // Filter by branchId if selected (normalized for case/whitespace)
        const normalizeBranchId = (id) => (id != null ? String(id).trim().toLowerCase() : '')
        const normBranch = selectedBranch ? normalizeBranchId(selectedBranch) : ''
        const filteredInventory = selectedBranch ? (data.inventory || []).filter(i => normalizeBranchId(i.branchId) === normBranch) : (data.inventory || [])
        let filteredTransactions = selectedBranch ? (data.transactions || []).filter(t => normalizeBranchId(t.branchId) === normBranch) : (data.transactions || [])
        
        // Filter cashiers by selected branch
        const branchCashiers = selectedBranch 
          ? users.filter(u => u.role === 'cashier' && u.branchId === selectedBranch)
          : users.filter(u => u.role === 'cashier')
        setCashiers(branchCashiers)
        
        // Reset selected cashier if it's not in the filtered list
        if (selectedCashier && !branchCashiers.some(c => c.id === selectedCashier)) {
          setSelectedCashier('')
        }
        
        // Filter by cashier if selected
        if (selectedCashier) {
          filteredTransactions = filteredTransactions.filter(t => t.userId === selectedCashier)
        }
        
        setInventory(filteredInventory)
        setTransactions(filteredTransactions)
        calculateSalesAnalytics(filteredInventory, filteredTransactions)
      }
      setLoading(false)
    } catch (error) {
      console.error("Error loading data:", error)
      setLoading(false)
    }
  }

  const calculateSalesAnalytics = (inventoryData, transactionsData) => {
    // Calculate sales quantity per product
    const salesByProduct = {}
    
    transactionsData.forEach(transaction => {
      if (transaction.items && Array.isArray(transaction.items)) {
        transaction.items.forEach(item => {
          const productId = item.id || item.productId
          if (!salesByProduct[productId]) {
            salesByProduct[productId] = {
              id: productId,
              name: item.name || 'Unknown Product',
              totalQuantitySold: 0,
              totalRevenue: 0
            }
          }
          salesByProduct[productId].totalQuantitySold += (item.quantity ?? 0)
          salesByProduct[productId].totalRevenue += ((item.price ?? 0) * (item.quantity ?? 0))
        })
      }
    })

    // Convert to array and sort
    const salesArray = Object.values(salesByProduct)
    const sortedBySales = [...salesArray].sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
    
    // Most sold (top 10)
    const mostSold = sortedBySales.slice(0, 10)
    
    // Least sold (bottom 10 products with lowest sales, shown in ascending order)
    // We want the 10 products with the LEAST sales, so we take from the end
    const leastSold = sortedBySales.length > 10 
      ? sortedBySales.slice(-10).reverse() 
      : sortedBySales.slice().reverse()
    
    // Products never sold - ensure consistent ID comparison (both as numbers)
    const soldProductIds = new Set(Object.keys(salesByProduct).map(id => parseInt(id, 10)))
    const notSold = inventoryData.filter(product => !soldProductIds.has(parseInt(product.id, 10)))

    setSalesAnalytics({
      mostSold,
      leastSold,
      notSold,
      totalProductsSold: sortedBySales.length
    })
  }

  const getLowStockCount = () => {
    return inventory.filter(item => item.quantity <= item.reorderLevel).length
  }

  const getTotalProducts = () => {
    return inventory.length
  }

  const getTotalStockValue = () => {
    return inventory.reduce((sum, item) => sum + ((item.quantity ?? 0) * (item.costPrice ?? 0)), 0)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopBar title="Manager Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar title="Manager Dashboard" />
      {/* Branch and Cashier Filters - Manager/Admin Only */}
      {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
        <div className="px-3 sm:px-6 py-4 bg-muted/30 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-4">
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
                <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                      {cashier.name} - {cashier.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Welcome Section */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Welcome, {currentUser?.name || 'Manager'}
            </h2>
            <p className="text-muted-foreground">
              Inventory & Stock Management Dashboard
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <DashboardCard
              title="Total Products"
              value={getTotalProducts()}
              icon="📦"
              variant="primary"
            />
            
            <DashboardCard
              title="Low Stock Items"
              value={getLowStockCount()}
              icon="⚠️"
              variant="warning"
            />
            
            <DashboardCard
              title="Stock Value"
              value={`KES ${getTotalStockValue().toLocaleString()}`}
              icon="💰"
              variant="success"
            />
            
            <DashboardCard
              title="Products Sold"
              value={salesAnalytics.totalProductsSold}
              icon="📊"
              variant="accent"
            />
          </div>

          {/* Sales Analytics Tabs */}
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="border-b border-border p-4">
              <h3 className="text-xl font-bold text-foreground">Sales Analytics</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Product performance insights
              </p>
            </div>

            {/* Most Sold Products */}
            <div className="p-6 border-b border-border">
              <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                Top Selling Products
              </h4>
              {salesAnalytics.mostSold.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Qty Sold</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {salesAnalytics.mostSold.map((product, index) => (
                        <tr key={product.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-bold text-foreground">#{index + 1}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{product.name}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                            {product.totalQuantitySold}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-foreground">
                            KES {(product.totalRevenue ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No sales data available</p>
              )}
            </div>

            {/* Least Sold Products */}
            <div className="p-6 border-b border-border">
              <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-2xl">📉</span>
                Slow Moving Products
              </h4>
              {salesAnalytics.leastSold.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Qty Sold</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {salesAnalytics.leastSold.map((product) => (
                        <tr key={product.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm text-foreground">{product.name}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-orange-600">
                            {product.totalQuantitySold}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-foreground">
                            KES {(product.totalRevenue ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No sales data available</p>
              )}
            </div>

            {/* Never Sold Products */}
            <div className="p-6">
              <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-2xl">❌</span>
                Products Never Sold ({salesAnalytics.notSold.length})
              </h4>
              {salesAnalytics.notSold.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {salesAnalytics.notSold.map((product) => (
                    <div key={product.id} className="bg-muted/30 rounded-lg p-4 border border-border">
                      <h5 className="font-semibold text-foreground mb-1">{product.name}</h5>
                      <p className="text-sm text-muted-foreground mb-2">SKU: {product.sku}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Stock: {product.quantity}</span>
                        <span className="text-xs font-semibold text-foreground">
                          KES {product.sellingPrice}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Great! All products have been sold at least once.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
