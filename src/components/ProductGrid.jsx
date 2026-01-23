"use client"

import { getImageSrc } from "../utils/images"

export default function ProductGrid({ products, onAddProduct, cart = [] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-xl" style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
        <p className="text-muted-foreground text-lg">No products found</p>
        <p className="text-sm text-muted-foreground mt-2">Try adjusting your search criteria</p>
      </div>
    )
  }

  // Calculate available quantity for each product (total - what's in cart)
  const getAvailableQuantity = (product) => {
    const cartItem = cart.find(item => item.id === product.id)
    const inCart = cartItem ? cartItem.quantity : 0
    return (product.quantity ?? 0) - inCart
  }

  // Check if product is expired or expiring soon
  const checkExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate)
    expiry.setHours(0, 0, 0, 0)
    const diffTime = expiry - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { status: 'expired', days: Math.abs(diffDays) }
    if (diffDays === 0) return { status: 'expires-today', days: 0 }
    if (diffDays <= 7) return { status: 'expires-soon', days: diffDays }
    return null
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {products.map((product) => {
        const availableQty = getAvailableQuantity(product)
        const isOutOfStock = availableQty <= 0
        const isLowStock = availableQty > 0 && availableQty <= (product.reorderLevel ?? 0)
        const expiryStatus = checkExpiryStatus(product.expiryDate)
        
        return (
          <button
            key={product.id}
            onClick={() => onAddProduct(product)}
            disabled={isOutOfStock}
            className={`bg-card rounded-xl p-3 sm:p-4 transition-all text-left transform duration-200 relative touch-manipulation active:scale-95
              ${isOutOfStock 
                ? 'opacity-40 cursor-not-allowed' 
                : 'hover:scale-105'
              }`}
            style={{ 
              boxShadow: isOutOfStock 
                ? 'none' 
                : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'
            }}
          >
            <div className="relative">
              <img
                src={getImageSrc(product.image)}
                alt={product.name}
                className={`w-full h-24 sm:h-32 object-cover rounded-md mb-2 sm:mb-3 ${isOutOfStock ? 'grayscale' : ''}`}
                onError={(e) => {
                  e.target.src = getImageSrc("/placeholder.svg")
                }}
              />
              {/* Priority: Expired > Expires Today > Expires Soon > Low Stock */}
              {expiryStatus && expiryStatus.status === 'expired' && (
                <span className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs px-2 sm:px-3 py-1 rounded-full font-semibold">
                  Expired
                </span>
              )}
              {expiryStatus && expiryStatus.status === 'expires-today' && (
                <span className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs px-2 sm:px-3 py-1 rounded-full font-semibold">
                  Today
                </span>
              )}
              {expiryStatus && expiryStatus.status === 'expires-soon' && (
                <span className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs px-2 sm:px-3 py-1 rounded-full font-semibold">
                  {expiryStatus.days}d
                </span>
              )}
              {isLowStock && !isOutOfStock && !expiryStatus && (
                <span className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-rose-100/80 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-xs px-2 sm:px-3 py-1 rounded-full font-semibold">
                  Low
                </span>
              )}
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-600/80 rounded-md">
                  <span className="bg-red-700 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold shadow-lg">
                    ❌ OUT
                  </span>
                </div>
              )}
            </div>
            <h3 className={`font-semibold text-sm sm:text-base truncate ${isOutOfStock ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
              {product.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-1 sm:mb-2">{product.sku}</p>
            {product.expiryDate && (
              <p className="text-xs text-muted-foreground mb-1 sm:mb-2">
                Exp: {new Date(product.expiryDate).toLocaleDateString()}
              </p>
            )}
            <div className="flex justify-between items-center">
              <p className={`text-base sm:text-lg font-bold ${isOutOfStock ? 'text-red-600 dark:text-red-400' : 'text-accent'}`}>
                KES {(product.price ?? product.sellingPrice ?? 0).toLocaleString()}
              </p>
              <p className={`text-xs font-semibold ${
                isOutOfStock ? 'text-red-600 dark:text-red-400' : 
                isLowStock ? 'text-yellow-600 dark:text-yellow-400' : 
                'text-green-600 dark:text-green-400'
              }`}>
                {isNaN(availableQty) ? 0 : availableQty}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
