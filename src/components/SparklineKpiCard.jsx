"use client"

import { useMemo, useId } from "react"
import { AreaChart, Area, ResponsiveContainer } from "recharts"

/**
 * KPI card with a mini sparkline for 24h trend.
 * data: array of { value: number } or { sales: number } (last 24 points, e.g. hourly).
 */
export default function SparklineKpiCard({ label, value, sparklineData = [], accent = "gold", loading = false }) {
  const gradientId = useId().replace(/:/g, "-")
  const chartData = useMemo(() => {
    if (!sparklineData || sparklineData.length === 0) return []
    return sparklineData.map((d, i) => ({
      index: i,
      v: d.value ?? d.sales ?? 0
    }))
  }, [sparklineData])

  // Accent colors with matching gradients
  const accentColors = {
    gold: { stroke: "#D4AF37", fillStart: "rgba(212,175,55,0.35)", fillEnd: "rgba(212,175,55,0.02)" },
    burgundy: { stroke: "#8B1923", fillStart: "rgba(139,25,35,0.35)", fillEnd: "rgba(139,25,35,0.02)" },
    green: { stroke: "#10b981", fillStart: "rgba(16,185,129,0.35)", fillEnd: "rgba(16,185,129,0.02)" }
  }
  const { stroke, fillStart, fillEnd } = accentColors[accent] || accentColors.gold

  if (loading) {
    return (
      <div
        className="rounded-xl p-6 border border-border/50 bg-card animate-pulse min-h-[130px]"
        style={{ borderRadius: "var(--radius-card, 12px)" }}
      />
    )
  }

  return (
    <div
      className="group rounded-xl p-5 border-2 border-border/40 bg-card shadow-md hover:shadow-lg hover:border-primary/25 transition-all duration-300 flex flex-col gap-4"
      style={{ borderRadius: "var(--radius-card, 12px)" }}
    >
      {/* Header: label + trend badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {chartData.length > 0 && (
          <span className="text-[10px] font-medium text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded-md">
            24h trend
          </span>
        )}
      </div>

      {/* Value — prominent */}
      <div className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground tabular-nums">
        {value}
      </div>

      {/* Sparkline — larger, with gradient fill */}
      {chartData.length > 0 && (
        <div className="h-14 w-full min-h-[56px] rounded-lg bg-muted/20 overflow-hidden border border-border/20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={fillStart} />
                  <stop offset="100%" stopColor={fillEnd} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={true}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
