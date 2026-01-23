/**
 * PWA Update Prompt Component
 * Detects when a new version of the service worker is available
 * and prompts the user to update the app
 */

"use client"

import { useState, useEffect } from "react"
import { performDailyBackup } from "../utils/autoBackup"
import { readSharedData } from "../utils/storage"

// App configuration
const APP_NAME = "Whiskey Ballet POS"
const UPDATE_CHECK_INTERVAL = 30000 // 30 seconds (reduced from 60 for faster updates)
const DISMISS_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export default function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [registration, setRegistration] = useState(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    let interval = null
    let updateFoundHandler = null
    let controllerChangeHandler = null
    let visibilityChangeHandler = null
    let onlineHandler = null

    // Check for service worker updates
    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        
        if (!registration) {
          console.log("No service worker registered yet")
          return
        }

        setRegistration(registration)

        // Check if there's a waiting service worker
        if (registration.waiting) {
          console.log("New service worker is waiting")
          setShowPrompt(true)
        }

        // Listen for new service worker installing
        updateFoundHandler = () => {
          const newWorker = registration.installing
          console.log("New service worker found")

          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New service worker is installed and ready
              console.log("New service worker installed, showing prompt")
              setShowPrompt(true)
            }
          })
        }
        registration.addEventListener("updatefound", updateFoundHandler)

        // Listen for controller change (when new SW takes over)
        controllerChangeHandler = () => {
          console.log("Controller changed, reloading page")
          window.location.reload()
        }
        navigator.serviceWorker.addEventListener("controllerchange", controllerChangeHandler)

        // Check for updates when page becomes visible (user returns to app)
        visibilityChangeHandler = () => {
          if (document.visibilityState === "visible") {
            console.log("Page visible, checking for updates...")
            registration.update().catch((err) => {
              console.log("Update check failed:", err)
            })
          }
        }
        document.addEventListener("visibilitychange", visibilityChangeHandler)

        // Check for updates when network comes online
        onlineHandler = () => {
          console.log("Network online, checking for updates...")
          registration.update().catch((err) => {
            console.log("Update check failed:", err)
          })
        }
        window.addEventListener("online", onlineHandler)

        // Periodically check for updates (every 30 seconds)
        interval = setInterval(() => {
          registration.update().catch((err) => {
            console.log("Update check failed:", err)
          })
        }, UPDATE_CHECK_INTERVAL)
      } catch (error) {
        console.error("Error checking for updates:", error)
      }
    }

    checkForUpdates()
    
    // Cleanup function
    return () => {
      if (interval) {
        clearInterval(interval)
      }
      if (updateFoundHandler) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.removeEventListener("updatefound", updateFoundHandler)
        })
      }
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener("controllerchange", controllerChangeHandler)
      }
      if (visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", visibilityChangeHandler)
      }
      if (onlineHandler) {
        window.removeEventListener("online", onlineHandler)
      }
    }
  }, [])

  const handleUpdate = async () => {
    if (!registration?.waiting) {
      console.log("No waiting service worker")
      // If there's no waiting SW, it might have already activated
      // Try to reload to get the new version
      window.location.reload()
      return
    }

    setIsUpdating(true)

    try {
      // Create a backup before updating to prevent data loss
      console.log("Creating backup before update...")
      
      // Get current user from localStorage for backup
      const sessionStr = localStorage.getItem('user-session')
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr)
          const adminId = session.role === 'admin' ? session.id : session.adminId
          
          if (adminId) {
            // Read all data to backup
            const sharedData = await readSharedData(adminId)
            
            // Perform backup to IndexedDB - force backup by passing empty string for lastBackupDate
            // This ensures a backup is created even if one was already done today
            const backupResult = await performDailyBackup(sharedData, {
              lastBackupDate: '' // Empty string to force backup execution
            })
            
            if (backupResult.success) {
              console.log("✅ Pre-update backup created successfully")
              localStorage.setItem('last-update-backup', new Date().toISOString())
            } else {
              console.warn("⚠️ Backup before update failed, but continuing with update:", backupResult.message)
            }
          }
        } catch (parseError) {
          console.error("Error parsing user session:", parseError)
          // Continue with update even if session parsing fails
        }
      }
    } catch (error) {
      console.error("Error creating pre-update backup:", error)
      // Continue with update even if backup fails
    }

    // Tell the waiting service worker to skip waiting and become active
    registration.waiting.postMessage({ type: "SKIP_WAITING" })

    // The controllerchange event will trigger a reload
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Remember dismissal for this session
    sessionStorage.setItem("pwa-update-dismissed", Date.now().toString())
  }

  // Check dismissal on mount only
  useEffect(() => {
    const dismissed = sessionStorage.getItem("pwa-update-dismissed")
    if (dismissed) {
      const timeSince = Date.now() - parseInt(dismissed)
      // Hide if dismissed recently (within timeout period)
      if (timeSince < DISMISS_TIMEOUT) {
        setShowPrompt(false)
      } else {
        // Clear old dismissal if timeout has expired
        sessionStorage.removeItem("pwa-update-dismissed")
      }
    }
  }, []) // Run only on mount

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">Update Available</h3>
          <p className="text-sm text-white/90 mb-3">
            A new version of {APP_NAME} is available. Your data will be automatically backed up before updating to ensure nothing is lost.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <>
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 1 1-9-9" />
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  Update Now
                </>
              )}
            </button>

            <button
              onClick={handleDismiss}
              disabled={isUpdating}
              className="text-white/90 px-4 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Later
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          disabled={isUpdating}
          className="flex-shrink-0 text-white/70 hover:text-white p-1 disabled:opacity-50"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-white/20">
        <p className="text-xs text-white/80">
          ℹ️ Your data will be backed up automatically before the update. The app will reload after updating.
        </p>
      </div>
    </div>
  )
}
