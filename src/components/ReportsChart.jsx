"use client"

import { PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#D4AF37', '#E5C158', '#8B1923', '#f59e0b', '#10b981']
const CHART_MIN_HEIGHT = 320

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  return (
    <div className="rounded-[8px] border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">KES {Number(value ?? 0).toLocaleString()}</p>
    </div>
  )
}

export default function ReportsChart({ title, type, data = [] }) {
  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center rounded-[12px] bg-muted/30 border border-dashed border-border"
          style={{ minHeight: CHART_MIN_HEIGHT, borderRadius: 'var(--radius-card, 12px)' }}
        >
          <p className="text-muted-foreground text-sm">No data for selected period</p>
          <p className="text-muted-foreground/70 text-xs mt-1">Change date range or branch to see data</p>
        </div>
      )
    }

    switch (type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'area':
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="date" className="text-muted-foreground text-xs" />
              <YAxis className="text-muted-foreground text-xs" tickFormatter={(v) => `KES ${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#D4AF37"
                strokeWidth={2}
                fill="url(#salesGradient)"
                name="Daily Sales (KES)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="category" className="text-muted-foreground text-xs" />
              <YAxis yAxisId="left" orientation="left" stroke="#D4AF37" />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="stock" fill="#D4AF37" name="Stock Units" />
              <Bar yAxisId="right" dataKey="value" fill="#10b981" name="Value (KES)" />
            </BarChart>
          </ResponsiveContainer>
        )

      default:
        return (
          <div className="flex items-center justify-center rounded-[12px] bg-muted/30" style={{ minHeight: CHART_MIN_HEIGHT }}>
            <p className="text-muted-foreground text-sm">Unsupported chart type</p>
          </div>
        )
    }
  }

  return (
    <div
      className="bg-card border border-border/50 rounded-[12px] p-6 shadow-sm min-h-[380px] flex flex-col"
      style={{ borderRadius: 'var(--radius-card, 12px)', padding: 'var(--spacing-section, 1.5rem)' }}
    >
      <h2 className="font-heading text-lg font-semibold text-foreground mb-4">
        {title}
      </h2>
      <div className="flex-1 min-h-0 rounded-[var(--radius-button)] overflow-hidden">
        {renderChart()}
      </div>
    </div>
  )
}
