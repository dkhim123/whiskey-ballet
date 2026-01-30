/**
 * Sync Status Indicator
 * Shows online/offline status and Firebase sync progress
 * Uses new syncManager for real-time status updates
 */

"use client"

import { useState, useEffect } from "react"
import syncManager from "../utils/syncManager"
import { isFirebaseConfigured } from "../config/firebase"

export default function SyncStatus() {
  const [status, setStatus] = useState({
    online: true,
    syncing: false,
    queueSize: 0,
    lastSync: null
  })

  useEffect(() => {
    // Get initial status
    const initialStatus = syncManager.getStatus()
    setStatus(initialStatus)

    // Subscribe to status updates
    const updateStatus = (newStatus) => {
      setStatus(prevStatus => ({
        ...prevStatus,
        ...newStatus,
        queueSize: syncManager.queue.length
      }))
    }

    syncManager.addListener(updateStatus)

    // Update queue size periodically
    const interval = setInterval(() => {
      const currentStatus = syncManager.getStatus()
      setStatus(prevStatus => ({
        ...prevStatus,
        queueSize: currentStatus.queueSize,
        lastSync: currentStatus.lastSync
      }))
    }, 2000)

    return () => {
      syncManager.removeListener(updateStatus)
      clearInterval(interval)
    }
  }, [])

  const firebaseConfigured = isFirebaseConfigured()

  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
      {/* Online/Offline Status */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg ${
          status.online
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
        }`}
        title={status.online ? "Connected to internet" : "No internet connection"}
      >
        <span className={`w-2 h-2 rounded-full ${status.online ? "bg-white" : "bg-white animate-pulse"}`} />
        {status.online ? "Online" : "Offline"}
      </div>

      {/* Firebase Status (when configured and online) */}
      {firebaseConfigured && status.online && (
        <div 
          className="flex items-center gap-2 bg-purple-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
          title="Firebase connected - Real-time sync enabled"
        >
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

      {/* Sync Status */}
      {status.syncing && (
        <div 
          className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
          title="Syncing offline changes to Firebase"
        >
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
        </div>
      )}

      {/* Pending Queue */}
      {!status.syncing && status.queueSize > 0 && (
        <div 
          className="flex items-center gap-2 bg-yellow-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
          title={`${status.queueSize} changes waiting to sync`}
        >
          <span>⏳</span>
          <span>{status.queueSize} pending</span>
        </div>
      )}

      {/* Last Sync Time */}
      {!status.syncing && status.queueSize === 0 && status.lastSync && (
        <div 
          className="flex items-center gap-2 bg-gray-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
          title={`Last synced at ${status.lastSync.toLocaleTimeString()}`}
        >
          <span>✓</span>
          <span>Synced</span>
        </div>
      )}
    </div>
  )
}
