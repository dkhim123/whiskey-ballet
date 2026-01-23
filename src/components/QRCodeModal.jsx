"use client"

import { useState, useEffect, useRef } from "react"
import { X, Smartphone, RefreshCw } from "lucide-react"
import QRCode from "qrcode"
import { QR_TYPE } from "../constants/qrTypes"

// Timer constants (in seconds)
const QR_EXPIRY_SECONDS = 600 // 10 minutes
const QR_WARNING_THRESHOLD = 120 // 2 minutes - show warning below this

export default function QRCodeModal({ user, inventory = [], onClose }) {
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [linkData, setLinkData] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const [timeRemaining, setTimeRemaining] = useState(QR_EXPIRY_SECONDS)
  const generationStartedRef = useRef(false) // Prevent double generation

  const generateQRCode = async () => {
    // Prevent multiple simultaneous generations
    if (isGenerating) return
    
    setIsGenerating(true)
    setError("")

    try {
      // Generate offline-only QR code for shop info
      const linkId = `shop-${Date.now()}`
      
      // Create QR code data with shop info
      const qrData = JSON.stringify({
        l: linkId,
        s: user.id,
        t: QR_TYPE,
        name: user.name,
        offline: true
      })

      // Generate QR code image
      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 1,
        errorCorrectionLevel: 'L',
        type: 'image/png',
        quality: 0.85,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })

      setQrCodeUrl(qrUrl)
      setLinkData({ 
        linkId: linkId,
        shopId: user.id,
        shopName: user.name,
        createdAt: Date.now()
      })
      setTimeRemaining(QR_EXPIRY_SECONDS)
      
      console.log('✅ QR code generated (offline mode)')
      
    } catch (err) {
      console.error("Error generating QR code:", err)
      setError("Failed to generate QR code. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  // Generate QR code on mount (only once)
  useEffect(() => {
    // Prevent double generation in React StrictMode and concurrent renders
    if (generationStartedRef.current || isGenerating) return
    generationStartedRef.current = true
    
    generateQRCode()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleRegenerate = () => {
    // Reset the ref to allow regeneration
    generationStartedRef.current = false
    generateQRCode()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col border border-border my-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Link Your Phone</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-destructive/10 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-center">
              {error}
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8">
              <RefreshCw className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground mt-4">Generating QR code...</p>
            </div>
          ) : (
            <>
              {/* QR Code */}
              <div className="flex justify-center bg-white p-6 rounded-lg border-2 border-border">
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                )}
              </div>

              {/* Timer */}
              {timeRemaining > 0 ? (
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">QR code expires in:</p>
                  <p className={`text-2xl font-bold ${timeRemaining < 60 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
                    {formatTime(timeRemaining)}
                  </p>
                  {timeRemaining < QR_WARNING_THRESHOLD && (
                    <p className="text-xs text-destructive">⚠️ Less than 2 minutes remaining!</p>
                  )}
                </div>
              ) : (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-center">
                  <p className="font-medium">QR code has expired</p>
                  <button
                    onClick={handleRegenerate}
                    className="mt-2 text-sm underline hover:no-underline"
                  >
                    Generate new QR code
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium text-foreground">How to link your phone:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open the POS app on your phone</li>
                  <li>Tap "Scan QR Code" on the login page</li>
                  <li>Point your camera at this QR code</li>
                  <li>Your phone will automatically log in</li>
                </ol>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                    ⚠️ Important: This QR code can only be scanned once for security reasons. After a successful scan, you'll need to generate a new one.
                  </p>
                </div>
              </div>

              {/* Regenerate Button */}
              {timeRemaining > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={handleRegenerate}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Generate New QR Code
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            🔒 This QR code is valid for 10 minutes and can only be used once
          </p>
        </div>
      </div>
    </div>
  )
}
