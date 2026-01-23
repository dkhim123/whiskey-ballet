"use client"

export default function BarcodeModal({ product, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full max-h-[90vh] flex flex-col p-8 my-4">
        <h2 className="text-2xl font-bold text-text-primary mb-6 text-center">Barcode</h2>

        <div className="bg-surface rounded-lg p-6 mb-6 text-center">
          <div className="text-5xl font-bold tracking-widest font-mono mb-4 text-text-primary">{product.barcode}</div>
          <div className="h-16 bg-white rounded flex items-center justify-center mb-4 border border-border">
            <div className="flex gap-1">
              {product.barcode.split("").map((digit, i) => (
                <div key={i} className="flex flex-col">
                  <div className="w-1 h-8 bg-black" style={{ height: ["8px", "16px", "8px"][i % 3] }}></div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-text-secondary">{product.name}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.print()}
            className="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg"
          >
            Print Barcode
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-border text-text-primary font-semibold rounded-lg hover:bg-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
