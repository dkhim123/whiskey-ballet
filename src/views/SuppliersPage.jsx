"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import { readSharedData, writeSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"

export default function SuppliersPage({ currentUser }) {
  const [suppliers, setSuppliers] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Load suppliers from storage
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const userId = currentUser?.id
        if (!userId) return

        const adminId = getAdminIdForStorage(currentUser)
        const sharedData = await readSharedData(adminId)
        setSuppliers(sharedData.suppliers || [])
      } catch (error) {
        console.error("Error loading suppliers:", error)
      }
    }

    loadSuppliers()
  }, [currentUser])

  // Save suppliers to storage
  const saveSuppliers = async (updatedSuppliers) => {
    try {
      const userId = currentUser?.id
      if (!userId) return

      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      await writeSharedData({
        ...sharedData,
        suppliers: updatedSuppliers
      }, adminId)
      setSuppliers(updatedSuppliers)
    } catch (error) {
      console.error("Error saving suppliers:", error)
    }
  }

  const handleAddSupplier = (newSupplier) => {
    const maxId = Math.max(...suppliers.map(s => s.id), 0)
    const supplierToAdd = {
      ...newSupplier,
      id: maxId + 1,
      createdDate: new Date().toISOString(),
      totalPurchases: 0,
      outstandingBalance: 0
    }
    saveSuppliers([...suppliers, supplierToAdd])
    setShowAddModal(false)
  }

  const handleEditSupplier = (updatedSupplier) => {
    saveSuppliers(suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s))
    setShowEditModal(false)
  }

  const handleDeleteSupplier = (supplierId) => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      // Soft delete: mark as deleted instead of removing
      saveSuppliers(suppliers.map(s => 
        s.id === supplierId
          ? { ...s, deletedAt: new Date().toISOString(), deletedBy: currentUser?.id }
          : s
      ))
    }
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    !supplier.deletedAt && ( // Filter out soft-deleted suppliers
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Supplier Management"
        subtitle="Manage supplier information and contacts"
        actions={[
          <button
            key="add"
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
          >
            + Add Supplier
          </button>
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Search bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search suppliers by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Suppliers grid */}
        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {searchTerm ? "No suppliers found matching your search" : "No suppliers added yet"}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Add Your First Supplier
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map(supplier => (
              <div key={supplier.id} className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{supplier.name}</h3>
                    <p className="text-sm text-muted-foreground">{supplier.category || "General"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedSupplier(supplier)
                        setShowEditModal(true)
                      }}
                      className="p-2 text-primary hover:bg-primary/10 rounded transition-colors"
                      title="Edit supplier"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(supplier.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Delete supplier"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">📞</span>
                    <span className="text-foreground">{supplier.phone || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">📧</span>
                    <span className="text-foreground">{supplier.email || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">📦</span>
                    <span className="text-foreground">{supplier.products || "Various products"}</span>
                  </div>
                  {supplier.outstandingBalance > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Outstanding:</span>
                        <span className="font-semibold text-destructive">
                          KES {supplier.outstandingBalance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <SupplierModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSupplier}
        />
      )}

      {/* Edit Supplier Modal */}
      {showEditModal && selectedSupplier && (
        <SupplierModal
          supplier={selectedSupplier}
          onClose={() => {
            setShowEditModal(false)
            setSelectedSupplier(null)
          }}
          onSave={handleEditSupplier}
        />
      )}
    </div>
  )
}

function SupplierModal({ supplier = null, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    phone: supplier?.phone || "",
    email: supplier?.email || "",
    category: supplier?.category || "",
    products: supplier?.products || "",
    address: supplier?.address || "",
    notes: supplier?.notes || ""
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (supplier) {
      onSave({ ...supplier, ...formData })
    } else {
      onSave(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            {supplier ? "Edit Supplier" : "Add New Supplier"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Wines, Spirits, Beer"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-2">
                Products Supplied
              </label>
              <input
                type="text"
                value={formData.products}
                onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                placeholder="e.g., Wines, Whisky, Vodka, Beer"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-2">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
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
              {supplier ? "Update" : "Add"} Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
