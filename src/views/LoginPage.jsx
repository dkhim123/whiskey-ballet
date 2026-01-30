"use client"

import LoginForm from "../components/LoginForm"

export default function LoginPage({ onLogin }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-[#2C1810] via-[#1a0f0a] to-[#2C1810] dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#F5F1E8] dark:bg-gray-800 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-2 border-[#D4AF37]/30 dark:border-[#D4AF37]/50">
          <div className="text-center mb-8">
            {/* Whiskey Ballet Logo */}
            <div className="mb-6">
              <svg viewBox="0 0 500 500" className="h-40 w-40 mx-auto">
                <circle cx="250" cy="250" r="240" fill="white" stroke="#D4AF37" strokeWidth="6"/>
                <circle cx="250" cy="250" r="220" fill="none" stroke="#D4AF37" strokeWidth="2"/>
                <text x="250" y="180" fontFamily="Georgia, serif" fontSize="36" fontWeight="bold" fill="#2C1810" textAnchor="middle">WHISKEY</text>
                <text x="250" y="230" fontFamily="Georgia, serif" fontSize="36" fontWeight="bold" fill="#2C1810" textAnchor="middle">BALLET</text>
                <text x="250" y="340" fontFamily="Georgia, serif" fontSize="24" fontWeight="bold" fill="#D4AF37" textAnchor="middle">EST. 2024</text>
              </svg>
            </div>
            <p className="text-sm text-[#8B7355] dark:text-gray-300 mt-3">Sign in to your account</p>
          </div>
          
          <LoginForm onLogin={onLogin} />
        </div>
        
        {/* Footer tagline */}
        <p className="text-center text-[#D4AF37] dark:text-[#E5C158] text-sm mt-6 font-serif italic">
          "Premium wines, exceptional spirits, impeccable service"
        </p>
      </div>
    </div>
  )
}
