"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToGoodsReceivedNotes, subscribeToPurchaseOrders } from "../services/realtimeExtraListeners"
import { createUserSnapshot, formatReceivedBy, getReceivedByName, getReceivedByRole } from "../utils/userTracking"
import { readData, writeData, readSharedData, writeSharedData } from "../utils/storage"

export default function GoodsReceivedPage({ currentUser }) {
  const [grns, setGrns] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [inventory, setInventory] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedGRN, setSelectedGRN] = useState(null)

  // Load data from storage
  const loadData = async () => {
    try {
      const userId = currentUser?.id
      if (!userId) return

      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      setGrns(sharedData.goodsReceivedNotes || [])
      setPurchaseOrders(sharedData.purchaseOrders || [])
      setSuppliers(sharedData.suppliers || [])
      setInventory(sharedData.inventory || [])
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  // Real-time Firestore suppliers, inventory, goodsReceivedNotes, and purchaseOrders listeners
  useEffect(() => {
    if (!currentUser) return;
    const adminId = getAdminIdForStorage(currentUser);
    let unsubSuppliers = null;
    let unsubInventory = null;
    let unsubGoodsReceivedNotes = null;
    let unsubPurchaseOrders = null;
    unsubSuppliers = subscribeToSuppliers(adminId, (data) => {
      setSuppliers(data);
    });
    unsubInventory = subscribeToInventory(adminId, (data) => {
      setInventory(data);
    });
    unsubGoodsReceivedNotes = subscribeToGoodsReceivedNotes(adminId, (data) => {
      setGrns(data);
    });
    unsubPurchaseOrders = subscribeToPurchaseOrders(adminId, (data) => {
      setPurchaseOrders(data);
    });
    return () => {
      if (unsubSuppliers) unsubSuppliers();
      if (unsubInventory) unsubInventory();
      if (unsubGoodsReceivedNotes) unsubGoodsReceivedNotes();
      if (unsubPurchaseOrders) unsubPurchaseOrders();
    };
  }, [currentUser]);

  // Save GRN and update inventory
  const saveGRN = async (newGRN) => {
    try {
      const userId = currentUser?.id
      if (!userId) return

      const userData = await readData(userId)
      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      
      // Add new GRN (to shared storage)
      const updatedGRNs = [...(sharedData.goodsReceivedNotes || []), newGRN]
      
      // Calculate total cost of goods received
      const totalCost = newGRN.items.reduce((sum, item) => 
        sum + (item.receivedQuantity * item.unitPrice), 0
      )
      
      // Get supplier name
      const supplier = (sharedData.suppliers || []).find(s => s.id === newGRN.supplierId)
      const supplierName = supplier?.name || "Unknown Supplier"
      
      // Get PO number
      const po = (sharedData.purchaseOrders || []).find(p => p.id === newGRN.poId)
      const poNumber = po?.poNumber || "N/A"
      
      // Create expense entry for goods received from supplier (debt/credit purchase) - user-specific
      const expenses = userData.expenses || []
      const maxExpenseId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) : 0
      const newExpense = {
        id: maxExpenseId + 1,
        description: `Goods received from ${supplierName} - ${newGRN.grnNumber || 'GRN'}`,
        category: 'Supplier Purchase',
        amount: totalCost,
        date: new Date().toISOString(),
        paymentMethod: 'credit', // Indicates this is a credit purchase/debt
        notes: `Purchase Order: ${poNumber}. Items: ${newGRN.items.map(i => i.productName).join(', ')}`,
        linkedGRN: newGRN.id,
        linkedSupplier: newGRN.supplierId
      }
      const updatedExpenses = [...expenses, newExpense]
      
      // Update inventory based on received items (in SHARED storage for POS access)
      const updatedInventory = [...(sharedData.inventory || [])]
      newGRN.items.forEach(item => {
        const inventoryIndex = updatedInventory.findIndex(p => p.id === item.productId)
        if (inventoryIndex !== -1) {
          updatedInventory[inventoryIndex].quantity += item.receivedQuantity
        } else if (item.isNewProduct) {
          // Add new product to inventory if it doesn't exist
          const maxId = Math.max(...updatedInventory.map(p => p.id), 0)
          // Generate a more unique barcode using timestamp and random number
          const timestamp = Date.now().toString().slice(-8)
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
          const generatedBarcode = `${timestamp}${random}`
          
          updatedInventory.push({
            id: maxId + 1,
            name: item.productName,
            sku: item.sku,
            category: item.category || "Other",
            quantity: item.receivedQuantity,
            reorderLevel: item.reorderLevel || 10,
            costPrice: item.costPrice || item.unitPrice,
            sellingPrice: item.sellingPrice || item.unitPrice * 1.3,
            price: item.sellingPrice || item.unitPrice * 1.3,
            barcode: generatedBarcode,
          })
        }
      })
      
      // Update PO status
      const updatedPOs = (sharedData.purchaseOrders || []).map(po => {
        if (po.id === newGRN.poId) {
          // Check if all items are received
          const allReceived = po.items.every(poItem => {
            const totalReceived = updatedGRNs
              .filter(grn => grn.poId === po.id)
              .reduce((sum, grn) => {
                const grnItem = grn.items.find(i => i.productId === poItem.productId)
                return sum + (grnItem?.receivedQuantity || 0)
              }, 0)
            return totalReceived >= poItem.quantity
          })
          
          return {
            ...po,
            status: allReceived ? "received" : "partially_received"
          }
        }
        return po
      })

      // Write to user-specific storage (expenses only)
      await writeData({
        ...userData,
        expenses: updatedExpenses
      }, userId)
      
      // Write to SHARED storage (GRNs, POs, inventory)
      await writeSharedData({
        ...sharedData,
        goodsReceivedNotes: updatedGRNs,
        purchaseOrders: updatedPOs,
        inventory: updatedInventory
      }, adminId)
      
      setGrns(updatedGRNs)
      setInventory(updatedInventory)
      setPurchaseOrders(updatedPOs)
    } catch (error) {
      console.error("Error saving GRN:", error)
    }
  }

  const handleCreateGRN = async (newGRN) => {
    const maxId = Math.max(...grns.map(g => g.id), 0)
    const grnNumber = `GRN-${String(maxId + 1).padStart(5, '0')}`
    const grnToAdd = {
      ...newGRN,
      id: maxId + 1,
      grnNumber,
      receivedDate: new Date().toISOString(),
      receivedBy: createUserSnapshot(currentUser)
    }
    await saveGRN(grnToAdd)
    setShowCreateModal(false)
    alert(`✅ Goods Received Note ${grnNumber} created successfully!`)
  }

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    return supplier?.name || "Unknown Supplier"
  }

  const getPONumber = (poId) => {
    const po = purchaseOrders.find(p => p.id === poId)
    return po?.poNumber || "N/A"
  }

  const calculateGRNTotal = (grn) => {
    return grn.items.reduce((sum, item) => sum + (item.receivedQuantity * item.unitPrice), 0)
  }

  // Filter out draft POs and already fully received POs
  const availablePOs = purchaseOrders.filter(po => 
    po.status === "ordered" || po.status === "partially_received"
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Goods Received Notes"
        subtitle="Record received goods and update stock"
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
            disabled={availablePOs.length === 0}
          >
            + Record GRN
          </button>
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* GRNs list */}
        {grns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No goods received yet</p>
            {availablePOs.length > 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
              >
                Record Your First GRN
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {grns.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate)).map(grn => {
              const po = purchaseOrders.find(p => p.id === grn.poId)
              return (
                <div
                  key={grn.id}
                  className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedGRN(grn)
                    setShowDetailsModal(true)
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-foreground">{grn.grnNumber}</h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-300">
                          Received
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-semibold">PO:</span> {getPONumber(grn.poId)}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-semibold">Supplier:</span> {getSupplierName(po?.supplierId)}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-semibold">Received:</span> {new Date(grn.receivedDate).toLocaleDateString()} by {formatReceivedBy(grn.receivedBy)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">
                          KES {calculateGRNTotal(grn).toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {grn.items.length} item{grn.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create GRN Modal */}
      {showCreateModal && (
        <CreateGRNModal
          purchaseOrders={availablePOs}
          suppliers={suppliers}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateGRN}
        />
      )}

      {/* GRN Details Modal */}
      {showDetailsModal && selectedGRN && (
        <GRNDetailsModal
          grn={selectedGRN}
          po={purchaseOrders.find(p => p.id === selectedGRN.poId)}
          supplier={suppliers.find(s => s.id === purchaseOrders.find(p => p.id === selectedGRN.poId)?.supplierId)}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedGRN(null)
          }}
        />
      )}
    </div>
  )
}

const MAX_RECEIVED_MULTIPLIER = 2 // Allow receiving up to 2x ordered quantity (for over-delivery cases)

function CreateGRNModal({ purchaseOrders, suppliers, onClose, onCreate }) {
  const [selectedPOId, setSelectedPOId] = useState("")
  const [receivedItems, setReceivedItems] = useState([])
  const [notes, setNotes] = useState("")

  const selectedPO = purchaseOrders.find(po => po.id === parseInt(selectedPOId))

  useEffect(() => {
    if (selectedPO) {
      // Initialize received items with PO items
      setReceivedItems(selectedPO.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        orderedQuantity: item.quantity,
        receivedQuantity: item.quantity,
        unitPrice: item.unitPrice,
        isNewProduct: item.isNewProduct,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        category: item.category
      })))
    }
  }, [selectedPO])

  const handleQuantityChange = (productId, quantity) => {
    setReceivedItems(receivedItems.map(item =>
      item.productId === productId
        ? { ...item, receivedQuantity: parseInt(quantity) || 0 }
        : item
    ))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedPOId) {
      alert("Please select a purchase order")
      return
    }
    
    const hasReceivedItems = receivedItems.some(item => item.receivedQuantity > 0)
    if (!hasReceivedItems) {
      alert("Please receive at least one item")
      return
    }

    onCreate({
      poId: parseInt(selectedPOId),
      items: receivedItems.filter(item => item.receivedQuantity > 0),
      notes
    })
  }

  const calculateTotal = () => {
    return receivedItems.reduce((sum, item) => sum + (item.receivedQuantity * item.unitPrice), 0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">📦 Record Goods Received</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Record goods received from suppliers and update your inventory
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-foreground mb-2">
              Purchase Order *
            </label>
            <select
              value={selectedPOId}
              onChange={(e) => setSelectedPOId(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Choose the purchase order you're receiving...</option>
              {purchaseOrders.map(po => {
                const supplier = suppliers.find(s => s.id === po.supplierId)
                return (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} - {supplier?.name} ({po.items.length} items)
                  </option>
                )
              })}
            </select>
            {!selectedPOId && purchaseOrders.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                ℹ️ No pending purchase orders. Create a purchase order first.
              </p>
            )}
          </div>

          {/* Received Items */}
          {selectedPO && (
            <div className="border border-border rounded-lg p-4 mb-4">
              <h3 className="text-lg font-bold text-foreground mb-2">📋 Check Received Items</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Verify quantities received match what was ordered. Adjust if needed.
              </p>
              <div className="space-y-3">
                {receivedItems.map((item, index) => (
                  <div key={index} className="bg-accent/50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                        <p className="text-sm text-muted-foreground">
                          Unit Price: KES {item.unitPrice.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">
                          📦 Ordered Quantity
                        </label>
                        <input
                          type="number"
                          value={item.orderedQuantity}
                          disabled
                          className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">
                          ✅ Received Quantity *
                        </label>
                        <input
                          type="number"
                          value={item.receivedQuantity}
                          onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                          min="0"
                          max={item.orderedQuantity * MAX_RECEIVED_MULTIPLIER}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Enter received quantity"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Subtotal: KES {(item.receivedQuantity * item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <span className="text-lg font-bold text-foreground">Total Value:</span>
                <span className="text-2xl font-bold text-primary">
                  KES {calculateTotal().toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-semibold text-foreground mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any discrepancies or notes about the received goods..."
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Record GRN
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GRNDetailsModal({ grn, po, supplier, onClose }) {
  const calculateTotal = () => {
    return grn.items.reduce((sum, item) => sum + (item.receivedQuantity * item.unitPrice), 0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{grn.grnNumber}</h2>
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-300">
                Received
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
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Purchase Order</h3>
              <p className="text-lg font-semibold text-foreground">{po?.poNumber || "N/A"}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Supplier</h3>
              <p className="text-lg font-semibold text-foreground">{supplier?.name || "Unknown"}</p>
              {supplier?.phone && <p className="text-sm text-muted-foreground">{supplier.phone}</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Received Date</h3>
              <p className="text-lg font-semibold text-foreground">
                {new Date(grn.receivedDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Received By</h3>
              <p className="text-lg font-semibold text-foreground">
                {getReceivedByName(grn.receivedBy)}
              </p>
              {getReceivedByRole(grn.receivedBy) && (
                <p className="text-sm text-muted-foreground">Role: {getReceivedByRole(grn.receivedBy)}</p>
              )}
            </div>
            {grn.notes && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Notes</h3>
                <p className="text-foreground">{grn.notes}</p>
              </div>
            )}
          </div>

          <div className="border border-border rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Received Items</h3>
            <div className="space-y-3">
              {grn.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center pb-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-semibold text-foreground">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                    {item.orderedQuantity !== item.receivedQuantity && (
                      <p className="text-sm text-orange-600">
                        Ordered: {item.orderedQuantity}, Received: {item.receivedQuantity}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {item.receivedQuantity} × KES {item.unitPrice.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      KES {(item.receivedQuantity * item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">Total Value:</span>
              <span className="text-2xl font-bold text-primary">
                KES {calculateTotal().toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
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
  )
}
