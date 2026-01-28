"use client"

import { useState, useEffect, useRef } from "react"
import EditIcon from "./icons/EditIcon"
import BarcodeIcon from "./icons/BarcodeIcon"
import { getImageSrc } from "../utils/images"

// Debounce delay for resize event (in milliseconds)
// 250ms provides smooth UX while reducing unnecessary re-renders
const RESIZE_DEBOUNCE_DELAY = 250

export default function InventoryTable({ items, onEdit, onBarcode, onAdjust, branchId }) {
  const [isMobile, setIsMobile] = useState(false)
  const timeoutIdRef = useRef(null)

  // Filter items by branchId if provided
  const filteredItems = branchId ? (Array.isArray(items) ? items.filter(i => i.branchId === branchId) : []) : (Array.isArray(items) ? items : [])

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") {
      return
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    
    // Debounce resize event to improve performance
    const debouncedCheckMobile = () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
      timeoutIdRef.current = setTimeout(checkMobile, RESIZE_DEBOUNCE_DELAY)
    }
    
    window.addEventListener('resize', debouncedCheckMobile)
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
      window.removeEventListener('resize', debouncedCheckMobile)
    }
  }, [])

  // Helper to check if item is expiring soon (within 7 days)
  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0
  }

  // Helper to check if item is expired
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const today = new Date()
    return expiry < today
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const costPrice = item.costPrice || 0
          const sellingPrice = item.sellingPrice || item.price || 0
          const margin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice * 100) : 0

          return (
            <div key={item.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex gap-3 mb-3">
                <img 
                  src={getImageSrc(item.image || "/diverse-products-still-life.png")}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-lg border border-border/50"
                  onError={(e) => {
                    e.target.src = getImageSrc("/placeholder.svg")
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100/80 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full font-semibold text-xs">
                    {item.category || "Other"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Stock</p>
                  <p className={`text-sm font-semibold ${item.quantity <= item.reorderLevel ? "text-destructive" : "text-success"}`}>
                    {item.quantity} / {item.reorderLevel}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Price</p>
                  <p className="text-sm font-semibold text-primary">
                    KES {sellingPrice.toLocaleString()}
                  </p>
                </div>
                {item.expiryDate && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Expiry</p>
                    <p className={`text-sm font-medium ${
                      isExpired(item.expiryDate) ? 'text-destructive' :
                      isExpiringSoon(item.expiryDate) ? 'text-yellow-600 dark:text-yellow-500' :
                      'text-foreground'
                    }`}>
                      {new Date(item.expiryDate).toLocaleDateString()}
                      {isExpired(item.expiryDate) && <span className="text-xs ml-2">Expired</span>}
                      {!isExpired(item.expiryDate) && isExpiringSoon(item.expiryDate) && <span className="text-xs ml-2">Expiring Soon</span>}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-border/30">
                <button
                  onClick={() => onEdit(item)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium text-sm"
                >
                  <EditIcon className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => onBarcode(item)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium text-sm"
                >
                  <BarcodeIcon className="w-4 h-4" />
                  Barcode
                </button>
                {onAdjust && (
                  <button
                    onClick={() => onAdjust(item)}
                    className="px-3 py-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/30 transition-colors text-sm"
                    title="Stock adjustment"
                  >
                    🔧
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Desktop Table View
  return (
    <div className="bg-card rounded-xl overflow-hidden overflow-x-auto" style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
      <table className="w-full">
        <thead className="bg-muted/30 border-b border-border/50">
          <tr>
            <th className="px-6 py-4 text-left text-sm font-bold text-foreground">Product</th>
            <th className="px-6 py-4 text-left text-sm font-bold text-foreground">SKU</th>
            <th className="px-6 py-4 text-left text-sm font-bold text-foreground">Category</th>
            <th className="px-6 py-4 text-center text-sm font-bold text-foreground">Stock</th>
            <th className="px-6 py-4 text-center text-sm font-bold text-foreground">Expiry</th>
            <th className="px-6 py-4 text-right text-sm font-bold text-foreground">Cost</th>
            <th className="px-6 py-4 text-right text-sm font-bold text-foreground">Selling</th>
            <th className="px-6 py-4 text-right text-sm font-bold text-foreground">Margin</th>
            <th className="px-6 py-4 text-center text-sm font-bold text-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item, idx) => {
            const costPrice = item.costPrice || 0
            const sellingPrice = item.sellingPrice || item.price || 0
            const margin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice * 100) : 0
            
            return (
              <tr key={item.id} className="border-b border-border/30 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all duration-200">
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-3">
                    <img 
                      src={getImageSrc(item.image || "/diverse-products-still-life.png")}
                      alt={item.name}
                      className="w-10 h-10 object-cover rounded-lg border border-border/50"
                      onError={(e) => {
                        e.target.src = getImageSrc("/placeholder.svg")
                      }}
                    />
                    <div>
                      <div className="font-medium text-foreground">{item.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{item.sku}</td>
                <td className="px-6 py-4 text-sm text-center">
                  <span className="inline-block px-3 py-1 bg-green-100/80 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full font-semibold text-xs">
                    {item.category || "Other"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div
                    className={`text-center font-semibold ${item.quantity <= item.reorderLevel ? "text-destructive" : "text-success"}`}
                  >
                    {item.quantity}
                    <div className="text-xs text-muted-foreground font-normal">/ {item.reorderLevel}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  {item.expiryDate ? (
                    <div>
                      <div className={`font-medium ${
                        isExpired(item.expiryDate) ? 'text-destructive' :
                        isExpiringSoon(item.expiryDate) ? 'text-yellow-600 dark:text-yellow-500' :
                        'text-foreground'
                      }`}>
                        {new Date(item.expiryDate).toLocaleDateString()}
                      </div>
                      {isExpired(item.expiryDate) && (
                        <div className="text-xs text-destructive font-semibold">Expired</div>
                      )}
                      {!isExpired(item.expiryDate) && isExpiringSoon(item.expiryDate) && (
                        <div className="text-xs text-yellow-600 dark:text-yellow-500 font-semibold">Expiring Soon</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-sm text-muted-foreground">
                  {costPrice > 0 ? `KES ${costPrice.toLocaleString()}` : "-"}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-primary">
                  KES {sellingPrice.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right text-sm">
                  {costPrice > 0 && sellingPrice > 0 ? (
                    <span className={`font-semibold ${margin > 0 ? 'text-success' : 'text-destructive'}`}>
                      {margin.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                      title="Edit product"
                    >
                      <EditIcon className="w-4 h-4 text-primary" />
                    </button>
                    <button onClick={() => onBarcode(item)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="View barcode">
                      <BarcodeIcon className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {onAdjust && (
                      <button
                        onClick={() => onAdjust(item)}
                        className="p-2 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                        title="Stock adjustment"
                      >
                        <span className="text-sm">🔧</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
