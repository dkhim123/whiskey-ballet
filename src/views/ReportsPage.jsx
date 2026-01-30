"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import ReportsChart from "../components/ReportsChart"
import ReportsFilters from "../components/ReportsFilters"
import BranchSelector from "../components/BranchSelector"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToTransactions, subscribeToInventory } from "../services/realtimeListeners"
import { convertToCSV, downloadCSV } from "../utils/csvExport"

export default function ReportsPage({ currentUser }) {
  const [reportData, setReportData] = useState({
    paymentMethodData: [],
    dailySalesData: [],
    topProductsData: [],
    salesSummary: {
      totalSales: 0,
      totalTransactions: 0,
      averageTransaction: 0,
      cashSales: 0,
      mpesaSales: 0
    }
  })
  const [dateRange, setDateRange] = useState('today')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [productSortBy, setProductSortBy] = useState('revenue') // 'revenue' or 'quantity'
  const [selectedBranch, setSelectedBranch] = useState(currentUser?.role === 'admin' ? '' : currentUser?.branchId || '')

  useEffect(() => {
    if (!currentUser) return;
    const adminId = getAdminIdForStorage(currentUser);
    let unsubTransactions = null;
    let unsubInventory = null;
    let transactions = [];
    let inventory = [];
    const updateReport = () => {
      // Filter transactions by date range
      const now = new Date();
      let startDate = new Date();
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate.setHours(0, 0, 0, 0);
      }
      const filteredTransactions = transactions.filter(t => {
        const transDate = new Date(t.timestamp);
        // Only include completed transactions or transactions without status (backward compatibility)
        const dateMatch = transDate >= startDate && (t.paymentStatus === 'completed' || !t.paymentStatus);
        // Apply branch filter for cashiers or when admin selects a branch
        let branchMatch = true;
        if (currentUser.role === 'cashier') {
          branchMatch = t.branchId === currentUser.branchId;
        } else if (currentUser.role === 'admin' && selectedBranch) {
          branchMatch = t.branchId === selectedBranch;
        }
        // Apply payment method filter
        let paymentMatch = true;
        if (paymentMethod !== 'all') {
          paymentMatch = t.paymentMethod === paymentMethod;
        }
        return dateMatch && branchMatch && paymentMatch;
      });
      // ...existing code for report calculations...
      // Calculate sales summary
      const totalSales = filteredTransactions.reduce((sum, t) => sum + (t.total ?? 0), 0);
      const totalTransactions = filteredTransactions.length;
      const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
      const cashSales = filteredTransactions.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + (t.total ?? 0), 0);
      const mpesaSales = filteredTransactions.filter(t => t.paymentMethod === 'mpesa').reduce((sum, t) => sum + (t.total ?? 0), 0);
      // Calculate payment method distribution
      const paymentMethodMap = {};
      filteredTransactions.forEach(t => {
        const method = t.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash';
        paymentMethodMap[method] = (paymentMethodMap[method] || 0) + (t.total ?? 0);
      });
      const paymentMethodData = Object.entries(paymentMethodMap).map(([name, value]) => ({
        name,
        value: Math.round(value)
      }));
      // Calculate top selling products
      const productSalesMap = {};
      filteredTransactions.forEach(t => {
        t.items?.forEach(item => {
          const productName = item.name || 'Unknown Product';
          if (!productSalesMap[productName]) {
            productSalesMap[productName] = {
              quantity: 0,
              revenue: 0
            };
          }
          productSalesMap[productName].quantity += (item.quantity ?? 0);
          productSalesMap[productName].revenue += ((item.quantity ?? 0) * (item.price ?? 0));
        });
      });
      const topProductsData = Object.entries(productSalesMap)
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          revenue: Math.round(data.revenue)
        }))
        .sort((a, b) => b.revenue - a.revenue);
      // Calculate daily sales for last 7 days
      const dailySalesMap = {};
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayName = days[date.getDay()];
        dailySalesMap[dayName] = 0;
      }
      filteredTransactions.forEach(t => {
        const date = new Date(t.timestamp);
        if (date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
          const dayName = days[date.getDay()];
          dailySalesMap[dayName] += t.total;
        }
      });
      const dailySalesData = Object.entries(dailySalesMap).map(([date, sales]) => ({
        date,
        sales: Math.round(sales)
      }));
      setReportData({
        paymentMethodData,
        dailySalesData,
        topProductsData,
        salesSummary: {
          totalSales: Math.round(totalSales),
          totalTransactions,
          averageTransaction: Math.round(averageTransaction),
          cashSales: Math.round(cashSales),
          mpesaSales: Math.round(mpesaSales)
        }
      });
    };
    unsubTransactions = subscribeToTransactions(adminId, (data) => {
      transactions = data;
      updateReport();
    });
    unsubInventory = subscribeToInventory(adminId, (data) => {
      inventory = data;
      updateReport();
    });
    return () => {
      if (unsubTransactions) unsubTransactions();
      if (unsubInventory) unsubInventory();
    };
  }, [currentUser, dateRange, paymentMethod, productSortBy, selectedBranch]);
          
  // (Removed orphaned code: filtering and report calculation now handled in updateReport)

  // Export functions for reports
  const exportSalesReport = () => {
    const dateLabel = dateRange === 'today' ? 'Today' : 
                      dateRange === 'week' ? 'Last-7-Days' : 
                      'Last-30-Days'
    const paymentLabel = paymentMethod === 'all' ? 'All-Methods' :
                         paymentMethod === 'cash' ? 'Cash-Only' :
                         'MPesa-Only'
    
    const filename = `sales-report-${dateLabel}-${paymentLabel}-${new Date().toISOString().split('T')[0]}.csv`
    
    const reportSummary = [
      { metric: 'Total Sales', value: `KES ${reportData.salesSummary.totalSales.toLocaleString()}` },
      { metric: 'Total Transactions', value: reportData.salesSummary.totalTransactions },
      { metric: 'Average Transaction', value: `KES ${reportData.salesSummary.averageTransaction.toLocaleString()}` },
      { metric: 'Cash Sales', value: `KES ${reportData.salesSummary.cashSales.toLocaleString()}` },
      { metric: 'M-Pesa Sales', value: `KES ${reportData.salesSummary.mpesaSales.toLocaleString()}` },
    ]
    
    const headers = [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' }
    ]
    
    const csv = convertToCSV(reportSummary, headers)
    downloadCSV(csv, filename)
  }

  const exportTopProducts = () => {
    const dateLabel = dateRange === 'today' ? 'Today' : 
                      dateRange === 'week' ? 'Last-7-Days' : 
                      'Last-30-Days'
    const filename = `top-products-${dateLabel}-${new Date().toISOString().split('T')[0]}.csv`
    
    const headers = [
      { key: 'name', label: 'Product Name' },
      { key: 'quantity', label: 'Units Sold' },
      { key: 'revenue', label: 'Revenue (KES)' },
      { key: 'avgPrice', label: 'Avg Price per Unit (KES)' }
    ]
    
    const formattedData = reportData.topProductsData.map(product => ({
      name: product.name,
      quantity: product.quantity,
      revenue: product.revenue,
      avgPrice: product.quantity > 0 ? (product.revenue / product.quantity).toFixed(2) : '0.00'
    }))
    
    const csv = convertToCSV(formattedData, headers)
    downloadCSV(csv, filename)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar 
        title="Reports & Analytics" 
        subtitle="Sales trends and inventory insights"
        actions={[]}
      />

      <div className="p-6 flex-1 overflow-auto">
        <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex-1 w-full md:w-auto flex gap-4">
            <ReportsFilters onDateRangeChange={setDateRange} onPaymentMethodChange={setPaymentMethod} />
            {currentUser?.role === 'admin' && (
              <BranchSelector
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
                currentUser={currentUser}
              />
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={exportSalesReport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              title="Export Sales Summary Report"
            >
              <span>📊</span>
              <span>Export Summary</span>
            </button>
            <button
              onClick={exportTopProducts}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              title="Export Top Products Report"
            >
              <span>📦</span>
              <span>Export Products</span>
            </button>
          </div>
        </div>

        {/* Sales Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-linear-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg">
            <div className="text-sm opacity-90 mb-1">Total Sales</div>
            <div className="text-3xl font-bold">KES {(reportData.salesSummary.totalSales || 0).toLocaleString()}</div>
          </div>
          <div className="bg-linear-to-br from-green-500 to-green-600 text-white rounded-xl p-5 shadow-lg">
            <div className="text-sm opacity-90 mb-1">Transactions</div>
            <div className="text-3xl font-bold">{reportData.salesSummary.totalTransactions || 0}</div>
          </div>
          <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
            <div className="text-sm opacity-90 mb-1">Avg. Transaction</div>
            <div className="text-3xl font-bold">KES {(reportData.salesSummary.averageTransaction || 0).toLocaleString()}</div>
          </div>
          <div className="bg-linear-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-5 shadow-lg">
            <div className="text-sm opacity-90 mb-1">Cash Sales</div>
            <div className="text-3xl font-bold">KES {(reportData.salesSummary.cashSales || 0).toLocaleString()}</div>
          </div>
          <div className="bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-xl p-5 shadow-lg">
            <div className="text-sm opacity-90 mb-1">M-Pesa Sales</div>
            <div className="text-3xl font-bold">KES {(reportData.salesSummary.mpesaSales || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ReportsChart title="Sales by Payment Method" type="pie" data={reportData.paymentMethodData} />
          <ReportsChart title="Daily Sales Trend" type="line" data={reportData.dailySalesData} />
        </div>

        {/* Product Sales Ranking - Full Width */}
        <div className="bg-card border-2 border-border rounded-lg p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-2xl font-bold text-foreground">Product Sales Ranking</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Products ranked from highest to lowest by {productSortBy === 'revenue' ? 'revenue' : 'quantity sold'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setProductSortBy('revenue')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  productSortBy === 'revenue'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                By Revenue
              </button>
              <button
                onClick={() => setProductSortBy('quantity')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  productSortBy === 'quantity'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                By Quantity
              </button>
            </div>
          </div>
          
          {reportData.topProductsData.length > 0 ? (
            <div className="space-y-2">
              {reportData.topProductsData
                .sort((a, b) => productSortBy === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity)
                .map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-accent/30 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-primary text-primary-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground text-lg truncate">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.quantity} units sold
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-bold text-success text-lg">KES {(product.revenue || 0).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        KES {product.quantity > 0 ? ((product.revenue || 0) / product.quantity).toFixed(2) : '0.00'}/unit
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">No sales data available for the selected period</p>
          )}
        </div>
      </div>
    </div>
  )
}
