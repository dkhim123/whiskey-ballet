"use client"

import TopBar from "../components/TopBar"
import BranchManagement from "../components/BranchManagement"

export default function BranchManagementPage({ currentUser }) {
  // Check if user is authorized
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopBar title="Branch Management" />
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-card rounded-xl shadow-xl border-2 border-border p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Access Restricted</h2>
            <p className="text-muted-foreground mb-6">
              You do not have permission to access this page. Branch Management is only accessible to administrators.
            </p>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar title="Branch Management" />
      
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <BranchManagement currentUser={currentUser} />
        </div>
      </div>
    </div>
  )
}
