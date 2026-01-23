"use client"

import { useState, useEffect, useRef } from "react"
import { X, Camera, AlertCircle } from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import firebaseService from "../utils/firebaseService"
import { QR_TYPE, QR_TYPE_OLD } from "../constants/qrTypes"

export default function QRScannerModal({ onScanSuccess, onClose }) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState("")
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const scannerElementId = useRef(`qr-reader-${Date.now()}`).current // Unique ID per instance

  // Get available cameras
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        // Request camera permission explicitly
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        // Stop the stream immediately as we only wanted to check permission
        stream.getTracks().forEach(track => track.stop())
        
        // Now get available cameras
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (devices && devices.length > 0) {
              setCameras(devices)
              // Prefer back camera on mobile
              const backCamera = devices.find((d) => d.label.toLowerCase().includes("back"))
              setSelectedCamera(backCamera?.id || devices[0].id)
            } else {
              setError("No cameras found. Please check camera permissions.")
            }
          })
          .catch((err) => {
            console.error("Error getting cameras:", err)
            setError("Unable to access camera. Please check permissions.")
          })
      } catch (err) {
        console.error("Camera permission denied:", err)
        if (err.name === 'NotAllowedError') {
          setError("Camera permission denied. Please allow camera access and try again.")
        } else if (err.name === 'NotFoundError') {
          setError("No camera found on this device.")
        } else {
          setError("Unable to access camera. Please check permissions in your browser settings.")
        }
      }
    }
    
    requestCameraPermission()
  }, [])

  // Start scanning when camera is selected
  useEffect(() => {
    if (selectedCamera && !isScanning) {
      startScanning()
    }

    return () => {
      stopScanning()
    }
  }, [selectedCamera])

  const startScanning = async () => {
    try {
      setIsScanning(true)
      setError("")

      const html5QrCode = new Html5Qrcode(scannerElementId)
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        selectedCamera,
        {
          fps: 15, // Increased from 10 for faster scanning
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleQRCodeScanned,
        handleScanFailure
      )
    } catch (err) {
      console.error("Error starting scanner:", err)
      setError("Failed to start camera. Please try again.")
      setIsScanning(false)
    }
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
      } catch (err) {
        console.error("Error stopping scanner:", err)
      }
    }
    setIsScanning(false)
  }

  const handleQRCodeScanned = async (decodedText) => {
    console.log("QR Code scanned:", decodedText)

    try {
      // Stop scanning immediately
      await stopScanning()

      // Parse QR code data
      const qrData = JSON.parse(decodedText)

      // Handle both old and new formats
      let linkId, shopId, type

      // New shortened format
      if (qrData.l && qrData.s) {
        linkId = qrData.l
        shopId = qrData.s
        type = qrData.t ?? QR_TYPE
      }
      // Old format (backward compatibility)
      else if (qrData.linkId && qrData.shopId) {
        linkId = qrData.linkId
        shopId = qrData.shopId
        type = qrData.type
      } else {
        setError("This QR code is not a valid shop link. Please scan the QR code from the admin settings page.")
        return
      }

      // Validate type
      if (type !== QR_TYPE && type !== QR_TYPE_OLD) {
        setError("This QR code is not a shop link. Please scan the QR code from the admin settings page.")
        return
      }

      // Shop link verification (offline mode)
      console.log("Processing shop link...")
      const result = { success: false, error: "Shop link sync requires cloud setup" }

      if (!result.success) {
        // Provide specific error messages based on the error type
        let errorMessage = result.error || "Failed to verify QR code."
        
        if (result.error === "Invalid link") {
          errorMessage = "This QR code is invalid or has been deleted. Please generate a new QR code."
        } else if (result.error === "Link has expired") {
          errorMessage = "This QR code has expired (valid for 10 minutes). Please generate a new QR code."
        } else if (result.error === "Link already used") {
          errorMessage = "This QR code has already been used. QR codes can only be used once for security. Please generate a new QR code."
        }
        
        console.log("QR verification failed:", errorMessage)
        setError(errorMessage)
        return
      }

      console.log("✅ QR code verified successfully")
      // Success! Call parent callback with user data
      onScanSuccess(result.linkData)
    } catch (err) {
      console.error("Error processing QR code:", err)
      if (err instanceof SyntaxError) {
        setError("This QR code is not in the correct format. Please scan a shop link QR code from the admin settings page.")
      } else {
        setError("Unable to process QR code. Please check your internet connection and try again.")
      }
    }
  }

  const handleScanFailure = (error) => {
    // Ignore scan failures - they happen continuously while scanning
    // Only log actual errors
    if (!error.includes("NotFoundException")) {
      console.log("Scan error:", error)
    }
  }

  const handleCameraChange = async (e) => {
    await stopScanning()
    setSelectedCamera(e.target.value)
  }

  const handleClose = async () => {
    await stopScanning()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 border border-border">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Scan QR Code</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium">What to do:</p>
                    <ol className="text-sm list-decimal list-inside space-y-1 ml-2">
                      <li>Ask the administrator to generate a new QR code</li>
                      <li>Scan the new QR code immediately (within 10 minutes)</li>
                      <li>Each QR code can only be used once</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => {
                      setError("")
                      if (selectedCamera) startScanning()
                    }}
                    className="mt-3 text-sm underline hover:no-underline font-medium"
                  >
                    Try scanning again
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Camera Selector */}
          {cameras.length > 1 && (
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Select Camera:
              </label>
              <select
                value={selectedCamera}
                onChange={handleCameraChange}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              >
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* QR Scanner */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <div id={scannerElementId} className="w-full" />
            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white text-sm">Initializing camera...</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">Instructions:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Position the QR code within the frame</li>
              <li>Hold steady until the code is scanned</li>
              <li>You'll be logged in automatically</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            🔒 Your camera is only used for scanning. No images are stored.
          </p>
        </div>
      </div>
    </div>
  )
}
