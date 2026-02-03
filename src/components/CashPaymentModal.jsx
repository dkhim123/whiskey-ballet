"use client"

import { useState, useEffect, useRef } from "react"
import { formatKES } from "../utils/pricing"

const AUTO_PROCEED_DELAY = 1000 // 1 second so receipt opens quickly

export default function CashPaymentModal({ total, onComplete, onClose }) {
  const [amountPaid, setAmountPaid] = useState("")
  const [showChange, setShowChange] = useState(false)
  const inputRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    // Auto-focus the input when modal opens
    if (inputRef.current) {
      inputRef.current.focus()
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Parse amount paid once to avoid redundant computation
  const parsedAmount = parseFloat(amountPaid) || 0
  
  // Calculate change (Note: Uses floating-point arithmetic which may have precision issues
  // with decimal places, e.g., 10.1 - 10.05 = 0.049999999999999. For production,
  // consider using a decimal library like decimal.js or integer arithmetic in cents)
  const change = parsedAmount - total
  const isValidPayment = parsedAmount >= total

  const handleComplete = () => {
    if (isValidPayment) {
      setShowChange(true)
      // Auto-proceed after showing change
      timeoutRef.current = setTimeout(() => {
        onComplete('cash')
      }, AUTO_PROCEED_DELAY)
    }
  }

  const handleProceedNow = () => {
    if (isValidPayment) {
      // Clear the auto-proceed timeout to prevent duplicate calls
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      onComplete('cash')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && isValidPayment) {
      handleComplete()
    }
  }

  const quickAmounts = [
    { label: "Exact", value: total },
    { label: "1000", value: 1000 },
    { label: "2000", value: 2000 },
    { label: "5000", value: 5000 },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-md w-full border-2 border-border relative max-h-[90vh] overflow-y-auto">
        {!showChange ? (
          <>
            {/* Header */}
            <div className="sticky top-0 p-6 border-b-2 border-border bg-gradient-to-r from-green-600 to-green-500 z-10">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                title="Close"
              >
                <span className="text-xl font-bold">×</span>
              </button>
              <h2 className="text-2xl font-bold text-white text-center">💵 Cash Payment</h2>
              <p className="text-sm text-white/90 text-center mt-1">Enter amount received from customer</p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Total Amount */}
              <div className="bg-muted/50 border-2 border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-foreground">{formatKES(total)}</p>
              </div>

              {/* Amount Paid Input */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Amount Paid by Customer
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                    KES
                  </span>
                  <input
                    ref={inputRef}
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="0"
                    aria-label="Amount paid by customer"
                    aria-describedby="amount-paid-help"
                    className="w-full pl-20 pr-4 py-4 text-3xl font-bold border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground text-right"
                    min="0"
                    step="0.01"
                  />
                </div>
                <p id="amount-paid-help" className="sr-only">Enter the amount of cash received from the customer</p>
                {amountPaid && !isValidPayment && (
                  <p className="text-sm text-destructive mt-2 font-semibold">
                    ⚠️ Amount is less than total. Customer owes {formatKES(total - parsedAmount)}
                  </p>
                )}
              </div>

              {/* Quick Amount Buttons */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Quick Select:</p>
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount.label}
                      onClick={() => setAmountPaid(amount.value.toString())}
                      className="px-3 py-2 bg-muted hover:bg-primary/10 text-foreground font-semibold rounded-lg transition-colors text-sm border border-border hover:border-primary"
                    >
                      {amount.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Change */}
              {amountPaid && isValidPayment && (
                <div className="bg-green-50 dark:bg-green-950/30 border-2 border-green-500 rounded-lg p-4 animate-in fade-in">
                  <p className="text-sm text-green-700 dark:text-green-300 mb-1 font-medium">Change to Give</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatKES(change)}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t-2 border-border bg-muted/30">
              <button
                onClick={handleComplete}
                disabled={!isValidPayment}
                className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg disabled:cursor-not-allowed text-lg"
              >
                {isValidPayment ? "Complete Payment ✓" : "Enter Amount Paid"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Change Display */}
            <div className="sticky top-0 p-4 bg-card z-10 flex justify-end border-b border-border">
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted hover:bg-destructive/20 text-foreground hover:text-destructive transition-colors"
                title="Close"
              >
                <span className="text-xl font-bold">×</span>
              </button>
            </div>
            <div className="p-8 space-y-6 text-center">
              <div className="text-6xl mb-4">💰</div>
              <h2 className="text-2xl font-bold text-foreground">Change to Give</h2>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border-4 border-green-500 rounded-2xl p-8">
                <p className="text-sm text-muted-foreground mb-2">Customer Change</p>
                <p className="text-6xl font-black text-green-600 dark:text-green-400 mb-4">
                  {formatKES(change)}
                </p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Amount Paid: <span className="font-bold text-foreground">{formatKES(parsedAmount)}</span></p>
                  <p>Total Amount: <span className="font-bold text-foreground">{formatKES(total)}</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleProceedNow}
                  className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all shadow-lg text-lg"
                >
                  Continue to Receipt ✓
                </button>
                <p className="text-xs text-muted-foreground">
                  Auto-proceeding to receipt in 1 second…
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
