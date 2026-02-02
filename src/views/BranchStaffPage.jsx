"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import TopBar from "../components/TopBar"
import { registerUser, getAllUsers, deactivateUser, getAdminIdForStorage, validatePasswordStrength } from "../utils/auth"
import { getAllBranches } from "../services/branchService"
import { Users, UserPlus, UserX, Check, X } from "lucide-react"

export default function BranchStaffPage({ currentUser }) {
  const [cashiers, setCashiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [branchDisplayName, setBranchDisplayName] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCashier, setNewCashier] = useState({
    name: '',
    email: '',
    password: '',
    permissions: {
      process_sales: true,
      view_inventory: true,
      manage_customers: false,
      manage_expenses: false,
      view_branch_reports: false
    }
  })

  useEffect(() => {
    if (currentUser?.role !== 'manager') return
    if (!currentUser?.branchId) return
    loadCashiers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, currentUser?.branchId])

  // Resolve branch ID to human-readable name for "Manage cashiers for branch: ..."
  useEffect(() => {
    if (currentUser?.role !== 'manager' || !currentUser?.branchId) {
      setBranchDisplayName('')
      return
    }
    const branchId = currentUser.branchId
    let cancelled = false
    getAllBranches()
      .then((branches) => {
        if (cancelled) return
        const match = (branches || []).find((b) => b.id === branchId)
        setBranchDisplayName(match?.name || branchId)
      })
      .catch(() => {
        if (!cancelled) setBranchDisplayName(branchId)
      })
    return () => { cancelled = true }
  }, [currentUser?.role, currentUser?.branchId])

  const loadCashiers = async () => {
    try {
      setLoading(true)
      const adminId = getAdminIdForStorage(currentUser)
      const allUsers = await getAllUsers(adminId)
      
      // Filter to show only cashiers in the same branch
      const branchCashiers = allUsers.filter(user => 
        user.role === 'cashier' && 
        user.branchId === currentUser.branchId
      )
      
      setCashiers(branchCashiers)
    } catch (error) {
      console.error('Error loading cashiers:', error)
      toast.error('Failed to load cashiers')
    } finally {
      setLoading(false)
    }
  }

  // Render guards (keep AFTER hooks to avoid React hook mismatch crashes)
  if (currentUser?.role !== 'manager') {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopBar title="Branch Staff Management" />
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-card rounded-xl shadow-xl border-2 border-border p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Access Restricted</h2>
            <p className="text-muted-foreground mb-6">
              You do not have permission to access this page. Branch Staff Management is only accessible to branch managers.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!currentUser?.branchId) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopBar title="Branch Staff Management" />
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-card rounded-xl shadow-xl border-2 border-border p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-yellow-500/10 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">No Branch Assignment</h2>
            <p className="text-muted-foreground mb-6">
              You must be assigned to a branch before you can manage cashiers. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleAddCashier = async () => {
    try {
      // Validate inputs
      if (!newCashier.name.trim()) {
        toast.error('Please enter cashier name')
        return
      }
      if (!newCashier.email.trim()) {
        toast.error('Please enter cashier email')
        return
      }
      if (!newCashier.password.trim()) {
        toast.error('Please enter cashier password')
        return
      }

      // Validate password strength
      const passwordErrors = validatePasswordStrength(newCashier.password)
      if (passwordErrors.length > 0) {
        toast.error(passwordErrors[0])
        return
      }

      // Register new cashier with manager's branchId
      const result = await registerUser(
        newCashier.name.trim(),
        newCashier.email.trim(),
        newCashier.password,
        'cashier',
        currentUser.id, // createdBy (manager's ID)
        currentUser.branchId // Same branch as manager
      )

      if (result.success) {
        toast.success('Cashier created successfully')
        setShowAddModal(false)
        setNewCashier({
          name: '',
          email: '',
          password: '',
          permissions: {
            process_sales: true,
            view_inventory: true,
            manage_customers: false,
            manage_expenses: false,
            view_branch_reports: false
          }
        })
        loadCashiers()
      } else {
        toast.error(result.error || 'Failed to create cashier')
      }
    } catch (error) {
      console.error('Error creating cashier:', error)
      toast.error('Failed to create cashier')
    }
  }

  const handleDeactivateCashier = async (cashierId) => {
    try {
      const confirmed = window.confirm('Are you sure you want to deactivate this cashier? They will no longer be able to log in.')
      if (!confirmed) return

      const result = await deactivateUser(cashierId, currentUser.email)

      if (result.success) {
        toast.success('Cashier deactivated successfully')
        loadCashiers()
      } else {
        toast.error(result.error || 'Failed to deactivate cashier')
      }
    } catch (error) {
      console.error('Error deactivating cashier:', error)
      toast.error('Failed to deactivate cashier')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar title="Branch Staff Management" />
      
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Cashiers</h1>
              <p className="text-muted-foreground">
                Manage cashiers for branch: <span className="font-semibold">{branchDisplayName || currentUser.branchId}</span>
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Add Cashier
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : cashiers.length === 0 ? (
            <div className="bg-card rounded-xl shadow-lg border border-border p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Cashiers Yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first cashier to start managing your branch staff.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add First Cashier
              </button>
            </div>
          ) : (
            <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cashiers.map((cashier) => (
                      <tr key={cashier.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{cashier.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-muted-foreground">{cashier.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-muted-foreground">
                            {cashier.createdAt ? new Date(cashier.createdAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            cashier.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {cashier.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDeactivateCashier(cashier.id)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <UserX className="w-4 h-4" />
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Cashier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl border border-border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Add New Cashier</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newCashier.name}
                  onChange={(e) => setNewCashier({ ...newCashier, name: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter cashier name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newCashier.email}
                  onChange={(e) => setNewCashier({ ...newCashier, email: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter cashier email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newCashier.password}
                  onChange={(e) => setNewCashier({ ...newCashier, password: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter password (min 8 characters)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Password must be at least 8 characters with uppercase, lowercase, and numbers
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Permissions
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCashier.permissions.process_sales}
                      onChange={(e) => setNewCashier({
                        ...newCashier,
                        permissions: { ...newCashier.permissions, process_sales: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">Process Sales (POS)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCashier.permissions.view_inventory}
                      onChange={(e) => setNewCashier({
                        ...newCashier,
                        permissions: { ...newCashier.permissions, view_inventory: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">View Inventory</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCashier.permissions.manage_customers}
                      onChange={(e) => setNewCashier({
                        ...newCashier,
                        permissions: { ...newCashier.permissions, manage_customers: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">Manage Customers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCashier.permissions.manage_expenses}
                      onChange={(e) => setNewCashier({
                        ...newCashier,
                        permissions: { ...newCashier.permissions, manage_expenses: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">Manage Expenses</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCashier.permissions.view_branch_reports}
                      onChange={(e) => setNewCashier({
                        ...newCashier,
                        permissions: { ...newCashier.permissions, view_branch_reports: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">View Branch Reports</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCashier}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create Cashier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
