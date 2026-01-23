"use client"

import { useState, useMemo } from "react"
import { getImageSrc, fileToBase64, compressImage } from "../utils/images"
import { calculatePricingMetrics, formatKES } from "../utils/pricing"

const PRODUCT_CATEGORIES = [
  "Red Wine",
  "White Wine",
  "Rosé Wine",
  "Sparkling Wine",
  "Whisky",
  "Vodka",
  "Rum",
  "Gin",
  "Tequila",
  "Brandy",
  "Liqueur",
  "Beer",
  "Spirits",
  "soft drink",
  "Other"
]

export default function EditProductModal({ product, onSave, onClose, onDelete, onBarcode }) {
  const [formData, setFormData] = useState({
    ...product,
    costPrice: product.costPrice || 0,
    sellingPrice: product.sellingPrice || product.price || 0,
    expiryDate: product.expiryDate || "",
    alcoholPercentage: product.alcoholPercentage || 0,
    bottleSize: product.bottleSize || "750ml",
    kebsNumber: product.kebsNumber || "",
    inventoryUnits: product.inventoryUnits || "bottle",
    vatRate: product.vatRate || 0.16
  })

  // Calculate pricing metrics in real-time
  const pricingMetrics = useMemo(() => {
    if (formData.sellingPrice > 0 && formData.costPrice > 0) {
      return calculatePricingMetrics(formData.sellingPrice, formData.costPrice, 0.16)
    }
    return null
  }, [formData.sellingPrice, formData.costPrice])
  const [imagePreview, setImagePreview] = useState(product.image || "/diverse-products-still-life.png")
  const [isDragging, setIsDragging] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    
    // List of text/string fields that should NOT be parsed as numbers
    const textFields = ["name", "category", "expiryDate", "sku", "barcode", "bottleSize", "kebsNumber", "inventoryUnits", "image"]
    
    const newData = {
      ...formData,
      [name]: textFields.includes(name) ? value : Number.parseFloat(value) || 0,
    }
    
    // Update price for backward compatibility
    if (name === "sellingPrice") {
      newData.price = Number.parseFloat(value) || 0
    }
    
    setFormData(newData)
  }

  const processImageFile = async (file) => {
    try {
      // Check file size (max 5MB before compression)
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB")
        return
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file (PNG, JPG, JPEG, GIF)")
        return
      }
      
      // Convert to base64
      const base64String = await fileToBase64(file)
      
      // Compress if large
      const compressed = await compressImage(base64String, 1) // Max 1MB
      
      setImagePreview(compressed)
      setFormData(prev => ({ ...prev, image: compressed }))
    } catch (error) {
      console.error("Error processing image:", error)
      alert("Failed to process image. Please try again.")
    }
  }

  const handleImageChange = async (e) => {
    // Check if running in Electron
    if (window.electronAPI?.selectImageFile) {
      // Desktop: Use native file dialog with Windows paths
      const result = await window.electronAPI.selectImageFile()
      if (result) {
        setImagePreview(result.data)
        setFormData(prev => ({ ...prev, image: result.data }))
      }
    } else {
      // Web: Use standard file input
      const file = e.target.files?.[0]
      if (file) {
        processImageFile(file)
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Drag over detected')
    setIsDragging(true)
  }
  
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Drag enter detected')
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Drag leave detected')
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Drop detected!', e.dataTransfer)
    setIsDragging(false)
    
    try {
      const files = e.dataTransfer?.files
      console.log('Files:', files)
      
      if (!files || files.length === 0) {
        console.error('No files found in drop event')
        alert('No files detected. Please try clicking "Choose Image" button instead.')
        return
      }
      
      const file = files[0]
      console.log('File:', file.name, file.type, file.size)
      processImageFile(file)
    } catch (error) {
      console.error('Error handling drop:', error)
      alert('Error processing dropped file. Please use "Choose Image" button instead.')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Calculate VAT and metrics before saving
    const metrics = pricingMetrics || calculatePricingMetrics(formData.sellingPrice, formData.costPrice, 0.16)
    
    const updatedData = {
      ...formData,
      vatAmount: metrics.vatAmount,
      profit: metrics.profit,
      margin: metrics.markup
    }
    
    onSave(updatedData)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border-2 border-border my-8">
        <div className="p-6 border-b border-border flex-shrink-0">
          <h2 className="text-2xl font-bold text-foreground">Edit Product</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Image Upload Section with Drag & Drop */}
          <div 
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label className="block text-sm font-medium text-foreground mb-2">Product Image</label>
            <div className="flex flex-col items-center gap-3">
              <img 
                src={getImageSrc(imagePreview)}
                alt="Product preview" 
                className="w-32 h-32 object-cover rounded-lg border-2 border-border"
                onError={(e) => {
                  e.target.src = getImageSrc("/placeholder.svg")
                }}
              />
              <div className="flex gap-2">
                <label 
                  className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg cursor-pointer transition-colors"
                  onClick={(e) => {
                    // In Electron, prevent file input and use native dialog
                    if (window.electronAPI?.selectImageFile) {
                      e.preventDefault()
                      handleImageChange(e)
                    }
                  }}
                >
                  Change Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {imagePreview !== "/diverse-products-still-life.png" && (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview("/diverse-products-still-life.png")
                      setFormData(prev => ({ ...prev, image: "/diverse-products-still-life.png" }))
                    }}
                    className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isDragging ? '📁 Drop image here' : '📁 Drag & drop image or click "Change Image"'}
              </p>
              <p className="text-xs text-muted-foreground">Max 5MB • PNG, JPG, JPEG, GIF</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Product Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Category</label>
            <select
              name="category"
              value={formData.category || "Other"}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
            >
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Pricing Section with VAT Breakdown */}
          <div className="bg-gradient-to-br from-[#6B0F1A]/5 to-[#D4AF37]/5 border border-[#D4AF37]/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              💰 Pricing (VAT-Inclusive)
              <span className="text-xs font-normal text-muted-foreground">(Kenya 16% VAT)</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Cost Price (KES)
                  <span className="text-xs text-muted-foreground ml-1 block">(from vendor)</span>
                </label>
                <input
                  type="number"
                  name="costPrice"
                  value={formData.costPrice}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] bg-card text-foreground"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Selling Price (KES)
                  <span className="text-xs text-muted-foreground ml-1 block">(to customer)</span>
                </label>
                <input
                  type="number"
                  name="sellingPrice"
                  value={formData.sellingPrice}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] bg-card text-foreground"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            {/* Real-time Pricing Metrics Display */}
            {pricingMetrics && (
              <div className="bg-card/50 rounded-lg p-3 space-y-2 border border-[#D4AF37]/20">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Price before VAT:</span>
                  <span className="font-semibold text-foreground">{formatKES(pricingMetrics.priceBeforeVAT)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">VAT Amount (16%):</span>
                  <span className="font-semibold text-[#D4AF37]">{formatKES(pricingMetrics.vatAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-border">
                  <span className="text-muted-foreground">Profit:</span>
                  <span className={`font-bold ${pricingMetrics.profit > 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatKES(pricingMetrics.profit)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Margin:</span>
                  <span className={`font-bold ${pricingMetrics.margin > 0 ? 'text-success' : 'text-destructive'}`}>
                    {pricingMetrics.margin.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Markup:</span>
                  <span className="font-semibold text-[#6B0F1A]">
                    {pricingMetrics.markup.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Wines & Spirits Specific Fields */}
          <div className="bg-gradient-to-br from-[#D4AF37]/5 to-[#6B0F1A]/5 border border-[#6B0F1A]/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground mb-2">🍷 Alcohol Product Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Alcohol %
                  <span className="text-xs text-muted-foreground ml-1 block">(ABV)</span>
                </label>
                <input
                  type="number"
                  name="alcoholPercentage"
                  value={formData.alcoholPercentage}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] bg-card text-foreground"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g., 40.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Bottle Size</label>
                <select
                  name="bottleSize"
                  value={formData.bottleSize}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] bg-card text-foreground"
                >
                  <option value="330ml">330ml</option>
                  <option value="350ml">350ml</option>
                  <option value="500ml">500ml</option>
                  <option value="750ml">750ml</option>
                  <option value="1L">1 Liter</option>
                  <option value="1.5L">1.5 Liters</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  KEBS License Number
                  <span className="text-xs text-muted-foreground ml-1 block">(optional)</span>
                </label>
                <input
                  type="text"
                  name="kebsNumber"
                  value={formData.kebsNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] bg-card text-foreground"
                  placeholder="KEBS-2024-XXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Inventory Unit</label>
                <select
                  name="inventoryUnits"
                  value={formData.inventoryUnits}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] bg-card text-foreground"
                >
                  <option value="bottle">Bottle</option>
                  <option value="case">Case</option>
                  <option value="pack">Pack</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stock Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Stock Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Low Stock Alert Level
                <span className="text-xs text-muted-foreground ml-1 block">(alert when stock drops below this)</span>
              </label>
              <input
                type="number"
                name="reorderLevel"
                value={formData.reorderLevel}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                placeholder="10"
              />
            </div>
          </div>

          {/* Expiry Date Section */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Expiry Date (Optional)
              <span className="text-xs text-muted-foreground ml-1">(for perishable items)</span>
            </label>
            <input
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex gap-3 pt-3 pb-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
                  if (typeof onDelete === 'function') {
                    onDelete(product.id)
                  } else {
                    alert('Delete functionality not available. Please contact your system administrator.')
                  }
                }
              }}
              className="flex-1 px-4 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Product
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof onBarcode === 'function') {
                  onBarcode(product)
                } else {
                  alert('Barcode printing not available')
                }
              }}
              className="flex-1 px-4 py-2.5 bg-secondary/10 hover:bg-secondary/20 text-foreground font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Print Barcode
            </button>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
