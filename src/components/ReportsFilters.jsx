"use client"

import { useState } from "react"

export default function ReportsFilters({ onDateRangeChange, onPaymentMethodChange }) {
  const [dateRange, setDateRange] = useState("today")
  const [paymentMethod, setPaymentMethod] = useState("all")

  const handleDateRangeChange = (value) => {
    setDateRange(value)
    if (onDateRangeChange) onDateRangeChange(value)
  }

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value)
    if (onPaymentMethodChange) onPaymentMethodChange(value)
  }

  return (
    <div className="bg-card border-2 border-border rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-bold text-foreground mb-4">Report Filters</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Date Range</label>
          <select
            value={dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground font-medium"
          >
            <option value="today">📅 Today</option>
            <option value="week">📊 Last 7 Days</option>
            <option value="month">📈 Last 30 Days</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {dateRange === 'today' && 'Sales from start of today'}
            {dateRange === 'week' && 'Sales from last 7 days'}
            {dateRange === 'month' && 'Sales from last 30 days'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => handlePaymentMethodChange(e.target.value)}
            className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground font-medium"
          >
            <option value="all">💳 All Payment Methods</option>
            <option value="cash">💵 Cash Only</option>
            <option value="mpesa">📱 M-Pesa Only</option>
          </select>
        </div>
      </div>
    </div>
  )
}
