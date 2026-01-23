"use client"

import { calculateCartTotals, formatKES } from "../utils/pricing"

export default function ReceiptModal({ items, subtotal, discount, total, paymentMethod, onClose, onNewSale, currentUser }) {
  const cartTotals = calculateCartTotals(items, discount, 0.16)
  const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`
  const currentDate = new Date()
  const dateStr = currentDate.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = currentDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  
  const handlePrint = () => {
    // Create a style element to inject @page rules for this print job
    const style = document.createElement('style')
    style.textContent = `
      @page { 
        margin: 0 !important; 
        size: 80mm auto;
      }
      @media print {
        header, footer { display: none !important; }
      }
    `
    document.head.appendChild(style)
    
    // Trigger print
    window.print()
    
    // Clean up the style after printing
    setTimeout(() => style.remove(), 1000)
  }

  const handleNewSale = () => {
    if (onNewSale) {
      onNewSale()
    } else {
      onClose()
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full border-2 border-black relative max-h-[90vh] flex flex-col my-4 print:max-h-none">
        <style>{`@media print { .print-hide { display: none !important; } }`}</style>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 text-black transition-colors print:hidden"
          title="Close"
          aria-label="Close modal"
        >
          <span className="text-xl font-bold" aria-hidden="true">×</span>
        </button>
        
        {/* Header - Ultra Compact */}
        <div className="p-1 border-b border-black bg-white flex-shrink-0">
          {/* Logo - Larger and more visible */}
          <svg viewBox="0 0 100 100" className="w-16 h-16 mx-auto mb-1">
            <circle cx="50" cy="50" r="48" fill="white" stroke="#000" strokeWidth="3"/>
            <text x="50" y="45" fontFamily="Arial" fontSize="20" fontWeight="900" fill="#000" textAnchor="middle">WB</text>
            <text x="50" y="65" fontFamily="Arial" fontSize="10" fontWeight="900" fill="#000" textAnchor="middle">EST.24</text>
          </svg>
          <h1 className="text-xs font-black text-black text-center leading-none">WHISKEY BALLET</h1>
          <p className="text-[9px] font-black text-black text-center leading-none">WINES & SPIRITS</p>
          <h2 className="text-[10px] font-black text-black text-center border-y border-black py-0.5 mt-0.5">RECEIPT</h2>
          
          {/* Receipt Details */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-black text-black">Sales ID:</span>
              <span className="font-black text-black">#{receiptNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-black text-black">Date:</span>
              <span className="font-black text-black">{dateStr}</span>
              <span className="font-black text-black">Time:</span>
              <span className="font-black text-black">{timeStr}</span>
            </div>

            {currentUser && (
              <div className="flex justify-between text-sm">
                <span className="font-black text-black">Cashier:</span>
                <span className="font-black text-black">{currentUser.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Receipt Body - Ultra Compact */}
        <div className="px-1 pt-1 pb-0 overflow-y-auto flex-1 min-h-0 bg-white" role="region" aria-label="Receipt details" tabIndex={0}>
          <div className="space-y-0.5">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm border-b border-black py-0.5">
                <p className="font-black text-black">{item.quantity}x {item.name}</p>
                <p className="font-black text-black">{formatKES(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          {/* VAT and Total - Simplified */}
          <div className="border-t-2 border-black pt-1 mt-1 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-black text-black">VAT (16%):</span>
              <span className="text-black font-black">{formatKES(cartTotals.totalVAT)}</span>
            </div>
            <div className="flex justify-between font-black text-base border-t-2 border-black pt-1">
              <span className="text-black">TOTAL:</span>
              <span className="text-black">{formatKES(cartTotals.total)}</span>
            </div>
          </div>

          <div className="bg-gray-100 border-2 border-black rounded-lg p-3 mb-3 print-hide">
            <p className="text-sm font-black text-black mb-1">Payment Method</p>
            <p className="font-black text-lg text-black uppercase">{paymentMethod}</p>
          </div>

          {/* Age Verification Footer */}
          <div className="bg-gray-100 border-2 border-black rounded-lg p-2 mb-3 print-hide">
            <p className="text-xs font-black text-black text-center">
              ✓ Age verified (18+) - Alcoholic Drinks Control Act, 2010
            </p>
          </div>

          {/* M-Pesa Payment Information */}
          <div className="bg-gray-100 border-2 border-black rounded-lg p-3 mb-3 print-hide">
            <p className="text-sm font-black text-black text-center mb-2">M-PESA PAYMENT DETAILS</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-black text-black">Paybill No:</span>
                <span className="font-black text-black">247247</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-black text-black">Account No:</span>
                <span className="font-black text-black">0704118259</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-black text-black">Buy Goods:</span>
                <span className="font-black text-black">3536192</span>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-black">
            <p className="mt-1 font-black">Contact: 0723037017</p>
            <p className="font-black mt-2">EST. 2024</p>
          </div>
        </div>

        {/* Footer with action buttons - hidden when printing */}
        <div className="p-2 border-t-2 border-black bg-white flex-shrink-0 print:hidden m-0">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Receipt
            </button>
            <button
              onClick={handleNewSale}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
