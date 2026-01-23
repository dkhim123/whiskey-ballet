"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff } from "lucide-react"

export default function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 5000)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <>
      {/* Status indicator in top bar */}
      <div className="flex items-center gap-2" title={isOnline ? "Internet connected (informational only - app works offline)" : "No internet connection (app works offline)"}>
        {isOnline ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Wifi className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <WifiOff className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">Offline Mode</span>
          </div>
        )}
      </div>

      {/* Toast notification when status changes */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`${
            isOnline 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' 
              : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200'
          } border-2 rounded-lg p-4 shadow-lg max-w-sm`}>
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="w-6 h-6 flex-shrink-0" />
              ) : (
                <WifiOff className="w-6 h-6 flex-shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm">
                  {isOnline ? '✓ Internet Connected' : '📱 Offline Mode Active'}
                </p>
                <p className="text-xs mt-1">
                  {isOnline 
                    ? 'Your POS still works 100% offline - internet is optional!' 
                    : 'No worries! Your POS works perfectly offline. All features available!'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
