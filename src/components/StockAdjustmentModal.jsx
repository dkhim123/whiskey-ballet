"use client"

import { useState } from "react"
import { createUserSnapshot } from "../utils/userTracking"

const ADJUSTMENT_TYPES = [
  { value: "damaged", label: "Damaged", icon: "⚠️" },
  { value: "expired", label: "Expired", icon: "📅" },
  { value: "lost", label: "Lost/Stolen", icon: "❌" },
  { value: "returned", label: "Returned to Supplier", icon: "↩️" },
  { value: "found", label: "Found/Recovered", icon: "✅" },
  { value: "correction", label: "Manual Correction", icon: "🔧" },
]

export default function StockAdjustmentModal({ product, currentUser, onSave, onClose }) {
  const [formData, setFormData] = useState({
    adjustmentType: "damaged",
    quantity: 0,
    notes: "",
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === "quantity" ? Number.parseInt(value, 10) || 0 : value,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (formData.quantity === 0) {
      alert("Please enter a quantity")
      return
    }

    // For adjustments that decrease stock, make quantity negative
    const shouldDecrease = ["damaged", "expired", "lost", "returned"].includes(formData.adjustmentType)
    const adjustmentQuantity = shouldDecrease ? -Math.abs(formData.quantity) : Math.abs(formData.quantity)

    // Create adjustment record
    const adjustment = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      adjustmentType: formData.adjustmentType,
      quantity: adjustmentQuantity,
      previousStock: product.quantity,
      newStock: product.quantity + adjustmentQuantity,
      notes: formData.notes,
      timestamp: new Date().toISOString(),
      adjustedBy: createUserSnapshot(currentUser)
    }

    // Check if adjustment would result in negative stock
    if (adjustment.newStock < 0) {
      alert(`Cannot adjust stock. This would result in negative stock (${adjustment.newStock}). Current stock is ${product.quantity}.`)
      return
    }

    onSave(adjustment)
  }

  const selectedType = ADJUSTMENT_TYPES.find(t => t.value === formData.adjustmentType)
  const shouldDecrease = ["damaged", "expired", "lost", "returned"].includes(formData.adjustmentType)
  const adjustmentQuantity = shouldDecrease ? -Math.abs(formData.quantity) : Math.abs(formData.quantity)
  const newStock = product.quantity + adjustmentQuantity

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card rounded-lg shadow-2xl max-w-lg w-full p-6 border-2 border-border my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <h2 className="text-2xl font-bold text-foreground mb-2">Stock Adjustment</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Adjusting stock for: <span className="font-semibold text-foreground">{product.name}</span>
          <br />
          Current Stock: <span className="font-semibold text-primary">{product.quantity} units</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Adjustment Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ADJUSTMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, adjustmentType: type.value })}
                  className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                    formData.adjustmentType === type.value
                      ? "border-primary bg-primary/10 text-foreground font-semibold"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-sm">{type.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Quantity
              <span className="text-xs text-muted-foreground ml-1">
                (will {shouldDecrease ? "decrease" : "increase"} stock)
              </span>
            </label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              min="1"
              placeholder="Enter quantity"
              required
            />
          </div>

          {/* Stock Preview */}
          {formData.quantity > 0 && (
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Stock:</span>
                <span className="font-semibold text-foreground">{product.quantity}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Adjustment:</span>
                <span className={`font-semibold ${adjustmentQuantity < 0 ? 'text-destructive' : 'text-success'}`}>
                  {adjustmentQuantity > 0 ? '+' : ''}{adjustmentQuantity}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-border">
                <span className="text-foreground font-medium">New Stock:</span>
                <span className={`font-bold text-lg ${newStock < 0 ? 'text-destructive' : 'text-primary'}`}>
                  {newStock}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes (Optional)
              <span className="text-xs text-muted-foreground ml-1">(reason for adjustment)</span>
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground resize-none"
              rows="3"
              placeholder="e.g., Found expired items during inventory check"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors shadow-lg"
            >
              {selectedType?.icon} Apply Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
