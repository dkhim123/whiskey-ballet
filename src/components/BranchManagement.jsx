"use client"

import { useState, useEffect } from "react"
import { 
  createBranch, 
  getAllBranches, 
  updateBranch, 
  deleteBranch, 
  getBranchCashiers 
} from "../services/branchService"
import { fixCorruptedBranches } from "../utils/branchFixer"
import { Building2, Plus, Edit2, Trash2, Users, X, RefreshCw, AlertTriangle } from "lucide-react"

export default function BranchManagement({ currentUser }) {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [branchCashiers, setBranchCashiers] = useState({})
  
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  })

  // Load branches on mount
  useEffect(() => {
    loadBranches()
    
    // Listen for branch assignment changes from AdminSettings
    const handleBranchChange = () => {
      console.log('🔄 Branch assignment changed, reloading branches...')
      loadBranches()
    }
    
    window.addEventListener('branchAssignmentChanged', handleBranchChange)
    return () => window.removeEventListener('branchAssignmentChanged', handleBranchChange)
  }, [])

  const loadBranches = async () => {
    try {
      setLoading(true)
      const data = await getAllBranches()
      console.log('🏢 Loaded branches:', data.map(b => ({ id: b.id, name: b.name, idType: typeof b.id })))
      setBranches(data)
      
      // Load cashier counts for each branch
      const cashierCounts = {}
      for (const branch of data) {
        console.log('📊 Counting cashiers for branch:', branch.name, 'ID:', branch.id)
        const cashiers = await getBranchCashiers(branch.id)
        cashierCounts[branch.id] = cashiers.length
        console.log(`Branch "${branch.name}" has ${cashiers.length} cashiers`)
      }
      setBranchCashiers(cashierCounts)
      
      setError("")
    } catch (err) {
      console.error("Error loading branches:", err)
      setError("Failed to load branches. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  const handleAddBranch = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError("Branch name is required")
      return
    }

    try {
      setLoading(true)
      await createBranch({
        name: formData.name.trim(),
        description: formData.description.trim()
      })
      
      setSuccess(`Branch "${formData.name}" created successfully!`)
      setShowAddModal(false)
      setFormData({ name: "", description: "" })
      
      // Reload branches
      await loadBranches()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error creating branch:", err)
      setError("Failed to create branch: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEditBranch = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError("Branch name is required")
      return
    }

    try {
      setLoading(true)
      await updateBranch(selectedBranch.id, {
        name: formData.name.trim(),
        description: formData.description.trim()
      })
      
      setSuccess(`Branch "${formData.name}" updated successfully!`)
      setShowEditModal(false)
      setSelectedBranch(null)
      setFormData({ name: "", description: "" })
      
      // Reload branches
      await loadBranches()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error updating branch:", err)
      setError("Failed to update branch: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBranch = async () => {
    try {
      setLoading(true)
      await deleteBranch(selectedBranch.id)
      
      setSuccess(`Branch "${selectedBranch.name}" deleted successfully!`)
      setShowDeleteModal(false)
      setSelectedBranch(null)
      
      // Reload branches
      await loadBranches()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error("Error deleting branch:", err)
      setError("Failed to delete branch: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (branch) => {
    setSelectedBranch(branch)
    setFormData({
      name: branch.name,
      description: branch.description || ""
    })
    setShowEditModal(true)
  }

  const openDeleteModal = (branch) => {
    setSelectedBranch(branch)
    setShowDeleteModal(true)
  }

  const handleResetBranches = async () => {
    try {
      setLoading(true)
      setError("")
      
      const result = await fixCorruptedBranches()
      
      if (result.success) {
        setSuccess("✅ Branch data reset successfully! You can now create fresh branches.")
        setShowResetModal(false)
        
        // Reload branches (should be empty now)
        await loadBranches()
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(""), 5000)
      } else {
        setError("Failed to reset branches: " + result.errors.join(", "))
      }
    } catch (err) {
      console.error("Error resetting branches:", err)
      setError("Failed to reset branches: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Branch Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your business locations and assign cashiers to branches
          </p>
        </div>
        <div className="flex gap-2">
          {branches.length > 0 && (
            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 font-medium"
              title="Reset all branches (fixes corrupted data)"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Branches
            </button>
          )}
          <button
            onClick={() => {
              setFormData({ name: "", description: "" })
              setShowAddModal(true)
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
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

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-3">
          ℹ️ What are Branches?
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white dark:bg-blue-950/30 rounded-lg p-4">
            <p className="font-semibold text-blue-900 dark:text-blue-200 mb-2">🏢 Multiple Locations</p>
            <p className="text-blue-700 dark:text-blue-300">
              If you have shops in different locations (e.g., Downtown, Uptown, Airport), create a branch for each one.
            </p>
          </div>
          <div className="bg-white dark:bg-blue-950/30 rounded-lg p-4">
            <p className="font-semibold text-blue-900 dark:text-blue-200 mb-2">👥 Assign Staff</p>
            <p className="text-blue-700 dark:text-blue-300">
              Each manager and cashier can be assigned to a specific branch. This helps you track operations per location.
            </p>
          </div>
        </div>
      </div>

      {/* Branches List */}
      {loading && branches.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading branches...</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-foreground mb-2">No Branches Yet</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first branch location.
          </p>
          <button
            onClick={() => {
              setFormData({ name: "", description: "" })
              setShowAddModal(true)
            }}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Create First Branch
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{branch.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {branch.description || "No description"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Users className="w-4 h-4" />
                <span>{branchCashiers[branch.id] || 0} staff member{branchCashiers[branch.id] !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(branch)}
                  className="flex-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => openDeleteModal(branch)}
                  className="flex-1 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">Add New Branch</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBranch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Downtown Branch"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Main city center location"
                  rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {showEditModal && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">Edit Branch</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditBranch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Downtown Branch"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Main city center location"
                  rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Updating..." : "Update Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">Delete Branch</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-foreground mb-6">
              Are you sure you want to delete <strong>"{selectedBranch.name}"</strong>?
            </p>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ <strong>Warning:</strong> Staff (managers and cashiers) assigned to this branch will need to be reassigned.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBranch}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Deleting..." : "Delete Branch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Branches Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                Reset All Branches
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-foreground">
                This will completely reset your branch data. Use this if you're experiencing errors or corrupted data.
              </p>

              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="text-sm text-orange-800 dark:text-orange-200 font-semibold mb-2">
                  ⚠️ This will:
                </p>
                <ul className="text-sm text-orange-700 dark:text-orange-300 list-disc list-inside space-y-1">
                  <li>Delete ALL existing branches</li>
                  <li>Clear all staff (manager and cashier) branch assignments</li>
                  <li>Reset branch storage systems</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ✓ After reset, you can create fresh branches with proper structure.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleResetBranches}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Resetting..." : "Reset Branches"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
