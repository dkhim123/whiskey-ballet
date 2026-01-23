/**
 * PWA Install Prompt Component
 * Shows a button in settings to install the app (no auto-popup)
 */

"use client"

import { useState, useEffect } from "react"

export default function PWAInstallPrompt({ showButton = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") {
      return
    }

    // Check if already installed
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone

    setIsStandalone(isInstalled)

    if (isInstalled) {
      return
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Don't auto-show - user must click install button
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return
    }

    deferredPrompt.prompt()

    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      console.log("✅ PWA installed")
    } else {
      console.log("❌ PWA install dismissed")
    }

    setDeferredPrompt(null)
  }

  // Don't show anything if already installed to avoid UI clutter
  if (isStandalone) {
    return null
  }

  // Only show install button if explicitly requested
  if (!showButton) {
    return null
  }

  // Show message if install prompt is not available
  if (!deferredPrompt) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-lg">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="font-medium">Install option not available yet</p>
            <p className="text-sm mt-1">The app install prompt is not available in this browser or has already been used. Try:</p>
            <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Using Chrome, Edge, or Safari browser</li>
              <li>Adding to home screen from browser menu</li>
              <li>Refreshing the page if you just declined the install prompt</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold shadow-md hover:shadow-lg w-full"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Install App Now
    </button>
  )
}
