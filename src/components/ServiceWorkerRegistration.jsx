/**
 * Service Worker Registration
 * Handles registration and lifecycle of the PWA service worker
 * Includes aggressive update checking to ensure desktop PWA receives updates
 */

"use client"

import { useEffect } from "react"

// Configuration constants
const UPDATE_CHECK_INTERVAL = 30000 // 30 seconds (reduced from 60 for faster updates)
const FORCE_UPDATE_ON_FOCUS = true // Force update check when window gains focus

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only run in browser and in production
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV === "development"
    ) {
      return
    }

    let interval = null
    let isUpdating = false
    let handleFocus = null

    const registerServiceWorker = async () => {
      try {
        // ...existing code...
        
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none", // Always check for updates
        })

        // ...existing code...

        // Handle service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          // ...existing code...

          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // ...existing code...
                // New service worker available, reload to activate
                if (!isUpdating) {
                  isUpdating = true
                  window.location.reload()
                }
              }
            })
          }
        })

        // Check for updates immediately
        registration.update().catch(console.error)

        // Check for updates periodically
        interval = setInterval(() => {
          // ...existing code...
          registration.update().catch(console.error)
        }, UPDATE_CHECK_INTERVAL)

        // Force update check when window gains focus (for desktop PWA)
        if (FORCE_UPDATE_ON_FOCUS) {
          handleFocus = () => {
            // ...existing code...
            registration.update().catch(console.error)
          }
          window.addEventListener("focus", handleFocus)
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error)
      }
    }

    registerServiceWorker()
    
    // Cleanup function
    return () => {
      if (interval) {
        clearInterval(interval)
      }
      if (handleFocus) {
        window.removeEventListener("focus", handleFocus)
      }
    }
  }, [])

  return null
}
