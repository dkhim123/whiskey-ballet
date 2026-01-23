"use client"

import { useState } from "react"
import TrashIcon from "./icons/TrashIcon"
import { calculateCartTotals, formatKES } from "../utils/pricing"

export default function CartPanel({ 
  items, 
  subtotal, 
  discount, 
  onDiscountChange, 
  total, 
  onRemoveItem, 
  onUpdateQuantity, 
  onUpdatePrice, 
  onCheckout,
  selectedCustomer
}) {
  const [editingPriceId, setEditingPriceId] = useState(null)
  const [editingPrice, setEditingPrice] = useState("")

  // Calculate VAT breakdown using pricing utility
  const cartTotals = calculateCartTotals(items, discount, 0.16)

  const handlePriceEdit = (item) => {
    setEditingPriceId(item.id)
    setEditingPrice(item.price)
  }

  const savePriceEdit = (itemId) => {
    onUpdatePrice(itemId, Number.parseFloat(editingPrice) || 0)
    setEditingPriceId(null)
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="bg-card rounded-xl flex flex-col h-full" style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' }}>
      {/* Professional Header - Fixed - Navy Blue */}
      <div className="px-6 py-5 bg-gradient-to-r from-blue-900 to-blue-800 text-white flex-shrink-0 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Order Summary</h2>
            <p className="text-sm opacity-90 mt-1">
              {items.length === 0 ? "Cart is empty" : `${totalQuantity} items • ${items.length} products`}
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
            <div className="text-3xl font-bold">{items.length}</div>
            <div className="text-xs opacity-90 text-center">Items</div>
          </div>
        </div>
      </div>

      {/* Scrollable Content - Items + Footer */}
      <div className="flex-1 overflow-y-auto">
        {/* Items List */}
        <div className="px-4 py-3 bg-muted/20">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-5xl mb-3 opacity-30">🛒</div>
            <p className="text-base font-semibold text-muted-foreground">Cart is Empty</p>
            <p className="text-xs text-muted-foreground mt-1">Add products to start</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-border hover:border-primary/50 transition-all shadow-sm"
              >
                {/* Compact Item Header */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="bg-primary/10 text-primary font-bold text-xs px-1.5 py-0.5 rounded">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Compact Controls */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Qty</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.id, Number.parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border border-border rounded text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Price</label>
                    {editingPriceId === item.id ? (
                      <input
                        type="number"
                        value={editingPrice}
                        onChange={(e) => setEditingPrice(e.target.value)}
                        onBlur={() => savePriceEdit(item.id)}
                        onKeyDown={(e) => e.key === "Enter" && savePriceEdit(item.id)}
                        className="w-full px-2 py-1.5 border border-primary rounded text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => handlePriceEdit(item)}
                        className="w-full px-2 py-1.5 border border-border rounded text-sm font-bold hover:border-primary hover:bg-primary/5 text-center transition-colors"
                      >
                        {item.price}
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Total</label>
                    <div className="px-2 py-1.5 bg-primary/10 border border-primary/30 rounded text-sm font-bold text-primary text-center">
                      {((item.price ?? 0) * (item.quantity ?? 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Footer Section - Inside Scrollable Area */}
        <div className="border-t-2 border-border bg-white dark:bg-slate-900">
          {/* Calculation Section */}
          <div className="px-4 py-3 space-y-2 bg-muted/20">
          {/* Subtotal */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
            <span className="text-lg font-bold text-foreground">{formatKES(cartTotals.subtotal)}</span>
          </div>
          
          {/* Discount Row */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Discount
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => onDiscountChange(Math.max(0, Math.min(100, Number.parseFloat(e.target.value) || 0)))}
              className="w-16 px-2 py-1 border border-border rounded text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary bg-card"
              min="0"
              max="100"
              placeholder="0"
            />
            <span className="text-sm font-bold">%</span>
            {discount > 0 && (
              <span className="text-xs text-destructive font-bold ml-auto">
                -{formatKES(cartTotals.discountAmount)}
              </span>
            )}
          </div>

          {/* VAT Breakdown */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Price before VAT</span>
              <span className="font-semibold text-foreground">{formatKES(cartTotals.priceBeforeVAT)}</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-muted-foreground">VAT (16%)</span>
              <span className="font-semibold text-[#D4AF37]">{formatKES(cartTotals.totalVAT)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 italic mt-1">*All prices are VAT-inclusive</p>
          </div>
        </div>

        {/* Total Section - Prominent with Gold/Burgundy Theme */}
        <div className="px-4 py-4 bg-gradient-to-r from-[#6B0F1A]/10 to-[#D4AF37]/10 dark:from-[#6B0F1A]/30 dark:to-[#D4AF37]/30 border-t-2 border-[#D4AF37]">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">TOTAL AMOUNT</div>
              <div className="text-xs text-muted-foreground">{totalQuantity} items</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-[#D4AF37] uppercase">KES</div>
              <div className="text-4xl font-black text-[#6B0F1A] dark:text-[#D4AF37]">
                {(cartTotals.total ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Buttons - Clear CTA */}
        <div className="px-4 py-4 bg-card grid grid-cols-2 gap-3 border-t-2 border-border">
          <button
            onClick={() => onCheckout("cash")}
            disabled={items.length === 0}
            className="bg-gradient-to-br from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-5 px-4 rounded-xl disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-2 group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">💵</span>
            <div className="text-center">
              <div className="text-base font-extrabold">CASH</div>
              <div className="text-xs opacity-90">Physical money</div>
            </div>
          </button>

          <button
            onClick={() => onCheckout("mpesa")}
            disabled={items.length === 0}
            className="bg-gradient-to-br from-[#00A651] to-[#00D65E] hover:from-[#008a44] hover:to-[#00B84F] disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-5 px-4 rounded-xl disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-2 group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">📱</span>
            <div className="text-center">
              <div className="text-base font-extrabold">M-PESA</div>
              <div className="text-xs opacity-90">Mobile money</div>
            </div>
          </button>
        </div>

        {/* Credit Sale Button - Always visible for quick access */}
        <div className="px-4 pb-4 bg-card">
          <button
            onClick={() => onCheckout("credit")}
            disabled={items.length === 0}
            className="w-full bg-gradient-to-br from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-5 px-4 rounded-xl disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-2 group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">📝</span>
            <div className="text-center">
              <div className="text-base font-extrabold">CREDIT SALE</div>
              <div className="text-xs opacity-90">
                {selectedCustomer ? `For ${selectedCustomer.name}` : "Select or create customer"}
              </div>
            </div>
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
