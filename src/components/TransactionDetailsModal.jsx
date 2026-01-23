"use client"

import { useState } from "react"
import { toast } from "sonner"

export default function TransactionDetailsModal({ transaction, onClose, onCancel, currentUser }) {
  const [isCancelling, setIsCancelling] = useState(false)

  if (!transaction) return null

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getPaymentMethodLabel = (method) => {
    switch(method) {
      case 'mpesa': return 'M-Pesa'
      case 'credit': return 'Credit'
      case 'cash': return 'Cash'
      default: return method || 'Cash'
    }
  }

  const handleCancelTransaction = async () => {
    if (!onCancel) {
      toast.error('Not Available', {
        description: 'Transaction cancellation is not available'
      })
      return
    }

    const transactionTotal = transaction.total ?? 0
    const transactionId = transaction.id || 'Unknown'
    
    const confirmMessage = `Are you sure you want to cancel this transaction?\n\nTransaction ID: ${transactionId}\nAmount: KES ${transactionTotal.toLocaleString()}\n\nThis will:\n- Reverse the inventory changes\n- Mark the transaction as cancelled\n- This action cannot be undone`
    
    if (!window.confirm(confirmMessage)) {
      return
    }

    setIsCancelling(true)
    try {
      await onCancel(transaction)
      // Close modal after successful cancellation
      onClose()
    } catch (error) {
      console.error('Error cancelling transaction:', error)
      toast.error('Cancellation Failed', {
        description: 'Failed to cancel transaction. Please try again.',
        duration: 5000
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const canCancel = currentUser?.role === 'admin' && transaction.paymentStatus !== 'cancelled'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-2xl w-full border-2 border-border relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-lg bg-muted/50 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          title="Close"
          aria-label="Close modal"
        >
          <span className="text-xl font-bold" aria-hidden="true">×</span>
        </button>
        
        <div className="p-6 border-b-2 border-border bg-primary/5 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-foreground">Transaction Details</h2>
            <div className="flex items-center gap-2">
              {transaction.paymentStatus === 'cancelled' && (
                <div className="px-3 py-1 rounded-full bg-destructive/20 border border-destructive">
                  <span className="text-sm font-semibold text-destructive">
                    CANCELLED
                  </span>
                </div>
              )}
              <div className="px-3 py-1 rounded-full bg-primary/20 border border-primary">
                <span className="text-sm font-semibold text-primary">
                  {getPaymentMethodLabel(transaction.paymentMethod)}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Transaction ID: <span className="font-mono font-semibold text-foreground">{transaction.id}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Date: <span className="font-semibold text-foreground">{formatDateTime(transaction.timestamp)}</span>
            </p>
            {transaction.cancelledAt && (
              <p className="text-sm text-destructive">
                Cancelled: <span className="font-semibold">{formatDateTime(transaction.cancelledAt)}</span> by {transaction.cancelledBy || 'Admin'}
              </p>
            )}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0" role="region" aria-label="Transaction details" tabIndex={0}>
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <span>🛒</span>
              <span>Items Purchased</span>
            </h3>
            <div className="space-y-2">
              {transaction.items && transaction.items.length > 0 ? (
                transaction.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start p-3 bg-muted/40 rounded-lg border border-border/50">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × KES {item.price.toLocaleString()}
                      </p>
                    </div>
                    <p className="font-bold text-foreground text-lg">
                      KES {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm italic">No item details available</p>
              )}
            </div>
          </div>

          <div className="border-t-2 border-border pt-4">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <span>💰</span>
              <span>Payment Summary</span>
            </h3>
            <div className="space-y-2 bg-muted/40 rounded-lg p-4 border border-border/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="text-foreground font-semibold">
                  KES {(transaction.subtotal ?? 0).toLocaleString()}
                </span>
              </div>
              {transaction.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount ({transaction.discount}%):</span>
                  <span className="text-destructive font-semibold">
                    - KES {(transaction.discountAmount ?? 0).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                <span className="text-foreground">Total Paid:</span>
                <span className="text-primary">KES {transaction.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="text-foreground font-semibold capitalize">
                  {getPaymentMethodLabel(transaction.paymentMethod)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="text-foreground font-semibold">
                  {transaction.itemCount || transaction.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t-2 border-border bg-muted/20 flex-shrink-0">
          <div className="flex gap-3">
            {canCancel && (
              <button
                onClick={handleCancelTransaction}
                disabled={isCancelling}
                className="flex-1 px-5 py-3 bg-destructive hover:bg-destructive/90 text-white font-bold rounded-lg transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Transaction'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
