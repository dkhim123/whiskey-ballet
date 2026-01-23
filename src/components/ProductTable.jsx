"use client"

import { getImageSrc } from "../utils/images"
import { isExpired, isExpiringSoon } from "../utils/dateHelpers"

export default function ProductTable({ products, onAddProduct, cart = [], selectedCustomer = null }) {
  // Calculate available quantity for each product (total - what's in cart)
  const getAvailableQuantity = (product) => {
    const cartItem = cart.find(item => item.id === product.id)
    const inCart = cartItem ? cartItem.quantity : 0
    return (product.quantity ?? 0) - inCart
  }

  // Get status badge - Pill-shaped with soft backgrounds
  const getStatusBadge = (product, availableQty) => {
    if (isExpired(product.expiryDate)) {
      return <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-300">Expired</span>
    }
    if (availableQty <= 0) {
      return <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-300">Out of Stock</span>
    }
    if (availableQty <= (product.reorderLevel ?? 0)) {
      return <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-rose-100/80 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">Low Stock</span>
    }
    if (isExpiringSoon(product.expiryDate)) {
      return <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Expiring Soon</span>
    }
    return <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-green-100/80 text-green-700 dark:bg-green-900/30 dark:text-green-300">In Stock</span>
  }

  // Handle add to cart
  const handleAddToCart = (product) => {
    const quantity = 1 // Always add 1 item when clicking on a row
    const availableQty = getAvailableQuantity(product)
    
    if (availableQty <= 0) {
      alert("Product out of stock!")
      return
    }

    // Add to cart with quantity of 1
    onAddProduct(product, quantity)
  }

  // Calculate effective price for customer
  const getEffectivePrice = (product) => {
    const basePrice = product.price ?? product.sellingPrice ?? 0
    if (selectedCustomer?.specialPricing && selectedCustomer?.discountRate > 0) {
      const discount = selectedCustomer.discountRate / 100
      return basePrice * (1 - discount)
    }
    return basePrice
  }

  // Handle keyboard navigation
  const handleKeyDown = (e, product) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAddToCart(product)
    }
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-xl" style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
        <p className="text-muted-foreground text-lg">No products found</p>
        <p className="text-sm text-muted-foreground mt-2">Try adjusting your search or filter criteria</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">SKU</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Price (KES)</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Stock Level</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Expiry Date</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => {
              const availableQty = getAvailableQuantity(product)
              const isOutOfStock = availableQty <= 0
              const expired = isExpired(product.expiryDate)
              const effectivePrice = getEffectivePrice(product)
              const hasDiscount = selectedCustomer?.specialPricing && selectedCustomer?.discountRate > 0
              
              return (
                <tr 
                  key={product.id} 
                  className={`
                    border-b border-border/30
                    ${isOutOfStock || expired ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer"}
                    transition-all duration-200
                  `}
                  tabIndex={isOutOfStock || expired ? -1 : 0}
                  onClick={() => !isOutOfStock && !expired && handleAddToCart(product)}
                  onKeyDown={(e) => handleKeyDown(e, product)}
                  title={isOutOfStock || expired ? "Cannot add - product unavailable" : "Click to add to cart"}
                >
                  {/* SKU */}
                  <td className="px-4 py-4 text-sm text-foreground font-mono font-semibold">
                    {product.sku}
                  </td>

                  {/* Product Name & Image */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getImageSrc(product.image || "/diverse-products-still-life.png")}
                        alt={product.name}
                        className="w-14 h-14 object-cover rounded-lg border border-border/50"
                        onError={(e) => {
                          e.target.src = getImageSrc("/placeholder.svg")
                        }}
                      />
                      <div>
                        <div className="font-medium text-foreground text-sm">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.category || "Other"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-4 text-right">
                    <div>
                      <div className={`font-bold text-sm ${hasDiscount ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                        {(effectivePrice ?? 0).toLocaleString()}
                      </div>
                      {hasDiscount && (
                        <div className="text-xs text-muted-foreground line-through">
                          {(product.price ?? product.sellingPrice ?? 0).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Stock Level */}
                  <td className="px-4 py-4 text-center">
                    <div className={`font-semibold text-sm ${
                      isOutOfStock ? "text-red-600 dark:text-red-400" :
                      availableQty <= product.reorderLevel ? "text-yellow-600 dark:text-yellow-400" :
                      "text-green-600 dark:text-green-400"
                    }`}>
                      {availableQty}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      / {product.quantity}
                    </div>
                  </td>

                  {/* Expiry Date */}
                  <td className="px-4 py-4 text-center text-sm">
                    {product.expiryDate ? (
                      <div className={`${
                        expired ? 'text-red-600 dark:text-red-400 font-semibold' :
                        isExpiringSoon(product.expiryDate) ? 'text-orange-600 dark:text-orange-400 font-semibold' :
                        'text-foreground'
                      }`}>
                        {new Date(product.expiryDate).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">N/A</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4 text-center">
                    {getStatusBadge(product, availableQty)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
