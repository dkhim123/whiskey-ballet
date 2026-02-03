"use client"

import { useState, useEffect, useRef } from "react"
import { Package, Table as TableIcon, Plus, X } from "lucide-react"
import TopBar from "../components/TopBar"
import InventoryTable from "../components/InventoryTable"
import BarcodeModal from "../components/BarcodeModal"
import EditProductModal from "../components/EditProductModal"
import AddProductModal from "../components/AddProductModal"
import StockAdjustmentModal from "../components/StockAdjustmentModal"
import StockCountModal from "../components/StockCountModal"
import InventoryCSVUpload from "../components/InventoryCSVUpload"
import Pagination from "../components/Pagination"
import BranchSelector from "../components/BranchSelector"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToInventory, subscribeToInventoryByBranch } from "../services/realtimeListeners"
import { logActivity, ACTIVITY_TYPES } from "../utils/activityLog"
import { useDebounce } from "../hooks/useDebounce"
import { readSharedData, writeSharedData } from "../utils/storage"
import { inventoryDocId } from "../utils/firebaseStorageOnline"
import { getAllBranches } from "../services/branchService"

const CATEGORIES = ["All", "Red Wine", "White Wine", "Rosé Wine", "Sparkling Wine", "Whisky", "Vodka", "Rum", "Gin", "Tequila", "Brandy", "Liqueur", "Beer", "Spirits", "Mixers", "Other"]
const EXPIRY_FILTERS = ["All", "Expired", "Expiring Soon (7 days)", "Valid"]
const STOCK_FILTERS = ["All Stock", "Low Stock", "Out of Stock", "In Stock"]

export default function InventoryPage({ onInventoryChange, currentUser }) {
  const isAdminReadOnly = currentUser?.role === 'admin'
  // Manager and cashier are branch-scoped: they only see and edit their branch. Admin can switch branches.
  const isBranchScopedRole = currentUser?.role === 'cashier' || currentUser?.role === 'manager'
  const [inventory, setInventory] = useState([])
  const [allInventory, setAllInventory] = useState([]) // Store all inventory for admin
  const [selectedBranch, setSelectedBranch] = useState(() => {
    if (typeof window === 'undefined') return currentUser?.role === 'admin' ? '' : (currentUser?.branchId || '')
    try {
      return currentUser?.role === 'admin'
        ? (localStorage.getItem('adminSelectedBranch') || '')
        : (currentUser?.branchId || '')
    } catch {
      return currentUser?.role === 'admin' ? '' : (currentUser?.branchId || '')
    }
  })
  const isSavingRef = useRef(false) // Track if we're currently saving
  const branchListCacheRef = useRef({ list: null, at: 0 })
  const BRANCH_CACHE_MS = 60000 // 60s cache for getAllBranches
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [showStockCountModal, setShowStockCountModal] = useState(false)
  const [showCSVUpload, setShowCSVUpload] = useState(false)
  // Lock branch when CSV modal opens so import always goes to the branch user had selected
  const [csvImportTargetBranch, setCsvImportTargetBranch] = useState(null)
  // Lock branch when Add Product modal opens so new product is always added to the branch user had selected
  const addProductTargetBranchRef = useRef(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedExpiryFilter, setSelectedExpiryFilter] = useState("All")
  const [selectedStockFilter, setSelectedStockFilter] = useState("All Stock")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  // Bulk selection for delete (branch manager)
  const [selectedIds, setSelectedIds] = useState([])

  // Clear selection when branch or inventory view changes
  useEffect(() => {
    setSelectedIds([])
  }, [selectedBranch])

  // Load inventory from shared storage
  const loadInventory = async () => {
    // Skip loading if we're currently saving to avoid race condition
    if (isSavingRef.current) {
      console.log('⏭️ InventoryPage: Skipping load while save in progress')
      return
    }
    
    try {
      const userId = currentUser?.id
      if (!userId) return

      const adminId = getAdminIdForStorage(currentUser)
      console.log(`🔍 InventoryPage: Loading inventory for user ${currentUser.name} (ID: ${userId}, Role: ${currentUser.role}, AdminId: ${adminId})`)
      
      const sharedData = await readSharedData(adminId)
      const inventoryData = sharedData.inventory || []
      console.log(`📦 InventoryPage: Loaded ${inventoryData.length} products for adminId: ${adminId}`)
      
      // Store all inventory for admin
      setAllInventory(inventoryData)
      
      // Normalize branch IDs for comparison
      const normalizeBranchId = (id) => (id != null ? String(id).trim().toLowerCase() : '')
      
      // Filter by branch for cashiers and managers (their branch only); admin uses selected branch or all
      let filteredInventory = inventoryData
      if (isBranchScopedRole) {
        // Cashiers and managers can only see their own branch inventory
        const userBranch = currentUser.branchId
        if (!userBranch) {
          console.warn(`⚠️ ${currentUser.role} ${currentUser.name} has NO branchId assigned! Cannot filter inventory.`)
          filteredInventory = []
        } else {
          const normalizedUserBranch = normalizeBranchId(userBranch)
          filteredInventory = inventoryData.filter(item => {
            const itemBranchNorm = normalizeBranchId(item.branchId)
            const matches = itemBranchNorm && itemBranchNorm === normalizedUserBranch
            if (!item.branchId) {
              console.log(`⚠️ Item "${item.name}" has NO branchId - excluding from ${currentUser.role} view`)
            }
            return matches
          })
          console.log(`👤 ${currentUser.role} ${currentUser.name} viewing ${filteredInventory.length} products from branch ${userBranch}`)
          console.log(`   Total inventory: ${inventoryData.length}, Unassigned: ${inventoryData.filter(i => !i.branchId).length}`)
        }
      } else if (currentUser.role === 'admin' && selectedBranch) {
        // Admin viewing specific branch (normalized comparison)
        const normalizedSelectedBranch = normalizeBranchId(selectedBranch)
        filteredInventory = inventoryData.filter(item => normalizeBranchId(item.branchId) === normalizedSelectedBranch)
        console.log(`👨‍💼 Admin viewing ${filteredInventory.length} products from branch ${selectedBranch}`)
      } else if (currentUser.role === 'admin') {
        // Admin viewing all branches
        console.log(`👨‍💼 Admin viewing all ${filteredInventory.length} products across all branches`)
      }
      
      setInventory(filteredInventory)
      
      // Also update parent component if callback provided
      if (onInventoryChange) {
        onInventoryChange(filteredInventory)
      }
    } catch (error) {
      console.error("Error loading inventory:", error)
    }
  }

  // Save inventory to shared storage
  const saveInventory = async (updatedInventory) => {
    try {
      isSavingRef.current = true // Set flag to prevent concurrent loads
      
      const userId = currentUser?.id
      if (!userId) {
        console.error("❌ InventoryPage: No user ID, cannot save")
        isSavingRef.current = false
        return false
      }

      const adminId = getAdminIdForStorage(currentUser)

      // Read only inventory (avoids 9 Firestore reads) so delete/save is fast
      const sharedData = await readSharedData(adminId, true, { stores: ['inventory'] })
      
      // CRITICAL: When saving, merge with all inventory from other branches
      // Only update items from the branch being edited
      const allInventoryItems = sharedData.inventory || []
      
      // Determine which branch we're editing (manager/cashier = their branch only; admin = selected branch)
      const editingBranch = isBranchScopedRole ? currentUser.branchId : selectedBranch
      
      // CRITICAL: Manager/cashier must have branchId so we never overwrite another branch
      if (isBranchScopedRole && !editingBranch) {
        console.error(`🚨 CRITICAL: ${currentUser.role} ${currentUser.name} has NO branchId! Cannot save inventory safely.`)
        alert(`ERROR: Your account is missing branch assignment. Please contact admin or logout and login again. Data was NOT saved to prevent loss.`)
        isSavingRef.current = false
        return false
      }
      
      console.log(`💾 Saving inventory for ${currentUser.role} "${currentUser.name}" editing branch: "${editingBranch || 'ALL'}"`)
      
      // DEBUG: Log what's in the database before filtering
      console.log(`📚 Database has ${allInventoryItems.length} total items before merge:`)
      allInventoryItems.forEach((item, idx) => {
        if (idx < 5) { // Only show first 5
          console.log(`   ${idx + 1}. ${item.name} - branchId: ${item.branchId}, id: ${item.id}`)
        }
      })
      if (allInventoryItems.length > 5) console.log(`   ... and ${allInventoryItems.length - 5} more`)
      
      // Filter out items from the editing branch (we'll replace them).
      // Match by both branch ID and branch name so DB entries with name "CBD" vs id "branch_xxx" are handled.
      const normalizeBranchId = (id) => (id != null ? String(id).trim().toLowerCase() : '')
      const normalizedEditingBranch = normalizeBranchId(editingBranch)
      let branchList = []
      const now = Date.now()
      if (branchListCacheRef.current.list && (now - branchListCacheRef.current.at) < BRANCH_CACHE_MS) {
        branchList = branchListCacheRef.current.list
      } else {
        try {
          branchList = (await getAllBranches()) || []
          branchListCacheRef.current = { list: branchList, at: now }
        } catch (e) {
          branchList = branchListCacheRef.current.list || []
        }
      }
      const editingMeta = branchList.find((b) => normalizeBranchId(b.id) === normalizedEditingBranch)
      const normalizedEditingName = editingMeta?.name ? normalizeBranchId(editingMeta.name) : ''
      const isEditingBranchItem = (item) => {
        const n = normalizeBranchId(item?.branchId)
        return n === normalizedEditingBranch || (normalizedEditingName && n === normalizedEditingName)
      }

      let otherBranchItems = editingBranch
        ? allInventoryItems.filter((item) => !isEditingBranchItem(item))
        : (currentUser.role === 'admin' ? [] : allInventoryItems) // only admin can have no branch (all-branches merge)

      // Get existing deleted items from storage (preserve from all branches)
      const existingDeletedItems = allInventoryItems.filter((item) => item.deletedAt != null)

      // Get non-deleted items from updatedInventory; in single-branch mode force every item to editingBranch (prevents cross-branch leak)
      const nonDeletedItems = updatedInventory
        .filter((item) => !item.deletedAt)
        .map((item) => (editingBranch ? { ...item, branchId: editingBranch } : item))

      // Get newly deleted items; in single-branch mode force branchId to editing branch
      const newlyDeletedItems = updatedInventory
        .filter((item) => item.deletedAt != null)
        .map((item) => (editingBranch ? { ...item, branchId: editingBranch } : item))

      // Preserve deleted items: keep deleted from OTHER branches; from editing branch keep only if not in updated list (by id)
      const preservedDeletedItems = existingDeletedItems.filter(
        (existing) => !isEditingBranchItem(existing) || !updatedInventory.some((updated) => updated.id === existing.id)
      )
      
      const allItems = [
        ...otherBranchItems, // Items from other branches (unchanged)
        ...nonDeletedItems, // Active items from current branch
        ...newlyDeletedItems, // Newly deleted items
        ...preservedDeletedItems // Previously deleted items
      ]
      
      // When saving a single branch, pre-compute Firestore doc IDs to delete so write path skips getDocs
      let inventoryIdsToDelete = null
      if (editingBranch) {
        const idsToKeepSet = new Set(allItems.map((item) => inventoryDocId(item)))
        inventoryIdsToDelete = allInventoryItems
          .filter((item) => isEditingBranchItem(item))
          .map((item) => inventoryDocId(item))
          .filter((docId) => !idsToKeepSet.has(docId))
      }

      await writeSharedData(
        { ...sharedData, inventory: allItems },
        adminId,
        { inventoryIdsToDelete, writeOnlyStores: ['inventory'] }
      )

      setAllInventory(allItems)
      setInventory(updatedInventory)
      if (onInventoryChange) {
        onInventoryChange(updatedInventory)
      }

      isSavingRef.current = false
      return true
    } catch (error) {
      console.error("❌ Error saving inventory:", error)
      isSavingRef.current = false // Clear flag on error too
      return false
    }
  }

  // Real-time Firestore inventory listener (branch-scoped for cashier/manager so Firestore rules allow list)
  useEffect(() => {
    if (!currentUser) return;
    const adminId = getAdminIdForStorage(currentUser);
    const normalizeBranchId = (id) => (id != null ? String(id).trim().toLowerCase() : '')
    const useBranchScope = isBranchScopedRole && currentUser.branchId
    const branchIdForQuery = useBranchScope ? currentUser.branchId : (currentUser.role === 'admin' && selectedBranch ? selectedBranch : null)

    const onData = (data) => {
      const activeOnly = (data || []).filter(item => !item.deletedAt);
      setAllInventory(activeOnly);
      let filteredInventory = activeOnly;
      if (isBranchScopedRole) {
        const userBranch = currentUser.branchId;
        if (!userBranch) {
          filteredInventory = [];
        } else {
          const normalizedUserBranch = normalizeBranchId(userBranch);
          filteredInventory = activeOnly.filter(item => normalizeBranchId(item.branchId) === normalizedUserBranch);
        }
      } else if (currentUser.role === 'admin' && selectedBranch) {
        const normalizedSelectedBranch = normalizeBranchId(selectedBranch);
        filteredInventory = activeOnly.filter(item => normalizeBranchId(item.branchId) === normalizedSelectedBranch);
      }
      setInventory(filteredInventory);
      if (onInventoryChange) {
        onInventoryChange(filteredInventory);
      }
    }

    const unsub = branchIdForQuery
      ? subscribeToInventoryByBranch(adminId, branchIdForQuery, onData)
      : subscribeToInventory(adminId, onData)
    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, [currentUser, selectedBranch]); // Stable length: avoid adding/removing deps so React does not warn

  // Debounce search for better performance
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Helper functions for expiry status
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0
  }

  const isValidProduct = (expiryDate) => {
    if (!expiryDate) return true // Products without expiry are considered valid
    return !isExpired(expiryDate) && !isExpiringSoon(expiryDate)
  }

  const lowStockItems = inventory.filter((item) => item.quantity <= item.reorderLevel)
  const expiredItems = inventory.filter((item) => isExpired(item.expiryDate))
  const expiringSoonItems = inventory.filter((item) => isExpiringSoon(item.expiryDate))

  const filteredInventory = inventory.filter((item) => {
    // Filter out soft-deleted items
    if (item.deletedAt) return false
    
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory
    const matchesSearch = 
      item.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(debouncedSearch.toLowerCase())
    
    // Apply expiry filter
    let matchesExpiry = true
    if (selectedExpiryFilter === "Expired") {
      matchesExpiry = isExpired(item.expiryDate)
    } else if (selectedExpiryFilter === "Expiring Soon (7 days)") {
      matchesExpiry = isExpiringSoon(item.expiryDate)
    } else if (selectedExpiryFilter === "Valid") {
      matchesExpiry = isValidProduct(item.expiryDate)
    }
    
    // Apply stock filter
    let matchesStock = true
    if (selectedStockFilter === "Low Stock") {
      matchesStock = item.quantity > 0 && item.quantity <= item.reorderLevel
    } else if (selectedStockFilter === "Out of Stock") {
      matchesStock = item.quantity === 0
    } else if (selectedStockFilter === "In Stock") {
      matchesStock = item.quantity > item.reorderLevel
    }
    
    return matchesCategory && matchesSearch && matchesExpiry && matchesStock
  })

  // Pagination logic
  const totalItems = filteredInventory.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInventory = filteredInventory.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  const handleFilterChange = (setter) => (value) => {
    setter(value)
    setCurrentPage(1)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const handleEditClick = (product) => {
    setSelectedProduct(product)
    setShowEditModal(true)
  }

  const handleBarcodeClick = (product) => {
    setSelectedProduct(product)
    setShowBarcodeModal(true)
  }

  const handleAdjustmentClick = (product) => {
    setSelectedProduct(product)
    setShowAdjustmentModal(true)
  }

  const handleSaveAdjustment = async (adjustment) => {
    try {
      if (isAdminReadOnly) {
        alert('Admin is monitor-only. Stock adjustments are disabled.')
        return
      }
      const userId = currentUser?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      const adminId = getAdminIdForStorage(currentUser)
      console.log(`📊 InventoryPage: Saving stock adjustment for ${currentUser.name} (AdminId: ${adminId})`)
      
      // Read current shared data
      const sharedData = await readSharedData(adminId)
      
      // Update product quantity
      const updatedInventory = inventory.map((item) => 
        item.id === adjustment.productId 
          ? { ...item, quantity: adjustment.newStock }
          : item
      )

      // Add adjustment to history
      const stockAdjustments = sharedData.stockAdjustments || []
      stockAdjustments.push(adjustment)

      // Save everything to shared storage
      await writeSharedData({
        ...sharedData,
        inventory: updatedInventory,
        stockAdjustments: stockAdjustments
      }, adminId)

      // Log activity
      const product = inventory.find(item => item.id === adjustment.productId)
      await logActivity(
        ACTIVITY_TYPES.STOCK_ADJUSTED,
        `Stock adjusted: ${product?.name} from ${adjustment.oldStock} to ${adjustment.newStock}`,
        {
          productId: adjustment.productId,
          productName: product?.name,
          oldStock: adjustment.oldStock,
          newStock: adjustment.newStock,
          reason: adjustment.reason
        },
        currentUser
      )

      // Update local state
      setInventory(updatedInventory)
      if (onInventoryChange) {
        onInventoryChange(updatedInventory)
      }
      setShowAdjustmentModal(false)
      
      console.log(`✅ InventoryPage: Stock adjustment saved successfully`)
      alert(`Stock adjustment applied successfully! New stock: ${adjustment.newStock}`)
    } catch (error) {
      console.error('Error saving adjustment:', error)
      alert('Failed to save stock adjustment')
    }
  }

  const handleSaveProduct = async (updatedProduct) => {
    if (isAdminReadOnly) {
      alert('Admin is monitor-only. Editing products is disabled.')
      return
    }
    // Preserve branchId from original product when updating
    const originalProduct = inventory.find(item => item.id === updatedProduct.id)
    const productToSave = {
      ...updatedProduct,
      branchId: originalProduct?.branchId || currentUser?.branchId // Preserve or set (manager/cashier use their branchId)
    }
    
    const updatedInventory = inventory.map((item) => (item.id === productToSave.id ? productToSave : item))
    const saved = await saveInventory(updatedInventory)
    
    if (saved) {
      setShowEditModal(false)
      
      // Log activity
      logActivity(
        ACTIVITY_TYPES.PRODUCT_UPDATED || 'product-updated',
        `Updated product: ${updatedProduct.name}`,
        {
          productId: updatedProduct.id,
          productName: updatedProduct.name,
          category: updatedProduct.category
        },
        currentUser
      )
      
      alert(`Product "${updatedProduct.name}" has been updated successfully`)
    } else {
      alert('Failed to save changes. Please try again.')
    }
  }

  // Unique row key per item (branchId + id) so selection never affects same-id items in other branches
  const getItemRowKey = (item) => `${item?.branchId ?? 'u'}_${item?.id ?? ''}`

  const handleDeleteProduct = async (productId) => {
    if (isAdminReadOnly) {
      alert('Admin is monitor-only. Deleting products is disabled.')
      return
    }
    const product = inventory.find(item => item.id === productId)
    if (!product) {
      console.error(`❌ Product ${productId} not found`)
      return
    }

    const updatedInventory = inventory.map(item =>
      item.id === productId
        ? { ...item, deletedAt: new Date().toISOString(), deletedBy: currentUser?.id }
        : item
    )

    console.log(`🗑️ InventoryPage: Soft deleting product ${productId} (${product.name})`)
    const saved = await saveInventory(updatedInventory)

    if (saved) {
      setShowEditModal(false)
      setSelectedIds(prev => prev.filter(k => k !== getItemRowKey(product)))

      logActivity(
        ACTIVITY_TYPES.PRODUCT_DELETED || 'product-deleted',
        `Deleted product: ${product.name}`,
        { productId: productId, productName: product.name, category: product.category },
        currentUser
      )
      alert(`Product "${product.name}" has been deleted successfully`)
    } else {
      console.error(`❌ Failed to delete product ${productId}`)
      alert('Failed to delete product. Please try again.')
    }
  }

  // Bulk delete: soft-delete only the exact selected rows (match by row key so no cross-branch mistakes)
  const handleBulkDeleteSelected = async () => {
    if (isAdminReadOnly || selectedIds.length === 0) {
      if (selectedIds.length === 0) alert('No items selected. Select items using the checkboxes first.')
      return
    }
    if (!confirm(`Delete ${selectedIds.length} selected item(s)? They will be removed from this branch.`)) return

    const updatedInventory = inventory.map(item => {
      const rowKey = getItemRowKey(item)
      return selectedIds.includes(rowKey)
        ? { ...item, deletedAt: new Date().toISOString(), deletedBy: currentUser?.id }
        : item
    })
    const saved = await saveInventory(updatedInventory)
    if (saved) {
      setSelectedIds([])
      logActivity(ACTIVITY_TYPES.PRODUCT_DELETED || 'product-deleted', `Bulk deleted ${selectedIds.length} products`, { count: selectedIds.length }, currentUser)
      alert(`${selectedIds.length} item(s) deleted successfully.`)
    } else {
      alert('Failed to delete. Please try again.')
    }
  }

  // Delete all inventory in the currently selected branch (admin branch manager)
  const handleDeleteAllInBranch = async () => {
    if (isAdminReadOnly) return
    const editingBranch = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId
    if (!editingBranch) {
      alert('Please select a branch first.')
      return
    }
    const branchItemCount = inventory.length
    if (branchItemCount === 0) {
      alert('This branch has no inventory to delete.')
      return
    }
    const branchName = editingBranch
    if (!confirm(`Delete ALL ${branchItemCount} items in branch "${branchName}"? They will be removed from this branch. You can re-import or add products later.`)) return

    const now = new Date().toISOString()
    const updatedInventory = inventory.map(item => ({ ...item, deletedAt: now, deletedBy: currentUser?.id }))
    const saved = await saveInventory(updatedInventory)
    if (saved) {
      setSelectedIds([])
      logActivity(ACTIVITY_TYPES.PRODUCT_DELETED || 'product-deleted', `Deleted all ${branchItemCount} products in branch ${branchName}`, { branchId: editingBranch, count: branchItemCount }, currentUser)
      alert(`All ${branchItemCount} item(s) in branch "${branchName}" have been deleted.`)
    } else {
      alert('Failed to delete branch inventory. Please try again.')
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleSelectAllOnPage = () => {
    setSelectedIds(paginatedInventory.map(item => getItemRowKey(item)))
  }

  const handleClearSelection = () => {
    setSelectedIds([])
  }

  const handleAddProduct = async (newProduct) => {
    if (isAdminReadOnly) {
      alert('Admin is monitor-only. Adding products is disabled.')
      return
    }

    // CRITICAL: Use allInventory (all branches) to calculate max ID to prevent duplicate IDs across branches
    const inventoryToCheck = currentUser?.role === 'admin' ? allInventory : allInventory
    const maxId = Math.max(...inventoryToCheck.map((p) => p.id), 0)
    // Use branch locked when Add modal was opened so product goes to the right branch even if user changed dropdown
    const branchIdForProduct = addProductTargetBranchRef.current ?? (currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId)
    if (currentUser?.role === 'admin' && !branchIdForProduct) {
      alert('Please select a branch in the filter above, then open Add Product again.')
      return
    }
    const productToAdd = {
      ...newProduct,
      id: maxId + 1,
      barcode: `12345678900${maxId + 1}`,
      branchId: branchIdForProduct, // Associate product with the chosen/current branch
    }
    
    console.log(`➕ InventoryPage: Adding new product: ${newProduct.name} to branch ${branchIdForProduct}, ID: ${productToAdd.id}`)
    console.log(`   Max ID from ${inventoryToCheck.length} total products: ${maxId}`)
    const saved = await saveInventory([...inventory, productToAdd])
    
if (saved) {
      addProductTargetBranchRef.current = null
      setShowAddModal(false)

      // Log activity
      logActivity(
        ACTIVITY_TYPES.PRODUCT_ADDED,
        `Added new product: ${newProduct.name}`,
        {
          productId: productToAdd.id,
          productName: newProduct.name,
          quantity: newProduct.quantity,
          category: newProduct.category
        },
        currentUser
      )
      
      console.log(`✅ InventoryPage: Product ${productToAdd.id} added successfully`)
      alert(`Product "${newProduct.name}" has been added successfully`)
    } else {
      alert('Failed to add product. Please try again.')
    }
  }

  const handleSaveStockCount = async (updatedInventory) => {
    try {
      if (isAdminReadOnly) {
        alert('Admin is monitor-only. Stock count is disabled.')
        return
      }
      const userId = currentUser?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      console.log(`📊 InventoryPage: Saving stock count with ${updatedInventory.length} products`)
      await saveInventory(updatedInventory)

      setShowStockCountModal(false)
      alert('Stock count completed successfully!')
    } catch (error) {
      console.error('Error saving stock count:', error)
      alert('Failed to save stock count. Please try again.')
    }
  }

  const exportToCSV = () => {
    const headers = ["Name", "SKU", "Category", "Stock", "Reorder Level", "Price"]
    const rows = filteredInventory.map(item => [
      item.name,
      item.sku,
      item.category || "Other",
      item.quantity,
      item.reorderLevel,
      item.price
    ])
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }



  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Inventory Management"
        subtitle={isAdminReadOnly ? "Track stock levels across branches (read-only)" : "Track stock levels and manage products"}
        actions={[
          ...(isAdminReadOnly
            ? []
            : [
          <button
            key="stock-count"
            onClick={() => setShowStockCountModal(true)}
            className="group relative px-5 py-3.5 bg-linear-to-b from-white/90 to-white/70 dark:from-slate-800/90 dark:to-slate-800/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-xl font-semibold text-slate-700 dark:text-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-bold leading-tight">Stock Count</div>
                <div className="text-xs opacity-70 font-normal">Verify inventory</div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-xl bg-linear-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>,
            ]),
          <button
            key="export"
            onClick={exportToCSV}
            className="group relative px-5 py-3.5 bg-linear-to-b from-white/90 to-white/70 dark:from-slate-800/90 dark:to-slate-800/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-xl font-semibold text-slate-700 dark:text-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2.5">
              <TableIcon className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-bold leading-tight">Export CSV</div>
                <div className="text-xs opacity-70 font-normal">Download data</div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-xl bg-linear-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>,
          ...(isAdminReadOnly
            ? []
            : [
          <button
            key="csv-upload"
            onClick={() => {
              setCsvImportTargetBranch(currentUser?.role === 'admin' ? selectedBranch : (currentUser?.branchId ?? selectedBranch))
              setShowCSVUpload(true)
            }}
            disabled={currentUser?.role === "admin" && !selectedBranch}
            title={currentUser?.role === "admin" && !selectedBranch ? "Select a branch above first" : "Import to current branch"}
            className="group relative px-5 py-3.5 bg-linear-to-b from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 border border-blue-500/50 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100"
          >
            <div className="flex items-center gap-2.5">
              <TableIcon className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-bold leading-tight">Import CSV</div>
                <div className="text-xs opacity-90 font-normal">Import to selected branch</div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-xl bg-linear-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>,
          <button
            key="add"
            onClick={() => setShowAddModal(true)}
            className="group relative px-5 py-3.5 bg-linear-to-b from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 border border-blue-500/50 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2.5">
              <Plus className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-bold leading-tight">Add Product</div>
                <div className="text-xs opacity-90 font-normal">Create new item</div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-xl bg-linear-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>,
            ]),
        ]}
      />

      {/* Branch Filter - Admin Only */}
      {currentUser?.role === 'admin' && (
        <div className="px-6 py-4 bg-muted/30 border-b border-border">
          <BranchSelector
            currentUser={currentUser}
            selectedBranch={selectedBranch}
            onBranchChange={(branchId) => {
              setSelectedBranch(branchId)
              try {
                localStorage.setItem('adminSelectedBranch', branchId || '')
              } catch {}
              setCurrentPage(1) // Reset pagination
            }}
          />
        </div>
      )}

      {/* Cashier/Manager WITHOUT Branch - Critical Error */}
      {isBranchScopedRole && !currentUser.branchId && (
        <div className="px-6 py-4 bg-red-50 dark:bg-red-950/30 border-b-2 border-red-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xl font-bold">!</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-red-900 dark:text-red-200">
                ⚠️ Account Error: No Branch Assigned
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                You cannot add or view inventory without a branch assignment.
                <strong className="block mt-1">Action Required: Contact admin or logout and login again to fix this.</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Branch Info */}
      {currentUser?.role === 'cashier' && currentUser.branchId && (
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-900 dark:text-blue-300 font-medium">
              Viewing inventory for your branch
            </span>
          </div>
        </div>
      )}

      <div className="p-6 flex-1 overflow-auto">
        {/* Alert Cards - Compact and Clickable */}
        <div className="mb-4 flex flex-wrap gap-3">
          {/* Expired Products Alert */}
          {expiredItems.length > 0 && (
            <button
              onClick={() => setSelectedExpiryFilter("Expired")}
              className="flex items-center gap-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive rounded-lg px-3 py-2 transition-all cursor-pointer"
            >
              <span className="text-destructive font-semibold text-sm">⛔ {expiredItems.length} Expired</span>
            </button>
          )}

          {/* Expiring Soon Alert */}
          {expiringSoonItems.length > 0 && (
            <button
              onClick={() => setSelectedExpiryFilter("Expiring Soon (7 days)")}
              className="flex items-center gap-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 border border-yellow-500 rounded-lg px-3 py-2 transition-all cursor-pointer"
            >
              <span className="text-yellow-700 dark:text-yellow-500 font-semibold text-sm">⚠️ {expiringSoonItems.length} Expiring Soon</span>
            </button>
          )}

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <button
              onClick={() => {
                setSelectedExpiryFilter("All")
                setSelectedCategory("All")
                // We don't have a direct filter for low stock, but we can show all and user can see red indicators
              }}
              className="flex items-center gap-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/50 rounded-lg px-3 py-2 transition-all cursor-pointer"
            >
              <span className="text-destructive font-semibold text-sm">📦 {lowStockItems.length} Low Stock</span>
            </button>
          )}
        </div>

        {/* Filters Section */}
        <div className="mb-6 bg-card border-2 border-border rounded-lg p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              {/* Category Filter */}
              <div className="flex-1">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => handleFilterChange(setSelectedCategory)(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground font-semibold"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Stock Status Filter */}
              <div className="flex-1">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Stock Status</label>
                <select
                  value={selectedStockFilter}
                  onChange={(e) => handleFilterChange(setSelectedStockFilter)(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground font-semibold"
                >
                  {STOCK_FILTERS.map(filter => (
                    <option key={filter} value={filter}>{filter}</option>
                  ))}
                </select>
              </div>

              {/* Expiry Filter */}
              <div className="flex-1">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Expiry Status</label>
                <select
                  value={selectedExpiryFilter}
                  onChange={(e) => handleFilterChange(setSelectedExpiryFilter)(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground font-semibold"
                >
                  {EXPIRY_FILTERS.map(filter => (
                    <option key={filter} value={filter}>{filter}</option>
                  ))}
                </select>
              </div>
            </div>

          {/* Filter Stats */}
          <div className="flex gap-4 mt-3 text-sm flex-wrap">
            <span className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{paginatedInventory.length}</span> of{" "}
              <span className="font-semibold text-foreground">{filteredInventory.length}</span> filtered
              {filteredInventory.length !== inventory.length && (
                <span> (total: {inventory.length})</span>
              )}
            </span>
            {lowStockItems.length > 0 && (
              <span className="text-destructive font-semibold">
                • {lowStockItems.length} low stock
              </span>
            )}
            {expiredItems.length > 0 && (
              <span className="text-destructive font-semibold">
                • {expiredItems.length} expired
              </span>
            )}
            {expiringSoonItems.length > 0 && (
              <span className="text-yellow-600 font-semibold">
                • {expiringSoonItems.length} expiring soon
              </span>
            )}
          </div>
          </div>
        </div>

        {/* Bulk actions bar: selection and delete options (branch manager) */}
        {!isAdminReadOnly && (selectedIds.length > 0 || (currentUser?.role === 'admin' && selectedBranch)) && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-muted/40 border border-border rounded-xl mb-4">
            {selectedIds.length > 0 ? (
              <>
                <span className="text-sm font-medium text-foreground">
                  {selectedIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Deselect all
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 border border-destructive rounded-lg transition-colors"
                >
                  Delete selected
                </button>
              </>
            ) : null}
            {currentUser?.role === 'admin' && selectedBranch && inventory.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllInBranch}
                className="ml-auto px-3 py-1.5 text-sm font-medium text-destructive border border-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                title="Soft-delete all products in this branch"
              >
                Delete all in this branch ({inventory.length})
              </button>
            )}
          </div>
        )}

        <InventoryTable
          items={paginatedInventory}
          onEdit={isAdminReadOnly ? null : handleEditClick}
          onBarcode={handleBarcodeClick}
          onAdjust={isAdminReadOnly ? null : handleAdjustmentClick}
          branchId={isBranchScopedRole ? currentUser?.branchId : null}
          enableSelection={!isAdminReadOnly}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAllOnPage}
          onSelectNone={handleClearSelection}
          rowNumberStart={startIndex}
        />

        {/* Pagination */}
        {totalItems > 10 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>

      {showBarcodeModal && selectedProduct && (
        <BarcodeModal product={selectedProduct} onClose={() => setShowBarcodeModal(false)} />
      )}

      {!isAdminReadOnly && showEditModal && selectedProduct && (
        <EditProductModal
          product={selectedProduct}
          onSave={handleSaveProduct}
          onClose={() => setShowEditModal(false)}
          onDelete={handleDeleteProduct}
          onBarcode={handleBarcodeClick}
        />
      )}

      {!isAdminReadOnly && showAdjustmentModal && selectedProduct && (
        <StockAdjustmentModal
          product={selectedProduct}
          currentUser={currentUser}
          onSave={handleSaveAdjustment}
          onClose={() => setShowAdjustmentModal(false)}
        />
      )}

      {!isAdminReadOnly && showAddModal && (
        <AddProductModal onAdd={handleAddProduct} onClose={() => { addProductTargetBranchRef.current = null; setShowAddModal(false) }} />
      )}

      {!isAdminReadOnly && showStockCountModal && (
        <StockCountModal
          inventory={inventory}
          onSave={handleSaveStockCount}
          onClose={() => setShowStockCountModal(false)}
        />
      )}

      {/* CSV Upload Modal */}
      {!isAdminReadOnly && showCSVUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background border-2 border-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Import Inventory from CSV</h2>
              <button
                onClick={() => {
                  setShowCSVUpload(false)
                  setCsvImportTargetBranch(null)
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <InventoryCSVUpload
                currentUser={currentUser}
                selectedBranch={csvImportTargetBranch ?? selectedBranch}
                onInventoryUpdate={(newInventory, importBranch) => {
                  if (Array.isArray(newInventory) && newInventory.length >= 0) {
                    const normalizeBranchId = (id) => (id != null ? String(id).trim().toLowerCase() : '')
                    const active = newInventory.filter(item => !item.deletedAt)
                    setAllInventory(active)
                    let filtered = active
                    // Use importBranch from CSV component when provided; otherwise fall back to selected branch or user branch
                    const branchToFilter = importBranch ?? (currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId)
                    if (branchToFilter) {
                      const norm = normalizeBranchId(branchToFilter)
                      filtered = active.filter(item => normalizeBranchId(item.branchId) === norm)
                      console.log(`📋 CSV Import callback: Filtering ${active.length} active items by branch "${branchToFilter}" → ${filtered.length} items`)
                    } else if (isBranchScopedRole && currentUser.branchId) {
                      const norm = normalizeBranchId(currentUser.branchId)
                      filtered = active.filter(item => normalizeBranchId(item.branchId) === norm)
                    }
                    setInventory(filtered)
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
