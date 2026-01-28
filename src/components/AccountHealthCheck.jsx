/**
 * Account Health Check Component
 * Displays a warning banner when user account is missing required data (e.g., branchId for cashiers)
 * Provides quick actions to fix account issues
 */

import { useState } from 'react'
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react'

export default function AccountHealthCheck({ currentUser, onLogout }) {
  const [isDismissed, setIsDismissed] = useState(false)
  
  // Check if cashier is missing branchId
  const isCashierWithoutBranch = currentUser?.role === 'cashier' && !currentUser?.branchId
  
  // Don't show if dismissed or not needed
  if (isDismissed || !isCashierWithoutBranch) {
    return null
  }

  const handleFixAccount = () => {
    if (confirm('To fix your account, you need to logout and login again. This will reload your account with the correct branch assignment.\n\nLogout now?')) {
      onLogout()
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-sm">⚠️ Account Configuration Issue</p>
              <p className="text-xs opacity-90">
                Your account is missing branch assignment. You won't be able to see inventory or make sales until this is fixed.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleFixAccount}
              className="px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-sm flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Fix Now (Logout & Re-login)
            </button>
            
            <button
              onClick={() => setIsDismissed(true)}
              className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
