"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import TopBar from "../components/TopBar"
import ReportsFilters from "../components/ReportsFilters"
import SparklineKpiCard from "../components/SparklineKpiCard"
import { getAdminIdForStorage } from "../utils/auth"
import { getTimestampMs } from "../utils/dateUtils"
import { subscribeToTransactions, subscribeToInventory } from "../services/realtimeListeners"
import { convertToCSV, downloadCSV } from "../utils/csvExport"

// Load chart (recharts) only on client to avoid ChunkLoadError with Turbopack
const ReportsChart = dynamic(() => import("../components/ReportsChart"), { ssr: false })
import BranchSelector from "../components/BranchSelector"

// Build 24h hourly buckets for sparklines (last 24 hours)
function build24hSparkline(filteredTransactions) {
  const now = Date.now()
  const oneHourMs = 60 * 60 * 1000
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const start = now - (24 - i) * oneHourMs
    const end = start + oneHourMs
    let total = 0
    let count = 0
    let cash = 0
    let mpesa = 0
    filteredTransactions.forEach((t) => {
      const ms = getTimestampMs(t.timestamp)
      if (Number.isNaN(ms) || ms < start || ms >= end) return
      total += t.total ?? 0
      count += 1
      if (t.paymentMethod === "cash") cash += t.total ?? 0
      if (t.paymentMethod === "mpesa") mpesa += t.total ?? 0
    })
    return { total, count, cash, mpesa, avg: count > 0 ? total / count : 0 }
  })
  return {
    totalSales: buckets.map((b) => ({ value: b.total })),
    transactions: buckets.map((b) => ({ value: b.count })),
    average: buckets.map((b) => ({ value: Math.round(b.avg) })),
    cashSales: buckets.map((b) => ({ value: b.cash })),
    mpesaSales: buckets.map((b) => ({ value: b.mpesa })),
  }
}

export default function ReportsPage({ currentUser }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
  const [selectedBranch, setSelectedBranch] = useState(() => {
    if (typeof window === 'undefined') return currentUser?.role === 'admin' ? '' : (currentUser?.branchId || '')
    try {
      return currentUser?.role === 'admin'
        ? (localStorage.getItem('adminSelectedBranch') || '')
        : (currentUser?.branchId || '')
    } catch {
      return currentUser?.role === 'admin' ? '' : (currentUser?.branchId || '')
    }
  })

  useEffect(() => {
    if (!currentUser) return;
    const adminId = getAdminIdForStorage(currentUser);
    let unsubTransactions = null;
    let unsubInventory = null;
    let transactions = [];
    let inventory = [];
    const updateReport = () => {
      // Filter transactions by date range (same logic as AccountabilityModal: current month = this month)
      const now = new Date();
      let startDate;
      switch (dateRange) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          break;
        default:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
      }
      const filteredTransactions = transactions.filter(t => {
        const transMs = getTimestampMs(t.timestamp);
        // Only include completed transactions or transactions without status (backward compatibility)
        const dateMatch = !Number.isNaN(transMs) && transMs >= startDate.getTime() && (t.paymentStatus === 'completed' || !t.paymentStatus);
        // Branch filter: admin by selectedBranch, manager/cashier by their branch
        let branchMatch = true;
        if (currentUser.role === 'cashier') {
          branchMatch = !currentUser.branchId || t.branchId === currentUser.branchId;
        } else if (currentUser.role === 'manager') {
          branchMatch = !currentUser.branchId || t.branchId === currentUser.branchId;
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
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      filteredTransactions.forEach(t => {
        const transMs = getTimestampMs(t.timestamp);
        if (!Number.isNaN(transMs) && transMs >= sevenDaysAgo) {
          const dayName = days[new Date(transMs).getDay()];
          dailySalesMap[dayName] = (dailySalesMap[dayName] || 0) + (t.total ?? 0);
        }
      });
      const dailySalesData = Object.entries(dailySalesMap).map(([date, sales]) => ({
        date,
        sales: Math.round(sales),
      }))
      const last24h = filteredTransactions.filter((t) => {
        const ms = getTimestampMs(t.timestamp)
        return !Number.isNaN(ms) && ms >= Date.now() - 24 * 60 * 60 * 1000
      })
      const sparkline24h = build24hSparkline(last24h)
      setReportData({
        paymentMethodData,
        dailySalesData,
        topProductsData,
        sparkline24h,
        salesSummary: {
          totalSales: Math.round(totalSales),
          totalTransactions,
          averageTransaction: Math.round(averageTransaction),
          cashSales: Math.round(cashSales),
          mpesaSales: Math.round(mpesaSales),
        },
      })
      setLoading(false)
      setError(null)
    }
    unsubTransactions = subscribeToTransactions(adminId, (data) => {
      transactions = data || []
      updateReport()
    }, (err) => {
      setError(err?.message || "Failed to load transactions")
      setLoading(false)
    })
    unsubInventory = subscribeToInventory(adminId, (data) => {
      inventory = data
      updateReport()
    }, (err) => {
      setError(err?.message || "Failed to load inventory")
    })
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
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        title="Reports & Analytics"
        subtitle="Sales trends and inventory insights"
        actions={[]}
      />

      <div className="p-6 flex-1 overflow-auto bg-background">
        {/* Filters + Branch + Export — single row card */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
            <div className="min-w-[280px]">
              <ReportsFilters
                dateRange={dateRange}
                paymentMethod={paymentMethod}
                onDateRangeChange={setDateRange}
                onPaymentMethodChange={setPaymentMethod}
              />
            </div>
            {currentUser?.role === "admin" && (
              <div className="flex items-center gap-3 flex-wrap">
                <BranchSelector
                  selectedBranch={selectedBranch}
                  onBranchChange={(branchId) => {
                    setSelectedBranch(branchId);
                    try {
                      localStorage.setItem("adminSelectedBranch", branchId || "");
                    } catch {}
                  }}
                  currentUser={currentUser}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={exportSalesReport}
              className="px-4 py-2.5 rounded-xl font-semibold text-white bg-[var(--color-success)] hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
              title="Export Sales Summary Report"
            >
              <span aria-hidden>📊</span>
              <span>Export Summary</span>
            </button>
            <button
              onClick={exportTopProducts}
              className="px-4 py-2.5 rounded-xl font-semibold text-white bg-[var(--color-burgundy)] hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
              title="Export Top Products Report"
            >
              <span aria-hidden>📦</span>
              <span>Export Products</span>
            </button>
          </div>
        </div>

        {/* Summary cards — brand-aligned, clear hierarchy */}
        {error && (
          <div className="mb-6 rounded-[12px] border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <SparklineKpiCard key={i} label="" value="—" loading />
            ))}
          </section>
        ) : null}

        {!loading && (
          <section className="mb-8" aria-label="Sales summary">
            <h2 className="sr-only">Sales summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <SparklineKpiCard
                label="Total Sales"
                value={`KES ${(reportData.salesSummary.totalSales || 0).toLocaleString()}`}
                sparklineData={reportData.sparkline24h?.totalSales || []}
                accent="gold"
              />
              <SparklineKpiCard
                label="Transactions"
                value={String(reportData.salesSummary.totalTransactions ?? 0)}
                sparklineData={reportData.sparkline24h?.transactions || []}
                accent="burgundy"
              />
              <SparklineKpiCard
                label="Avg. Transaction"
                value={`KES ${(reportData.salesSummary.averageTransaction || 0).toLocaleString()}`}
                sparklineData={reportData.sparkline24h?.average || []}
                accent="gold"
              />
              <SparklineKpiCard
                label="Cash Sales"
                value={`KES ${(reportData.salesSummary.cashSales || 0).toLocaleString()}`}
                sparklineData={reportData.sparkline24h?.cashSales || []}
                accent="green"
              />
              <SparklineKpiCard
                label="M-Pesa Sales"
                value={`KES ${(reportData.salesSummary.mpesaSales || 0).toLocaleString()}`}
                sparklineData={reportData.sparkline24h?.mpesaSales || []}
                accent="green"
              />
            </div>
          </section>
        )}

        {/* Charts — fixed height so layout doesn’t collapse when empty */}
        <section className="mb-8" aria-label="Charts">
          <h2 className="sr-only">Charts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportsChart title="Sales by Payment Method" type="pie" data={reportData.paymentMethodData} />
            <ReportsChart title="Daily Sales Trend" type="area" data={reportData.dailySalesData} />
          </div>
        </section>

        {/* Product ranking — full width card */}
        <section className="bg-[var(--color-card-bg)] border border-[var(--color-border)]/40 rounded-xl p-6 shadow-lg" aria-label="Product sales ranking">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Product sales ranking</h3>
              <p className="text-sm text-[var(--color-text-primary)]/70 mt-1">
                Ranked by {productSortBy === "revenue" ? "revenue" : "quantity sold"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setProductSortBy("revenue")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  productSortBy === "revenue"
                    ? "bg-[var(--color-gold)] text-[var(--color-dark-brown)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)]/40 hover:border-[var(--color-gold)]/50"
                }`}
              >
                By revenue
              </button>
              <button
                onClick={() => setProductSortBy("quantity")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  productSortBy === "quantity"
                    ? "bg-[var(--color-gold)] text-[var(--color-dark-brown)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)]/40 hover:border-[var(--color-gold)]/50"
                }`}
              >
                By quantity
              </button>
            </div>
          </div>

          {reportData.topProductsData.length > 0 ? (
            <div className="space-y-3">
              {reportData.topProductsData
                .sort((a, b) =>
                  productSortBy === "revenue" ? b.revenue - a.revenue : b.quantity - a.quantity
                )
                .map((product, index) => (
                  <div
                    key={`${product.name}-${index}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)]/20 hover:border-[var(--color-gold)]/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                          index === 0
                            ? "bg-[var(--color-gold)] text-[var(--color-dark-brown)]"
                            : index === 1
                            ? "bg-[var(--color-text-primary)]/30 text-[var(--color-text-primary)]"
                            : index === 2
                            ? "bg-[var(--color-burgundy)]/80 text-[var(--color-cream)]"
                            : "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[var(--color-text-primary)] truncate">
                          {product.name}
                        </div>
                        <div className="text-sm text-[var(--color-text-primary)]/70">
                          {product.quantity} units sold
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <div className="font-bold text-[var(--color-gold-light)]">
                        KES {(product.revenue || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-[var(--color-text-primary)]/60">
                        KES{" "}
                        {product.quantity > 0
                          ? ((product.revenue || 0) / product.quantity).toFixed(2)
                          : "0.00"}{" "}
                        /unit
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-14 rounded-[12px] bg-muted/30 border border-dashed border-border">
              <p className="text-muted-foreground">No sales data for the selected period.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
