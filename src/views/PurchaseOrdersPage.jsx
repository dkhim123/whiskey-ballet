"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToPurchaseOrders } from "../services/realtimeExtraListeners"
import { subscribeToSuppliers, subscribeToInventory } from "../services/realtimeListeners"
import { createUserSnapshot } from "../utils/userTracking"

const PO_STATUSES = ["draft", "ordered", "partially_received", "received", "cancelled"]
const STATUS_LABELS = {
  draft: "Draft",
  ordered: "Ordered",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled"
}
const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  ordered: "bg-blue-100 text-blue-800 border-blue-300",
  partially_received: "bg-yellow-100 text-yellow-800 border-yellow-300",
  received: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300"
}

export default function PurchaseOrdersPage({ currentUser, onInventoryChange }) {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [inventory, setInventory] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)
  const [filterStatus, setFilterStatus] = useState("all")

  // Load data from storage
  const loadData = async () => {
    try {
      const userId = currentUser?.id
      if (!userId) return

      // Load shared data (purchase orders, suppliers, and inventory)
      const adminId = getAdminIdForStorage(currentUser)
      console.log(`🔍 PurchaseOrdersPage: Loading data for user ${currentUser.name} (ID: ${userId}, Role: ${currentUser.role}, AdminId: ${adminId})`)
      
      const sharedData = await readSharedData(adminId)
      const poCount = sharedData.purchaseOrders?.length || 0
      console.log(`📦 PurchaseOrdersPage: Loaded ${poCount} purchase orders for adminId: ${adminId}`)
      
      // Debug: Log PO statuses
      if (poCount > 0) {
        const statusBreakdown = sharedData.purchaseOrders.reduce((acc, po) => {
          acc[po.status] = (acc[po.status] || 0) + 1
          return acc
        }, {})
        console.log(`📊 PO Status Breakdown:`, statusBreakdown)
      }
      
      setPurchaseOrders(sharedData.purchaseOrders || [])
      setSuppliers(sharedData.suppliers || [])
      setInventory(sharedData.inventory || [])
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  // Real-time Firestore suppliers, inventory, and purchaseOrders listeners
  useEffect(() => {
    if (!currentUser) return;
    const adminId = getAdminIdForStorage(currentUser);
    let unsubSuppliers = null;
    let unsubInventory = null;
    let unsubPurchaseOrders = null;
    unsubSuppliers = subscribeToSuppliers(adminId, (data) => {
      setSuppliers(data);
    });
    unsubInventory = subscribeToInventory(adminId, (data) => {
      setInventory(data);
    });
    unsubPurchaseOrders = subscribeToPurchaseOrders(adminId, (data) => {
      setPurchaseOrders(data);
    });
    return () => {
      if (unsubSuppliers) unsubSuppliers();
      if (unsubInventory) unsubInventory();
      if (unsubPurchaseOrders) unsubPurchaseOrders();
    };
  }, [currentUser]);

  // Save purchase orders to storage
  const savePurchaseOrders = async (updatedPOs) => {
    try {
      const userId = currentUser?.id
      if (!userId) return

      const adminId = getAdminIdForStorage(currentUser)
      console.log(`💾 PurchaseOrdersPage: Saving ${updatedPOs.length} purchase orders for user ${currentUser.name} (AdminId: ${adminId})`)
      
      const sharedData = await readSharedData(adminId)
      await writeSharedData({
        ...sharedData,
        purchaseOrders: updatedPOs
      }, adminId)
      setPurchaseOrders(updatedPOs)
      
      console.log(`✅ PurchaseOrdersPage: Successfully saved purchase orders to adminId: ${adminId}`)
    } catch (error) {
      console.error("Error saving purchase orders:", error)
    }
  }

  const handleCreatePO = (newPO) => {
    const maxId = Math.max(...purchaseOrders.map(po => po.id), 0)
    const poNumber = `PO-${String(maxId + 1).padStart(5, '0')}`
    const userSnapshot = createUserSnapshot(currentUser)
    const branchId = currentUser?.branchId || ''
    const timestamp = new Date().toISOString()
    
    const poToAdd = {
      ...newPO,
      id: maxId + 1,
      poNumber,
      branchId,
      orderDate: timestamp,
      status: "draft",
      receivedItems: [],
      createdBy: userSnapshot,
      createdAt: timestamp,
      statusHistory: [{
        status: "draft",
        timestamp: timestamp,
        changedBy: userSnapshot
      }]
    }
    savePurchaseOrders([...purchaseOrders, poToAdd])
    setShowCreateModal(false)
  }

  const handleUpdatePOStatus = async (poId, newStatus) => {
    const userSnapshot = createUserSnapshot(currentUser)
    const timestamp = new Date().toISOString()
    
    // Create status change record
    const statusChange = {
      status: newStatus,
      timestamp: timestamp,
      changedBy: userSnapshot
    }

    // If marking as received, also update inventory
    if (newStatus === "received") {
      try {
        const userId = currentUser?.id
        if (!userId) {
          alert('Authentication required: Please log in to complete the purchase order and update inventory.')
          return
        }

        const po = purchaseOrders.find(p => p.id === poId)
        if (!po) return

        // Read admin-specific data to update inventory
        const adminId = getAdminIdForStorage(currentUser)
        const sharedData = await readSharedData(adminId)
        const updatedInventory = [...(sharedData.inventory || [])]

        // Update inventory for all items in the PO
        po.items.forEach(item => {
          const inventoryIndex = updatedInventory.findIndex(p => p.id === item.productId)
          if (inventoryIndex !== -1) {
            // Update existing product quantity
            updatedInventory[inventoryIndex].quantity += item.quantity
          } else if (item.isNewProduct) {
            // Add new product to inventory
            const maxId = Math.max(...updatedInventory.map(p => p.id), 0)
            const barcodeTimestamp = Date.now().toString().slice(-8)
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
            const generatedBarcode = `${barcodeTimestamp}${random}`
            
            updatedInventory.push({
              id: maxId + 1,
              name: item.productName,
              sku: item.sku,
              category: item.category || "Other",
              quantity: item.quantity,
              reorderLevel: 10,
              costPrice: item.costPrice || item.unitPrice,
              sellingPrice: item.sellingPrice || item.unitPrice * 1.3,
              price: item.sellingPrice || item.unitPrice * 1.3,
              barcode: generatedBarcode,
            })
          }
        })

        // Update PO status with user tracking and status history
        const updatedPOs = purchaseOrders.map(p => 
          p.id === poId ? { 
            ...p, 
            status: newStatus,
            receivedBy: userSnapshot,
            receivedAt: timestamp,
            updatedBy: userSnapshot,
            updatedAt: timestamp,
            statusHistory: [...(p.statusHistory || []), statusChange]
          } : p
        )

        const updatedPO = updatedPOs.find(p => p.id === poId)
        console.log(`📝 PurchaseOrdersPage: Updating PO ${poId} to status: ${newStatus}`, updatedPO)
        console.log(`📦 Total POs to save: ${updatedPOs.length}`)

        // Save BOTH inventory and purchase orders together in one operation
        const dataToSave = {
          ...sharedData,
          inventory: updatedInventory,
          purchaseOrders: updatedPOs
        }
        console.log(`💾 Saving data with ${dataToSave.purchaseOrders.length} POs and ${dataToSave.inventory.length} inventory items`)
        
        const saved = await writeSharedData(dataToSave, adminId)
        
        if (!saved) {
          throw new Error('Failed to save data to storage')
        }
        
        console.log(`✅ PurchaseOrdersPage: Successfully saved ${updatedPOs.length} POs with updated status for adminId: ${adminId}`)

        // Update parent component's inventory state if callback is provided
        if (onInventoryChange) {
          onInventoryChange(updatedInventory)
        }

        // Update local state
        setPurchaseOrders(updatedPOs)

        // Force immediate reload to ensure data is synced
        await loadData()

        alert(`✅ Purchase Order marked as received and inventory updated by ${userSnapshot.name}!`)
      } catch (error) {
        console.error("Error updating inventory:", error)
        alert(`Failed to update inventory: ${error.message || 'Unknown error'}. Please try again.`)
      }
    } else {
      // Just update status for other transitions with user tracking
      await savePurchaseOrders(purchaseOrders.map(po => 
        po.id === poId ? { 
          ...po, 
          status: newStatus,
          updatedBy: userSnapshot,
          updatedAt: timestamp,
          statusHistory: [...(po.statusHistory || []), statusChange]
        } : po
      ))

      // Force immediate reload to ensure data is synced
      await loadData()
    }
  }

  // Filter by branch first, then by status
  const branchFilteredPOs = currentUser?.role === 'cashier'
    ? purchaseOrders.filter(po => po.branchId === currentUser.branchId || !po.branchId)
    : purchaseOrders // Admin sees all
    
  const filteredPOs = branchFilteredPOs.filter(po => 
    filterStatus === "all" || po.status === filterStatus
  ).sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    return supplier?.name || "Unknown Supplier"
  }

  const calculatePOTotal = (po) => {
    return po.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Purchase Orders"
        subtitle="Manage purchase orders and restocking"
        actions={[
          <button
            key="refresh"
            onClick={() => loadData()}
            className="px-4 py-2.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
            title="Refresh to see latest changes from all users"
          >
            🔄 Refresh
          </button>,
          <button
            key="create"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
          >
            + Create PO
          </button>
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Status filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground hover:bg-accent"
            }`}
          >
            All
          </button>
          {PO_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground hover:bg-accent"
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        {/* Purchase Orders list */}
        {filteredPOs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {filterStatus === "all" ? "No purchase orders created yet" : `No ${STATUS_LABELS[filterStatus]} purchase orders`}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Create Your First Purchase Order
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPOs.map(po => (
              <div
                key={po.id}
                className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedPO(po)
                  setShowDetailsModal(true)
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-foreground">{po.poNumber}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[po.status]}`}>
                        {STATUS_LABELS[po.status]}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        <span className="font-semibold">Supplier:</span> {getSupplierName(po.supplierId)}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-semibold">Order Date:</span> {new Date(po.orderDate).toLocaleDateString()}
                      </p>
                      {po.createdBy && (
                        <p className="text-muted-foreground">
                          <span className="font-semibold">Created by:</span> {po.createdBy.name} ({po.createdBy.role})
                        </p>
                      )}
                      {po.receivedBy && (
                        <p className="text-muted-foreground">
                          <span className="font-semibold">Received by:</span> {po.receivedBy.name} ({po.receivedBy.role})
                        </p>
                      )}
                      {po.expectedDelivery && (
                        <p className="text-muted-foreground">
                          <span className="font-semibold">Expected:</span> {new Date(po.expectedDelivery).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        KES {calculatePOTotal(po).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {po.items.length} item{po.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    
                    {po.status === "draft" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdatePOStatus(po.id, "ordered")
                        }}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors"
                      >
                        Confirm Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create PO Modal */}
      {showCreateModal && (
        <CreatePOModal
          suppliers={suppliers}
          inventory={inventory}
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePO}
          onSupplierAdded={(newSuppliers) => setSuppliers(newSuppliers)}
        />
      )}

      {/* PO Details Modal */}
      {showDetailsModal && selectedPO && (
        <PODetailsModal
          po={selectedPO}
          supplier={suppliers.find(s => s.id === selectedPO.supplierId)}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedPO(null)
          }}
          onUpdateStatus={handleUpdatePOStatus}
        />
      )}
    </div>
  )
}

function CreatePOModal({ suppliers, inventory, currentUser, onClose, onCreate, onSupplierAdded }) {
  const [formData, setFormData] = useState({
    supplierId: "",
    expectedDelivery: "",
    notes: "",
    items: []
  })

  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [showAddProductForm, setShowAddProductForm] = useState(false)
  const [newProductName, setNewProductName] = useState("")
  const [newProductSKU, setNewProductSKU] = useState("")
  const [newProductCategory, setNewProductCategory] = useState("Red Wine")
  const [newProductCostPrice, setNewProductCostPrice] = useState("")
  const [newProductSellingPrice, setNewProductSellingPrice] = useState("")
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [localSuppliers, setLocalSuppliers] = useState(suppliers)

  // Auto-populate unit price from product's cost price when selecting
  const handleProductSelect = (productId) => {
    setSelectedProduct(productId)
    if (productId) {
      const product = inventory.find(p => p.id === parseInt(productId))
      if (product) {
        // Use cost price if available, otherwise fall back to price
        const costPrice = product.costPrice || product.price || 0
        setUnitPrice(costPrice > 0 ? costPrice.toString() : "")
      }
    } else {
      setUnitPrice("")
    }
  }

  const handleAddItem = () => {
    if (!selectedProduct || !quantity || !unitPrice) {
      alert("Please select a product, enter quantity, and unit price")
      return
    }

    const product = inventory.find(p => p.id === parseInt(selectedProduct))
    if (!product) return

    const newItem = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: parseInt(quantity),
      unitPrice: parseFloat(unitPrice)
    }

    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    })

    setSelectedProduct("")
    setQuantity("")
    setUnitPrice("")
  }

  const handleAddNewProduct = () => {
    if (!newProductName || !quantity || !newProductCostPrice) {
      alert("Please fill in product name, quantity, and cost price")
      return
    }

    // Generate SKU if not provided (for products without barcodes)
    const finalSKU = newProductSKU || `PROD-${Date.now()}`
    
    // Create a temporary product ID (will be replaced when saved)
    const tempId = `temp-${Date.now()}`
    
    const newItem = {
      productId: tempId,
      productName: newProductName,
      sku: finalSKU,
      category: newProductCategory,
      quantity: parseInt(quantity),
      unitPrice: parseFloat(newProductCostPrice), // Use cost price as unit price for PO
      costPrice: parseFloat(newProductCostPrice),
      sellingPrice: parseFloat(newProductSellingPrice) || parseFloat(newProductCostPrice) * 1.3,
      isNewProduct: true // Flag to indicate this is a new product
    }

    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    })

    // Reset form
    setNewProductName("")
    setNewProductSKU("")
    setNewProductCategory("Red Wine")
    setQuantity("")
    setNewProductCostPrice("")
    setNewProductSellingPrice("")
    setShowAddProductForm(false)
  }

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.items.length === 0) {
      alert("Please add at least one item to the purchase order")
      return
    }
    onCreate(formData)
  }

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  const handleAddSupplier = async (newSupplier) => {
    // Create supplier with temporary ID
    const maxId = Math.max(...localSuppliers.map(s => s.id), 0)
    const supplierToAdd = {
      ...newSupplier,
      id: maxId + 1,
      createdDate: new Date().toISOString(),
      totalPurchases: 0,
      outstandingBalance: 0
    }
    
    // Update local suppliers list
    const updatedSuppliers = [...localSuppliers, supplierToAdd]
    setLocalSuppliers(updatedSuppliers)
    
    // Auto-select the new supplier
    setFormData({ ...formData, supplierId: supplierToAdd.id })
    
    // Close the add supplier modal
    setShowAddSupplierModal(false)
    
    // Notify parent component to update suppliers list
    if (onSupplierAdded) {
      onSupplierAdded(updatedSuppliers)
    }
    
    // Save to storage
    try {
      const userId = currentUser?.id
      if (userId) {
        const adminId = getAdminIdForStorage(currentUser)
        const sharedData = await readSharedData(adminId)
        await writeSharedData({
          ...sharedData,
          suppliers: updatedSuppliers
        }, adminId)
      }
    } catch (error) {
      console.error("Error saving supplier:", error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-border shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Create Purchase Order</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5">
                Supplier *
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: parseInt(e.target.value) })}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select supplier...</option>
                  {localSuppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors whitespace-nowrap"
                  title="Add new supplier"
                >
                  + New
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={formData.expectedDelivery}
                onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Add Items Section */}
          <div className="border border-border rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">Add Items</h3>
              <button
                type="button"
                onClick={() => setShowAddProductForm(!showAddProductForm)}
                className="px-3 py-1 text-sm bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
              >
                {showAddProductForm ? "➖ Cancel New Product" : "➕ Add New Product"}
              </button>
            </div>
            
            {!showAddProductForm ? (
              <>
                {/* Existing Product Selection */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Select Existing Product
                    </label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Choose from inventory...</option>
                      {inventory.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., 10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Unit Price (KES)
                    </label>
                    <input
                      type="number"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., 50.00"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
                >
                  ➕ Add to Order
                </button>
              </>
            ) : (
              <>
                {/* New Product Form */}
                <div className="bg-muted/30 rounded-lg p-4 mb-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    📝 Add a new product that's not in your inventory yet
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="e.g., Hennessy VS Cognac"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Product Code/SKU (optional)
                        <span className="text-xs text-muted-foreground ml-1 block">Scan barcode or type</span>
                      </label>
                      <input
                        type="text"
                        value={newProductSKU}
                        onChange={(e) => setNewProductSKU(e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Scan barcode or enter SKU..."
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Category *
                      </label>
                      <select
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Red Wine">Red Wine</option>
                        <option value="White Wine">White Wine</option>
                        <option value="Rosé Wine">Rosé Wine</option>
                        <option value="Sparkling Wine">Sparkling Wine</option>
                        <option value="Whisky">Whisky</option>
                        <option value="Vodka">Vodka</option>
                        <option value="Rum">Rum</option>
                        <option value="Gin">Gin</option>
                        <option value="Tequila">Tequila</option>
                        <option value="Brandy">Brandy</option>
                        <option value="Liqueur">Liqueur</option>
                        <option value="Beer">Beer</option>
                        <option value="Spirits">Spirits</option>
                        <option value="Mixers">Mixers</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        min="1"
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="e.g., 10"
                      />
                    </div>
                  </div>

                  {/* Pricing Section matching inventory pattern */}
                  <div className="bg-muted/30 rounded-lg p-4 space-y-3 mt-3">
                    <h4 className="text-sm font-semibold text-foreground">💰 Pricing</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Cost Price (KES) *
                          <span className="text-xs text-muted-foreground ml-1">(from vendor)</span>
                        </label>
                        <input
                          type="number"
                          value={newProductCostPrice}
                          onChange={(e) => setNewProductCostPrice(e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Selling Price (KES)
                          <span className="text-xs text-muted-foreground ml-1">(to customer)</span>
                        </label>
                        <input
                          type="number"
                          value={newProductSellingPrice}
                          onChange={(e) => setNewProductSellingPrice(e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    {newProductCostPrice && newProductSellingPrice && parseFloat(newProductSellingPrice) > 0 && (
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-border">
                        <span className="text-muted-foreground">Profit Margin:</span>
                        <span className={`font-semibold ${parseFloat(newProductSellingPrice) > parseFloat(newProductCostPrice) ? 'text-success' : 'text-destructive'}`}>
                          KES {(parseFloat(newProductSellingPrice) - parseFloat(newProductCostPrice)).toFixed(2)} 
                          ({parseFloat(newProductCostPrice) > 0 ? (((parseFloat(newProductSellingPrice) - parseFloat(newProductCostPrice)) / parseFloat(newProductCostPrice)) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddNewProduct}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
                >
                  ➕ Add New Product to Order
                </button>
              </>
            )}
          </div>

          {/* Items List */}
          {formData.items.length > 0 && (
            <div className="border border-border rounded-lg p-4 mb-4">
              <h3 className="text-lg font-bold text-foreground mb-4">Order Items</h3>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-accent/50 p-3 rounded-lg">
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.productName}
                        {item.isNewProduct && (
                          <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">
                            ✨ New Product
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku} • {item.quantity} × KES {item.unitPrice.toFixed(2)} = KES {(item.quantity * item.unitPrice).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <span className="text-lg font-bold text-foreground">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  KES {calculateTotal().toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-2 sm:py-2.5 text-sm bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 sm:px-6 py-2 sm:py-2.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors order-1 sm:order-2"
            >
              Create Purchase Order
            </button>
          </div>
        </form>
      </div>

      {/* Quick Add Supplier Modal */}
      {showAddSupplierModal && (
        <QuickAddSupplierModal
          onClose={() => setShowAddSupplierModal(false)}
          onSave={handleAddSupplier}
        />
      )}
    </div>
  )
}

function QuickAddSupplierModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    category: "",
    address: ""
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-2 sm:p-4">
      <div className="bg-card border-2 border-primary rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border bg-primary/10 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">✨ Quick Add Supplier</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-accent rounded transition-colors"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Add a new supplier without leaving this page</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Kenya Wines Agencies"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., 0738329378"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Email (optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., supplier@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Category (optional)
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Wines, Spirits"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Address (optional)
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter supplier address"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg order-1 sm:order-2"
            >
              Add Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PODetailsModal({ po, supplier, onClose, onUpdateStatus }) {
  const calculateTotal = () => {
    return po.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{po.poNumber}</h2>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[po.status]}`}>
                {STATUS_LABELS[po.status]}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Supplier</h3>
              <p className="text-lg font-semibold text-foreground">{supplier?.name || "Unknown"}</p>
              {supplier?.phone && <p className="text-sm text-muted-foreground">{supplier.phone}</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Order Date</h3>
              <p className="text-lg font-semibold text-foreground">
                {new Date(po.orderDate).toLocaleDateString()}
              </p>
            </div>
            {po.createdBy && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Created By</h3>
                <p className="text-lg font-semibold text-foreground">
                  {po.createdBy.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Role: {po.createdBy.role}
                </p>
              </div>
            )}
            {po.receivedBy && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Received By</h3>
                <p className="text-lg font-semibold text-foreground">
                  {po.receivedBy.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Role: {po.receivedBy.role} • {po.receivedAt ? new Date(po.receivedAt).toLocaleString() : 'Unknown time'}
                </p>
              </div>
            )}
            {po.expectedDelivery && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Expected Delivery</h3>
                <p className="text-lg font-semibold text-foreground">
                  {new Date(po.expectedDelivery).toLocaleDateString()}
                </p>
              </div>
            )}
            {po.notes && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Notes</h3>
                <p className="text-foreground">{po.notes}</p>
              </div>
            )}
          </div>

          {/* Status History / Audit Trail */}
          {po.statusHistory && po.statusHistory.length > 0 && (
            <div className="border border-border rounded-lg p-4 mb-6 bg-accent/20">
              <h3 className="text-lg font-bold text-foreground mb-3">📋 Status History (Audit Trail)</h3>
              <div className="space-y-2">
                {po.statusHistory.map((history, index) => (
                  <div key={index} className="flex items-start gap-3 pb-2 border-b border-border last:border-0">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        {STATUS_LABELS[history.status] || history.status}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {history.changedBy?.name || 'Unknown'} ({history.changedBy?.role || 'Unknown role'})
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {new Date(history.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-border rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Order Items</h3>
            <div className="space-y-3">
              {po.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center pb-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-semibold text-foreground">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {item.quantity} × KES {item.unitPrice.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      KES {(item.quantity * item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">
                KES {calculateTotal().toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {po.status === "ordered" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>📦 Inventory Update:</strong> When you mark this order as received, the inventory quantities will be automatically updated for all items in this purchase order.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              {po.status === "draft" && (
                <button
                  onClick={() => {
                    onUpdateStatus(po.id, "ordered")
                    onClose()
                  }}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
                >
                  Confirm Order
                </button>
              )}
              {po.status === "ordered" && (
                <button
                  onClick={() => {
                    onUpdateStatus(po.id, "received")
                    onClose()
                  }}
                  className="px-6 py-2.5 bg-success hover:bg-success/90 text-white rounded-lg font-semibold transition-colors"
                >
                  Mark as Received
                </button>
              )}
              {(po.status === "draft" || po.status === "ordered") && (
                <button
                  onClick={() => {
                    onUpdateStatus(po.id, "cancelled")
                    onClose()
                  }}
                  className="px-6 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel Order
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
