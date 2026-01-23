"use client"

import { useState } from "react"

export default function StockCountModal({ inventory, onClose, onSave }) {
  const [countData, setCountData] = useState(
    inventory.map(item => ({
      ...item,
      countedQuantity: item.quantity,
      difference: 0,
      status: getStockStatus(item.quantity, item.reorderLevel)
    }))
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [barcodeInput, setBarcodeInput] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")

  function getStockStatus(quantity, reorderLevel) {
    if (quantity === 0) return "Out of Stock"
    if (quantity < reorderLevel) return "Low Stock"
    return "In Stock"
  }

  const handleCountChange = (productId, newCount) => {
    setCountData(countData.map(item => {
      if (item.id === productId) {
        const counted = parseInt(newCount) || 0
        return {
          ...item,
          countedQuantity: counted,
          difference: counted - item.quantity,
          status: getStockStatus(counted, item.reorderLevel)
        }
      }
      return item
    }))
  }

  const handleBarcodeSubmit = (e) => {
    e.preventDefault()
    if (!barcodeInput.trim()) return

    const product = countData.find(item => 
      item.barcode === barcodeInput || 
      item.sku.toLowerCase() === barcodeInput.toLowerCase()
    )

    if (product) {
      // Increment count for scanned product
      handleCountChange(product.id, product.countedQuantity + 1)
      setBarcodeInput("")
      
      // Scroll to product in list
      const element = document.getElementById(`product-${product.id}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('bg-primary/10')
        setTimeout(() => element.classList.remove('bg-primary/10'), 1000)
      }
    } else {
      alert(`Product not found with barcode/SKU: ${barcodeInput}`)
      setBarcodeInput("")
    }
  }

  const handleSaveCount = () => {
    const updatedInventory = countData.map(item => ({
      ...item,
      quantity: item.countedQuantity
    }))
    
    onSave(updatedInventory)
  }

  const filteredData = countData.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode?.includes(searchTerm)
    
    const matchesStatus = statusFilter === "All" || item.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const hasChanges = countData.some(item => item.difference !== 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">📋 Stock Count</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Count your inventory and update stock levels
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Barcode Scanner */}
          <form onSubmit={handleBarcodeSubmit} className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="🔍 Scan barcode or enter SKU..."
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                type="submit"
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
              >
                Add
              </button>
            </div>
          </form>

          {/* Search */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {statusFilter !== "All" && (
              <button
                onClick={() => setStatusFilter("All")}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-semibold transition-colors whitespace-nowrap"
                title="Clear filter"
              >
                Clear Filter ✕
              </button>
            )}
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-2">
            {filteredData.map((item) => (
              <div
                key={item.id}
                id={`product-${item.id}`}
                className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-border transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">{item.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      item.status === "Out of Stock" 
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : item.status === "Low Stock"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    SKU: {item.sku} • System: {item.quantity} units
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <label className="block text-xs text-muted-foreground mb-1">Counted</label>
                    <input
                      type="number"
                      value={item.countedQuantity}
                      onChange={(e) => handleCountChange(item.id, e.target.value)}
                      className="w-24 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary"
                      min="0"
                    />
                  </div>

                  {item.difference !== 0 && (
                    <div className={`text-sm font-semibold ${
                      item.difference > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {item.difference > 0 ? "+" : ""}{item.difference}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products found</p>
            </div>
          )}
        </div>

        {/* Summary and Actions */}
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {hasChanges ? (
                <span className="text-foreground font-semibold">
                  ⚠️ {countData.filter(i => i.difference !== 0).length} items have changes
                </span>
              ) : (
                <span>No changes detected</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setStatusFilter(statusFilter === "Out of Stock" ? "All" : "Out of Stock")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all hover:scale-105 ${
                  statusFilter === "Out of Stock"
                    ? "bg-red-600 text-white ring-2 ring-red-400 shadow-lg"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                }`}
                title="Click to filter out of stock items"
              >
                Out: {countData.filter(i => i.status === "Out of Stock").length}
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "Low Stock" ? "All" : "Low Stock")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all hover:scale-105 ${
                  statusFilter === "Low Stock"
                    ? "bg-yellow-600 text-white ring-2 ring-yellow-400 shadow-lg"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                }`}
                title="Click to filter low stock items"
              >
                Low: {countData.filter(i => i.status === "Low Stock").length}
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === "In Stock" ? "All" : "In Stock")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all hover:scale-105 ${
                  statusFilter === "In Stock"
                    ? "bg-green-600 text-white ring-2 ring-green-400 shadow-lg"
                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                }`}
                title="Click to filter in stock items"
              >
                In Stock: {countData.filter(i => i.status === "In Stock").length}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCount}
              disabled={!hasChanges}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update Stock Levels
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
