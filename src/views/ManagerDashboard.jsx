"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import DashboardCard from "../components/DashboardCard"
import { readSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"

export default function ManagerDashboard({ currentUser }) {
  const [inventory, setInventory] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [salesAnalytics, setSalesAnalytics] = useState({
    mostSold: [],
    leastSold: [],
    notSold: [],
    totalProductsSold: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const adminId = getAdminIdForStorage(currentUser)
      const data = await readSharedData(adminId)
      if (data) {
        setInventory(data.inventory || [])
        setTransactions(data.transactions || [])
        calculateSalesAnalytics(data.inventory || [], data.transactions || [])
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
