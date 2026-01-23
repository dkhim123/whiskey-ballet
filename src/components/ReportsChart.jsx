"use client"

import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function ReportsChart({ title, type, data = [] }) {
  const renderChart = () => {
    // Show empty state if no data
    if (!data || data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground">No data available for selected period</p>
        </div>
      )
    }

    switch (type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#00C49F" 
                strokeWidth={2}
                activeDot={{ r: 8 }}
                name="Daily Sales"
              />
            </LineChart>
          </ResponsiveContainer>
        )

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="stock" fill="#8884d8" name="Stock Units" />
              <Bar yAxisId="right" dataKey="value" fill="#82ca9d" name="Value (KES)" />
            </BarChart>
          </ResponsiveContainer>
        )

      default:
        return (
          <div className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">Unsupported chart type</p>
          </div>
        )
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-bold text-card-foreground mb-4">{title}</h2>
      <div className="rounded-lg">
        {renderChart()}
      </div>
    </div>
  )
}
