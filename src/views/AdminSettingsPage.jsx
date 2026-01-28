"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"
import TopBar from "../components/TopBar"
import PWAInstallPrompt from "../components/PWAInstallPrompt"
import { getAllUsers, updateUserPassword, deactivateUser, registerUser, updateUserBranch } from "../utils/auth"
import { logActivity, ACTIVITY_TYPES } from "../utils/activityLog"
import { getAllBranches } from "../services/branchService"

// Default state for new user form
const DEFAULT_USER_DATA = {
  name: "",
  email: "",
  password: "",
  role: "cashier",
  branchId: "",
  permissions: {
    canViewReports: false,
    canManageInventory: true,
    canManageCustomers: true,
    canViewDashboard: false,
    canManageExpenses: false
  }
}

// Admin override constant for password reset
const ADMIN_PASSWORD_OVERRIDE = ''

export default function AdminSettingsPage({ currentUser, inventory = [] }) {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState(null)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showAddUserPassword, setShowAddUserPassword] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState("")

  // New user form state
  const [newUserData, setNewUserData] = useState(DEFAULT_USER_DATA)

  // Check if user is authorized to access this page
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopBar title="Admin Settings" />
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-card rounded-xl shadow-xl border-2 border-border p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Access Restricted</h2>
            <p className="text-muted-foreground mb-6">
              You do not have permission to access this page. Admin Settings are only accessible to administrators.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Need access?</strong><br />
                Please contact your system administrator to request the necessary permissions.
              </p>
            </div>
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

  // Load users and branches on component mount
  useEffect(() => {
    loadUsers()
    loadBranches()
  }, [currentUser])

  const loadUsers = async () => {
    try {
      // Pass currentUser.id to filter users created by this admin
      const allUsers = await getAllUsers(currentUser?.id)
      console.log('👥 Loaded users:', allUsers.map(u => ({ name: u.name, role: u.role, branchId: u.branchId })))
      setUsers(allUsers)
    } catch (error) {
      console.error("Error loading users:", error)
      setError("Failed to load users")
    }
  }

  const loadBranches = async () => {
    try {
      const allBranches = await getAllBranches()
      console.log('🏢 Loaded branches:', allBranches.map(b => ({ id: b.id, name: b.name })))
      setBranches(allBranches.filter(b => b.isActive))
    } catch (error) {
      console.error("Error loading branches:", error)
    }
  }

  const handlePasswordChange = async () => {
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      // Validate passwords
      if (!newPassword || !confirmPassword) {
        setError("Please fill in all fields")
        setLoading(false)
        return
      }

      if (newPassword !== confirmPassword) {
        setError("Passwords do not match")
        setLoading(false)
        return
      }

      // Use comprehensive password validation from auth.js
      const { validatePasswordStrength } = await import("../utils/auth")
      const passwordErrors = validatePasswordStrength(newPassword)
      if (passwordErrors.length > 0) {
        setError(passwordErrors[0])
        setLoading(false)
        return
      }

      // Admin resets user password without needing old password
      // ADMIN_PASSWORD_OVERRIDE (empty string) skips old password verification in updateUserPassword
      const result = await updateUserPassword(selectedUser.email, ADMIN_PASSWORD_OVERRIDE, newPassword)
      
      if (result.success) {
        // Log activity
        await logActivity(
          ACTIVITY_TYPES.USER_PASSWORD_CHANGED,
          `Reset password for ${selectedUser.name}`,
          {
            userEmail: selectedUser.email,
            userName: selectedUser.name
          },
          currentUser
        )
        
        setSuccess("Password changed successfully")
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => {
          setShowPasswordModal(false)
          setSuccess("")
        }, 2000)
      } else {
        setError(result.error || "Failed to change password")
      }
    } catch (error) {
      setError("An error occurred while changing password")
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      // Validate branch assignment for cashiers
      if (newUserData.role === 'cashier' && !newUserData.branchId) {
        setError("Please assign a branch for this cashier")
        setLoading(false)
        return
      }

      const result = await registerUser(
        newUserData.name,
        newUserData.email,
        newUserData.password,
        newUserData.role,
        currentUser?.id, // Pass the current admin's ID
        newUserData.branchId // Pass the branch assignment
      )

      if (result.success) {
        // Log activity
        await logActivity(
          ACTIVITY_TYPES.USER_CREATED,
          `Created new ${newUserData.role} account for ${newUserData.name}`,
          {
            userEmail: newUserData.email,
            userRole: newUserData.role,
            userName: newUserData.name
          },
          currentUser
        )
        
        setSuccess("User created successfully")
        setNewUserData(DEFAULT_USER_DATA)
        loadUsers()
        setTimeout(() => {
          setShowAddUserModal(false)
          setSuccess("")
        }, 2000)
      } else {
        setError(result.error || "Failed to create user")
      }
    } catch (error) {
      setError("An error occurred while creating user")
    } finally {
      setLoading(false)
    }
  }

  const handleBranchAssignment = async () => {
    console.log('🏢 Branch Assignment Started:', {
      userId: selectedUser?.id,
      userName: selectedUser?.name,
      selectedBranch,
      adminEmail: currentUser?.email
    })

    if (!selectedBranch) {
      setError("Please select a branch")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      console.log('📞 Calling updateUserBranch...')
      const result = await updateUserBranch(selectedUser.id, selectedBranch, currentUser.email)
      console.log('✅ updateUserBranch result:', result)
      
      if (result.success) {
        setSuccess(`Branch assigned successfully to ${selectedUser.name}`)
        await loadUsers()
        
        // Notify other components (e.g., BranchManagement) to refresh
        window.dispatchEvent(new CustomEvent('branchAssignmentChanged'))
        
        // Close modal after showing success message
        setTimeout(() => {
          setShowBranchModal(false)
          setSelectedUser(null)
          setSelectedBranch("")
          setSuccess("")
          setError("")
        }, 1500)
      } else {
        console.error('❌ Assignment failed:', result.error)
        setError(result.error || "Failed to assign branch")
      }
    } catch (error) {
      console.error('💥 Exception during assignment:', error)
      setError("An error occurred while assigning branch")
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivateUser = async (userId) => {
    // Security check: Verify current user is admin
    if (currentUser?.role !== 'admin') {
      setError("Unauthorized: Only administrators can deactivate users")
      return
    }

    try {
      const result = await deactivateUser(userId, currentUser.email)
      if (result.success) {
        // Log activity
        await logActivity(
          ACTIVITY_TYPES.USER_DEACTIVATED,
          `Deleted account for ${userToDeactivate.name}`,
          {
            userEmail: userToDeactivate.email,
            userName: userToDeactivate.name,
            userRole: userToDeactivate.role
          },
          currentUser
        )
        
        setSuccess("User deleted successfully")
        loadUsers()
        setShowDeactivateModal(false)
        setUserToDeactivate(null)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(result.error || "Failed to delete user")
      }
    } catch (error) {
      setError("An error occurred while deleting user")
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar title="Admin Settings" />
      
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Help Section for Non-Tech Users */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              ℹ️ Quick Guide - Managing User Accounts
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white dark:bg-blue-950/30 rounded-lg p-4">
                <p className="font-semibold text-blue-900 dark:text-blue-200 mb-2">➕ Create Account</p>
                <p className="text-blue-700 dark:text-blue-300">Click "Add User" button to create new accounts. Choose their role (Admin, Manager, or Cashier) to set their permissions.</p>
              </div>
              <div className="bg-white dark:bg-blue-950/30 rounded-lg p-4">
                <p className="font-semibold text-blue-900 dark:text-blue-200 mb-2">🔑 Reset Password</p>
                <p className="text-blue-700 dark:text-blue-300">Click "Reset Password" next to any user to change their password if they forget it.</p>
              </div>
              <div className="bg-white dark:bg-blue-950/30 rounded-lg p-4">
                <p className="font-semibold text-blue-900 dark:text-blue-200 mb-2">🗑️ Delete Account</p>
                <p className="text-blue-700 dark:text-blue-300">Click the red "Delete" button to remove an account. The user won't be able to log in anymore.</p>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* PWA Install Section */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-2">📱 Install App</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Install Whiskey Ballet as a standalone app for faster access, 100% offline support, and a native app experience on any device.
            </p>
            <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">
                🌟 Benefits of installing:
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1.5 list-none">
                <li className="flex items-start gap-2"><span>✅</span><span><strong>100% Offline</strong> - Works without internet after installation</span></li>
                <li className="flex items-start gap-2"><span>⚡</span><span><strong>Lightning Fast</strong> - Instant loading from local cache</span></li>
                <li className="flex items-start gap-2"><span>🖥️</span><span><strong>Desktop Shortcut</strong> - Launch like a native app</span></li>
                <li className="flex items-start gap-2"><span>💾</span><span><strong>Local Storage</strong> - All data stored on your device</span></li>
                <li className="flex items-start gap-2"><span>🖨️</span><span><strong>Print Support</strong> - Connect to any receipt printer</span></li>
                <li className="flex items-start gap-2"><span>🔒</span><span><strong>Private & Secure</strong> - No cloud, no data leaves your device</span></li>
                <li>Full-screen app experience</li>
              </ul>
            </div>
            <PWAInstallPrompt showButton={true} />
          </div>

          {/* User Management Section */}
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-foreground">User Management</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage users, roles, and permissions
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCredentialsModal(true)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors font-medium flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Credentials
                </button>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  Add User
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Branch
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
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                            : user.role === 'manager'
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        }`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {user.branchId ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                              {branches.find(b => b.id === user.branchId)?.name || 'Unknown Branch'}
                            </span>
                            {user.role === 'cashier' && (
                              <button
                                onClick={() => {
                                  setSelectedUser(user)
                                  setSelectedBranch(user.branchId || "")
                                  setShowBranchModal(true)
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                title="Change branch"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        ) : user.role === 'cashier' ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 flex items-center gap-1">
                              ⚠️ No branch
                            </span>
                            <button
                              onClick={() => {
                                setSelectedUser(user)
                                setSelectedBranch(user.branchId || "")
                                setShowBranchModal(true)
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              Assign
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setShowPasswordModal(true)
                          }}
                          className="text-primary hover:text-primary/80 font-medium"
                        >
                          🔑 Reset Password
                        </button>
                        {user.role === 'cashier' && (
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowPermissionsModal(true)
                            }}
                            className="text-primary hover:text-primary/80 font-medium"
                          >
                            🔐 Permissions
                          </button>
                        )}
                        {user.email !== currentUser?.email && user.isActive && (
                          <button
                            onClick={() => {
                              setUserToDeactivate(user)
                              setShowDeactivateModal(true)
                            }}
                            className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg font-medium transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">
              Change Password for {selectedUser?.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="text-green-600 dark:text-green-400 text-sm">
                  {success}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePasswordChange}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? "Changing..." : "Change Password"}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setNewPassword("")
                  setConfirmPassword("")
                  setError("")
                  setSuccess("")
                }}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-foreground mb-4">Add New User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showAddUserPassword ? "text" : "password"}
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddUserPassword(!showAddUserPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showAddUserPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Branch Selection - Only for Cashiers */}
              {newUserData.role === 'cashier' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Assign to Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUserData.branchId}
                    onChange={(e) => setNewUserData({ ...newUserData, branchId: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required={newUserData.role === 'cashier'}
                  >
                    <option value="">-- Select Branch --</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.location ? `(${branch.location})` : ''}
                      </option>
                    ))}
                  </select>
                  {branches.length === 0 && (
                    <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠️ No branches available. Please create a branch first in the Branches page.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="text-green-600 dark:text-green-400 text-sm">
                  {success}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddUser}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create User"}
              </button>
              <button
                onClick={() => {
                  setShowAddUserModal(false)
                  setNewUserData(DEFAULT_USER_DATA)
                  setError("")
                  setSuccess("")
                }}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal - Placeholder for future implementation */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">
              Manage Permissions for {selectedUser?.name}
            </h3>
            
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Configure what {selectedUser?.name} can access in the system
              </p>
              
              {/* Permission toggles would go here */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" defaultChecked />
                  <span className="text-sm text-foreground">View Reports</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" defaultChecked />
                  <span className="text-sm text-foreground">Manage Inventory</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" defaultChecked />
                  <span className="text-sm text-foreground">Manage Customers</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-sm text-foreground">View Dashboard</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPermissionsModal(false)
                  setSuccess("Note: Permission management UI is ready. Backend implementation for granular permissions will be added in a future update. Currently, admin has full access and cashier has limited access based on role.")
                  setTimeout(() => setSuccess(""), 5000)
                }}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Save Permissions
              </button>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate User Confirmation Modal */}
      {showDeactivateModal && userToDeactivate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Delete Account</h3>
            </div>
            
            <p className="text-foreground mb-4">
              Are you sure you want to delete <strong className="text-red-600 dark:text-red-400">{userToDeactivate.name}'s</strong> account?
            </p>
            
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                <strong>⚠️ Important:</strong>
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>This user will no longer be able to log in</li>
                <li>They will lose access to all system features</li>
                <li>You can reactivate them later if needed</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false)
                  setUserToDeactivate(null)
                }}
                className="flex-1 px-4 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeactivateUser(userToDeactivate.id)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Credentials Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-foreground">All User Credentials</h3>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>🔒 Security Note:</strong> Keep this information secure. Passwords are hashed and cannot be retrieved, only reset.
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div key={user.id} className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                      user.role === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {user.role === 'admin' ? 'Administrator' : user.role === 'manager' ? 'Manager' : 'Cashier'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Assignment Modal */}
      {showBranchModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl border-2 border-border max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">
              {selectedUser.branchId ? '🏢 Change Branch Assignment' : '🏢 Assign Branch'}
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>User:</strong> {selectedUser.name} ({selectedUser.email})
              </p>
              {selectedUser.branchId && (
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  <strong>Current Branch:</strong> {branches.find(b => b.id === selectedUser.branchId)?.name || 'Unknown'}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select Branch <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                >
                  <option value="">-- Select Branch --</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} {branch.location ? `(${branch.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  {success}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBranchModal(false)
                  setSelectedUser(null)
                  setSelectedBranch("")
                  setError("")
                  setSuccess("")
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBranchAssignment}
                disabled={loading || !selectedBranch}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Assigning...' : selectedUser.branchId ? 'Update Branch' : 'Assign Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
