/**
 * Sync Status Indicator
 * Shows online/offline status and Firebase sync progress
 */

"use client"

import { useState, useEffect } from "react"
import firebaseService from "../utils/firebaseService"

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingSync, setPendingSync] = useState(0)
  const [lastSync, setLastSync] = useState(null)
  const [syncType, setSyncType] = useState("local") // "local" or "firebase"

  // Test real network connectivity
  const checkRealConnectivity = async () => {
    // First check browser's navigator.onLine status
    if (!navigator.onLine) {
      return false
    }

    try {
      // Try to fetch from a reliable endpoint with cache busting
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)

      // Add timestamp to prevent browser caching of the request
      const response = await fetch(`https://www.google.com/favicon.ico?t=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store', // Prevent any caching
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return true
    } catch (error) {
      // Network error means offline
      return false
    }
  }

  useEffect(() => {
    // Initial connectivity check
    const initCheck = async () => {
      const online = await checkRealConnectivity()
      setIsOnline(online)
      console.log('🔍 Initial connectivity:', online ? 'ONLINE' : 'OFFLINE')
    }
    initCheck()

    // Listen to browser online/offline events
    const handleOnline = async () => {
      console.log('🟢 Browser says: ONLINE (verifying...)')
      const reallyOnline = await checkRealConnectivity()
      setIsOnline(reallyOnline)
      console.log('✓ Verified:', reallyOnline ? 'ONLINE' : 'OFFLINE')
    }

    const handleOffline = () => {
      console.log('🔴 Browser says: OFFLINE')
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Check real connectivity every 3 seconds for faster updates
    const connectivityCheck = setInterval(async () => {
      const online = await checkRealConnectivity()
      setIsOnline((prev) => {
        if (prev !== online) {
          console.log('🔄 Connectivity changed:', online ? 'ONLINE ✓' : 'OFFLINE ✗')
        }
        return online
      })
    }, 3000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(connectivityCheck)
    }
  }, [])

  // Check sync status periodically
  useEffect(() => {
    const checkSync = async () => {
      try {
        // Check Firebase sync status
        const firebaseStatus = firebaseService.getSyncStatus()
        if (firebaseStatus.activeListeners > 0) {
          setSyncType("firebase")
          setLastSync(new Date().toLocaleTimeString())
        }

        // Check if dataService is available for local sync
        if (typeof window !== "undefined" && window.dataService) {
          const status = await window.dataService.getSyncStatus()
          setPendingSync(status.pendingSync || 0)
          setIsSyncing(status.syncInProgress || false)
          
          if (status.pendingSync === 0 && syncType === "local") {
            setLastSync(status.lastSync || new Date().toLocaleTimeString())
          }
        }
      } catch (error) {
        console.error("Error checking sync:", error)
      }
    }

    checkSync()
    const interval = setInterval(checkSync, 5000)

    return () => clearInterval(interval)
  }, [syncType])

  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
      {/* Online/Offline Status */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg ${
          isOnline
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-white" : "bg-white animate-pulse"}`} />
        {isOnline ? "Online" : "Offline"}
      </div>

      {/* Firebase Sync Status */}
      {isOnline && syncType === "firebase" && (
        <div className="flex items-center gap-2 bg-purple-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          <svg
            className="h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M3.89 15.673L6.255.461A.542.542 0 017.27.288L9.813 5.06 3.89 15.673zm16.795 3.692L18.433 5.365a.543.543 0 00-.918-.295l-14.2 14.294 7.857 4.428a1.62 1.62 0 001.587 0l7.926-4.427zm-7.925.839L7.297 16.19l5.907-7.24 1.558 2.962-1.002 8.292z"/>
          </svg>
          <span>Firebase</span>
        </div>
      )}

      {/* Local Sync Status */}
      {isOnline && (isSyncing || pendingSync > 0) && syncType === "local" && (
        <div className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          {isSyncing ? (
            <>
              <svg
                className="animate-spin h-3 w-3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <span>⏳</span>
              <span>{pendingSync} pending</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
