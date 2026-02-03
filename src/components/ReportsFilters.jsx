"use client"

export default function ReportsFilters({
  dateRange = "today",
  paymentMethod = "all",
  onDateRangeChange,
  onPaymentMethodChange,
  className = "",
}) {
  return (
    <div
      className={`sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-[12px] border border-border/50 bg-card/95 backdrop-blur-sm px-4 py-3 ${className}`}
      style={{ borderRadius: "var(--radius-card, 12px)", padding: "var(--spacing-section, 1.5rem)" }}
    >
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">
        Filters
      </span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/80" aria-hidden title="Date range">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </span>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange?.(e.target.value)}
          className="rounded-[8px] border border-input bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[120px]"
          style={{ borderRadius: "var(--radius-button, 8px)" }}
          aria-label="Date range"
        >
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/80" aria-hidden title="Payment method">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </span>
        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange?.(e.target.value)}
          className="rounded-[8px] border border-input bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[120px]"
          style={{ borderRadius: "var(--radius-button, 8px)" }}
          aria-label="Payment method"
        >
          <option value="all">All methods</option>
          <option value="cash">Cash only</option>
          <option value="mpesa">M-Pesa only</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground ml-1">
        {dateRange === "today" && "Sales from start of today"}
        {dateRange === "week" && "Sales from last 7 days"}
        {dateRange === "month" && "Sales from last 30 days"}
      </p>
    </div>
  )
}
