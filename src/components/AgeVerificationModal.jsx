import React from 'react'

/**
 * Age Verification Modal for Alcohol Sales Compliance
 * Required by Kenyan law - must verify customer is 18+ before completing sale
 */
export default function AgeVerificationModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#2C1810] border-2 border-[#D4AF37] rounded-lg shadow-2xl max-w-md w-full p-6 animate-fadeIn">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-[#6B0F1A] rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-[#D4AF37]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-[#D4AF37] text-center mb-3">
          Age Verification Required
        </h2>

        {/* Subtitle */}
        <p className="text-[#F5E6D3] text-center text-sm mb-6">
          Alcohol Sale Compliance
        </p>

        {/* Content */}
        <div className="bg-[#1a0f0a] border border-[#D4AF37]/30 rounded-lg p-4 mb-6">
          <p className="text-[#F5E6D3] text-center leading-relaxed mb-4">
            This transaction contains alcoholic beverages regulated under the
            <strong className="text-[#D4AF37]"> Alcoholic Drinks Control Act, 2010</strong>.
          </p>
          
          <p className="text-[#E5C158] text-center font-semibold mb-3">
            You must confirm that the customer is <span className="text-[#D4AF37] text-xl">18 years or older</span>.
          </p>

          <div className="bg-[#6B0F1A]/20 border border-[#6B0F1A] rounded p-3">
            <p className="text-[#F5E6D3] text-xs text-center">
              ⚠️ By confirming, you certify that you have verified the customer's age and
              that they meet the legal requirements to purchase alcohol in Kenya.
            </p>
          </div>
        </div>

        {/* Legal Notice */}
        <div className="mb-6">
          <p className="text-[#E5C158]/70 text-xs text-center italic">
            Sale of alcohol to persons under 18 years is prohibited by law.
            <br />
            This verification will be recorded for compliance purposes.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-transparent border-2 border-[#6B0F1A] text-[#F5E6D3] px-6 py-3 rounded-lg hover:bg-[#6B0F1A]/20 transition-colors font-semibold"
          >
            Cancel Sale
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#D4AF37] text-[#2C1810] px-6 py-3 rounded-lg hover:bg-[#E5C158] transition-colors font-bold shadow-lg"
          >
            Customer is 18+
          </button>
        </div>

        {/* Timestamp Info */}
        <p className="text-[#E5C158]/50 text-xs text-center mt-4">
          Verification timestamp will be recorded with transaction ID
        </p>
      </div>
    </div>
  )
}
