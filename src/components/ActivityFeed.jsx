"use client"

import { useState, useEffect } from "react"
import { getActivities } from "../utils/activityLog"
import { formatRelativeTime } from "../utils/timeFormat"

export default function ActivityFeed({ currentUser, limit = 10 }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
  }, [currentUser])

  const loadActivities = async () => {
    if (!currentUser?.id) return
    
    setLoading(true)
    try {
      const result = await getActivities(currentUser.id, {}, limit)
      if (result.success) {
        setActivities(result.activities)
      }
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'user_created':
        return '👤'
      case 'user_deactivated':
        return '🗑️'
      case 'user_password_changed':
        return '🔑'
      case 'transaction_completed':
        return '💰'
      case 'stock_adjusted':
        return '📦'
      case 'product_added':
        return '➕'
      case 'product_updated':
        return '✏️'
      case 'expense_added':
        return '💸'
      case 'supplier_payment':
        return '🏦'
      default:
        return '📝'
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No recent activity</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] flex flex-col max-h-[600px]">
      <div className="p-6 pb-4 border-b border-border flex-shrink-0">
        <h3 className="text-lg font-bold text-foreground">Recent Activity</h3>
        <p className="text-xs text-muted-foreground mt-1">System-wide activities and changes</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 pt-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-all border border-border/50 hover:border-primary/50"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {activity.performedBy?.name || 'System'}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
