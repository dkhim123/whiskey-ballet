"use client"

import { useState } from "react"

export default function MPesaModal({ total, onClose, onComplete }) {
  const [mpesaCode, setMpesaCode] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (mpesaCode.length >= 10) {
      setConfirmed(true)
      setTimeout(() => {
        onComplete()
      }, 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 dark:bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl max-w-md w-full p-6">
        {!confirmed ? (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-2">M-Pesa Payment</h2>
            <p className="text-muted-foreground mb-6">Enter M-Pesa confirmation code</p>

            <div className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-3xl font-bold text-primary">KES {total.toLocaleString()}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">M-Pesa Code</label>
                <input
                  type="text"
                  value={mpesaCode}
                  onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  placeholder="e.g., SYD123456XY"
                  maxLength="10"
                  className="w-full px-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-center text-lg tracking-widest placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-border text-foreground bg-muted/50 hover:bg-muted font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mpesaCode.length < 10}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-success-foreground text-2xl">✓</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Payment Confirmed</h3>
            <p className="text-muted-foreground">Processing transaction...</p>
          </div>
        )}
      </div>
    </div>
  )
}
