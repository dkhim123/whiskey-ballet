"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import TopBar from "../components/TopBar"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToCustomers, subscribeToCustomersByBranch } from "../services/realtimeListeners"
import { parseFormValue } from "../utils/dateHelpers"
import { exportCustomersToCSV } from "../utils/csvExport"
import { readData, writeData, readSharedData, writeSharedData } from "../utils/storage"

export default function CustomersPage({ currentUser }) {
  const [customers, setCustomers] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  // Real-time Firestore customers listener (branch-scoped for cashier/manager for accountability and rules)
  useEffect(() => {
    if (!currentUser) return;
    const adminId = getAdminIdForStorage(currentUser);
    const useBranchScope = (currentUser.role === 'cashier' || currentUser.role === 'manager') && currentUser.branchId;
    const unsub = useBranchScope
      ? subscribeToCustomersByBranch(adminId, currentUser.branchId, (data) => setCustomers(data))
      : subscribeToCustomers(adminId, (data) => setCustomers(data));
    return () => { if (unsub) unsub(); };
  }, [currentUser]);

  // For cashier/manager we already subscribed by branch; for admin we have all. No extra filter needed.
  const branchFilteredCustomers = customers

  console.log(`👥 CustomersPage: User ${currentUser?.name} (${currentUser?.role}) sees ${branchFilteredCustomers.length} customers (Branch: ${currentUser?.branchId || 'all'})`)
    
  const filteredCustomers = branchFilteredCustomers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddCustomer = async (newCustomer) => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        toast.error('User not authenticated')
        return
      }

      // Block if cashier/manager has no branchId
      if ((currentUser.role === 'cashier' || currentUser.role === 'manager') && !currentUser.branchId) {
        toast.error('You must be assigned to a branch to create customers. Please contact your administrator.')
        return
      }

      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId, false, { stores: ['customers'] })
      const existingCustomers = sharedData.customers || []
      const maxId = Math.max(...existingCustomers.map(c => c.id), 0)

      const customerToAdd = {
        ...newCustomer,
        id: maxId + 1,
        branchId: currentUser?.branchId,
        createdBy: {
          id: currentUser?.id,
          name: currentUser?.name || currentUser?.email,
          role: currentUser?.role
        },
        balance: newCustomer.loanAmount || 0,
        createdDate: new Date().toISOString(),
      }

      const updatedCustomers = [...existingCustomers, customerToAdd]
      await writeSharedData(
        { ...sharedData, customers: updatedCustomers },
        adminId,
        { writeOnlyStores: ['customers'] }
      )

      setCustomers(updatedCustomers)
      setShowAddModal(false)
      alert('Customer added successfully!')
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('Failed to add customer')
    }
  }

  const handleEditCustomer = async (updatedCustomer) => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        toast.error('User not authenticated')
        return
      }

      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId, false, { stores: ['customers'] })
      const allCustomers = sharedData.customers || []
      const updatedCustomers = allCustomers.map(c => {
        if (c.id === updatedCustomer.id) {
          const preservedBranchId = c.branchId || currentUser?.branchId
          return {
            ...updatedCustomer,
            branchId: updatedCustomer.branchId || preservedBranchId,
            createdBy: c.createdBy || {
              id: currentUser?.id,
              name: currentUser?.name || currentUser?.email,
              role: currentUser?.role
            },
            balance: updatedCustomer.balance !== undefined ? updatedCustomer.balance : (c.balance || 0)
          }
        }
        return c
      })

      await writeSharedData(
        { ...sharedData, customers: updatedCustomers },
        adminId,
        { writeOnlyStores: ['customers'] }
      )

      setCustomers(updatedCustomers)
      setShowEditModal(false)
      alert('Customer updated successfully!')
    } catch (error) {
      console.error('Error updating customer:', error)
      alert('Failed to update customer')
    }
  }

  const handleViewDetails = (customer) => {
    setSelectedCustomer(customer)
    setShowDetailsModal(true)
  }

  // Calculate stats from branch-filtered customers, not all customers
  const totalCustomers = branchFilteredCustomers.length
  const loanAmountFor = (c) => c.loanAmount ?? c.balance ?? 0
  const customersWithLoans = branchFilteredCustomers.filter(c => loanAmountFor(c) > 0).length
  const totalLoansOwed = branchFilteredCustomers.reduce((sum, c) => sum + loanAmountFor(c), 0)

  // Check for loans due today (from branch-filtered customers)
  const today = new Date().toISOString().split('T')[0]
  const loansDueToday = branchFilteredCustomers.filter(c => {
    const amt = loanAmountFor(c)
    if (!c.loanDueDate || !amt || amt <= 0) return false
    const dueDate = new Date(c.loanDueDate).toISOString().split('T')[0]
    return dueDate === today
  })

  const handleExportCSV = () => {
    const filename = `customers_${new Date().toISOString().split('T')[0]}.csv`
    exportCustomersToCSV(filteredCustomers, filename)
    alert(`Exported ${filteredCustomers.length} customer(s) to ${filename}`)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Customer Management"
        subtitle="Manage customers and track credit sales"
        actions={[
          <button
            key="export"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-success hover:bg-success/90 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg mr-2"
            disabled={filteredCustomers.length === 0}
          >
            📥 Export CSV
          </button>,
          <button
            key="add"
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
          >
            + Add Customer
          </button>,
        ]}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Loan Due Today Alert */}
        {loansDueToday.length > 0 && (
          <div className="mb-4 bg-destructive/10 border-2 border-destructive rounded-lg p-4">
            <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2">
              🔔 Loan Payment Due Today
            </h3>
            <div className="space-y-2">
              {loansDueToday.map(customer => (
                <div key={customer.id} className="flex justify-between items-center text-sm bg-card rounded p-2">
                  <div>
                    <span className="font-semibold text-foreground">{customer.name}</span>
                    <span className="text-muted-foreground ml-2">📞 {customer.phone || 'No phone'}</span>
                  </div>
                  <span className="font-bold text-destructive">KES {(customer.loanAmount ?? customer.balance ?? 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border-2 border-border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Total Customers</div>
            <div className="text-3xl font-bold text-primary">{totalCustomers}</div>
          </div>
          <div className="bg-card border-2 border-border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Customers with Loans</div>
            <div className="text-3xl font-bold text-yellow-600">{customersWithLoans}</div>
          </div>
          <div className="bg-card border-2 border-border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Total Loans Outstanding</div>
            <div className="text-3xl font-bold text-destructive">KES {totalLoansOwed.toLocaleString()}</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search customers by name or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
          />
        </div>

        {/* Customers Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Created By</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Loan Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Loan Due Date</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer, idx) => {
                const isLoanDueToday = customer.loanDueDate && new Date(customer.loanDueDate).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                const isLoanOverdue = customer.loanDueDate && new Date(customer.loanDueDate) < new Date() && customer.loanAmount > 0
                
                return (
                  <tr key={customer.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/20 hover:bg-muted/40 transition-colors"}>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-foreground">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Joined: {new Date(customer.createdDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        📞 {customer.phone || '-'}
                      </div>
                      {customer.address && (
                        <div className="text-xs text-muted-foreground">{customer.address}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {customer.createdBy ? (
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-1">
                            👤 {customer.createdBy.name}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {customer.createdBy.role}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <span className={`font-semibold ${(customer.loanAmount ?? customer.balance ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        KES {(customer.loanAmount ?? customer.balance ?? 0).toLocaleString()}
                      </span>
                      {customer.loanDate && customer.loanAmount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Taken: {new Date(customer.loanDate).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      {customer.loanDueDate && customer.loanAmount > 0 ? (
                        <div>
                          <div className={`font-medium ${
                            isLoanOverdue ? 'text-destructive' : 
                            isLoanDueToday ? 'text-yellow-600' : 
                            'text-foreground'
                          }`}>
                            {new Date(customer.loanDueDate).toLocaleDateString()}
                          </div>
                          {isLoanOverdue && (
                            <div className="text-xs text-destructive font-semibold">⚠️ Overdue</div>
                          )}
                          {isLoanDueToday && !isLoanOverdue && (
                            <div className="text-xs text-yellow-600 font-semibold">📅 Due Today</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleViewDetails(customer)}
                          className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-xs font-semibold"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowEditModal(true)
                          }}
                          className="px-3 py-1 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-colors text-xs font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">
                  {searchTerm ? 'No customers found matching your search' : 'No customers yet. Add your first customer!'}
                </td>
              </tr>
            )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddCustomerModal onAdd={handleAddCustomer} onClose={() => setShowAddModal(false)} />
      )}

      {showEditModal && selectedCustomer && (
        <EditCustomerModal
          customer={selectedCustomer}
          onSave={handleEditCustomer}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showDetailsModal && selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          currentUser={currentUser}
          onClose={() => setShowDetailsModal(false)}
          onBalanceUpdate={(updatedCustomer) => {
            const updatedCustomers = customers.map(c => 
              c.id === updatedCustomer.id ? updatedCustomer : c
            )
            setCustomers(updatedCustomers)
          }}
        />
      )}
    </div>
  )
}

// Add Customer Modal Component
function AddCustomerModal({ onAdd, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    loanAmount: 0,
    loanDate: "",
    loanDueDate: "",
    creditLimit: 0,
    specialPricing: false,
    discountRate: 0,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: parseFormValue(name, value, type, checked),
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name) {
      alert("Customer name is required")
      return
    }
    onAdd(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-md w-full border-2 border-border max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Add New Customer</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Customer Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              placeholder="e.g., John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Phone Number *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              placeholder="e.g., 0712345678"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground resize-none"
              rows="2"
              placeholder="Customer address"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">💳 Credit & Pricing Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Credit Limit (KES)</label>
              <input
                type="number"
                name="creditLimit"
                value={formData.creditLimit}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                min="0"
                step="1000"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum amount customer can purchase on credit</p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
              <input
                type="checkbox"
                name="specialPricing"
                id="specialPricing"
                checked={formData.specialPricing}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="specialPricing" className="text-sm font-medium text-foreground cursor-pointer">
                Enable Special Pricing (Lower prices for this customer)
              </label>
            </div>

            {formData.specialPricing && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Discount Rate (%)</label>
                <input
                  type="number"
                  name="discountRate"
                  value={formData.discountRate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Percentage discount applied to all products for this customer</p>
              </div>
            )}
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">💰 Loan Information (Optional)</h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Loan Amount (KES)</label>
              <input
                type="number"
                name="loanAmount"
                value={formData.loanAmount}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                min="0"
                step="100"
                placeholder="0"
              />
            </div>

            {formData.loanAmount > 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Loan Date</label>
                  <input
                    type="date"
                    name="loanDate"
                    value={formData.loanDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Payment Due Date</label>
                  <input
                    type="date"
                    name="loanDueDate"
                    value={formData.loanDueDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </>
            )}
          </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-border bg-card">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors shadow-lg"
            >
              Add Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Customer Modal Component
function EditCustomerModal({ customer, onSave, onClose }) {
  const [formData, setFormData] = useState({ 
    ...customer,
    creditLimit: customer.creditLimit || 0,
    specialPricing: customer.specialPricing || false,
    discountRate: customer.discountRate || 0,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: parseFormValue(name, value, type, checked),
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name) {
      alert("Customer name is required")
      return
    }
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-md w-full border-2 border-border max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Edit Customer</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Customer Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Phone Number *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Address</label>
            <textarea
              name="address"
              value={formData.address || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground resize-none"
              rows="2"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">💳 Credit & Pricing Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Credit Limit (KES)</label>
              <input
                type="number"
                name="creditLimit"
                value={formData.creditLimit}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                min="0"
                step="1000"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum amount customer can purchase on credit</p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
              <input
                type="checkbox"
                name="specialPricing"
                id="specialPricingEdit"
                checked={formData.specialPricing}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="specialPricingEdit" className="text-sm font-medium text-foreground cursor-pointer">
                Enable Special Pricing (Lower prices for this customer)
              </label>
            </div>

            {formData.specialPricing && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Discount Rate (%)</label>
                <input
                  type="number"
                  name="discountRate"
                  value={formData.discountRate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Percentage discount applied to all products for this customer</p>
              </div>
            )}
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">💰 Loan Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Loan Amount (KES)</label>
              <input
                type="number"
                name="loanAmount"
                value={formData.loanAmount || 0}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                min="0"
                step="100"
              />
            </div>

            {formData.loanAmount > 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Loan Date</label>
                  <input
                    type="date"
                    name="loanDate"
                    value={formData.loanDate || ""}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Payment Due Date</label>
                  <input
                    type="date"
                    name="loanDueDate"
                    value={formData.loanDueDate || ""}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </>
            )}
          </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-border bg-card">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors shadow-lg"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Customer Details Modal Component
function CustomerDetailsModal({ customer, currentUser, onClose, onBalanceUpdate }) {
  const [transactions, setTransactions] = useState([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    const loadCustomerTransactions = async () => {
      try {
        const userId = currentUser?.id
        if (!userId) return

        // Read from admin-specific storage
        const adminId = getAdminIdForStorage(currentUser)
        const sharedData = await readSharedData(adminId)
        // Filter transactions for this customer
        const customerTransactions = (sharedData.transactions || []).filter(
          t => t.customerId === customer.id
        )
        setTransactions(customerTransactions)
      } catch (error) {
        console.error('Error loading customer transactions:', error)
      }
    }

    loadCustomerTransactions()
  }, [customer, currentUser])

  const handleRecordPayment = async (paymentAmount, paymentMethod = 'cash') => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        toast.error('User not authenticated')
        return
      }

      // Block if cashier/manager has no branchId
      if ((currentUser.role === 'cashier' || currentUser.role === 'manager') && !currentUser.branchId) {
        toast.error('You must be assigned to a branch to record payments. Please contact your administrator.')
        return
      }

      // Use admin-specific storage
      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      
      // Calculate new loan and balance amounts (use loanAmount ?? balance so legacy records work)
      const currentLoan = customer.loanAmount ?? customer.balance ?? 0
      const newLoanAmount = Math.max(0, currentLoan - paymentAmount)
      const newBalance = Math.max(0, (customer.balance ?? customer.loanAmount ?? 0) - paymentAmount)
      const isFullyPaid = newLoanAmount === 0
      
      // Update customer loan amount AND balance
      const updatedCustomers = (sharedData.customers || []).map(c =>
        c.id === customer.id
          ? { 
              ...c, 
              loanAmount: newLoanAmount,
              balance: newBalance,
              // Clear loan dates if fully paid
              ...(isFullyPaid ? { loanDate: "", loanDueDate: "" } : {})
            }
          : c
      )

      // Update transaction payment status - mark transactions as paid in order (FIFO)
      // This handles both full and partial payments by tracking remaining amount
      let remainingPayment = paymentAmount
      const updatedTransactions = (sharedData.transactions || []).map(t => {
        if (remainingPayment > 0 && 
            t.customerId === customer.id && 
            t.paymentMethod === 'credit' && 
            t.paymentStatus === 'pending') {
          if (remainingPayment >= t.total) {
            // Full payment for this transaction
            remainingPayment -= t.total
            return { ...t, paymentStatus: 'completed', paidDate: new Date().toISOString() }
          }
          // Note: Partial payments don't update transaction status
          // Transaction remains 'pending' until fully paid
        }
        return t
      })

      // Record payment transaction with selected payment method
      const paymentTransaction = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date().toISOString(),
        customerId: customer.id,
        customerName: customer.name,
        type: 'loan_payment',
        amount: paymentAmount,
        total: paymentAmount,
        userId: userId,
        branchId: currentUser?.branchId, // No fallback - validated above
        recordedBy: currentUser?.name || currentUser?.email || 'Unknown',
        paymentMethod: paymentMethod,
        paymentStatus: 'completed'
      }

      // Read user-specific data for expenses
      const userData = await readData(userId)
      
      // Create income entry for loan payment (money received)
      const incomeEntry = {
        id: `INC-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        date: new Date().toISOString(),
        category: 'Loan Repayment',
        description: `Loan payment from ${customer.name} via ${paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}`,
        amount: paymentAmount,
        paymentMethod: paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash',
        notes: `Customer loan payment - ${isFullyPaid ? 'Fully paid' : `Remaining: KES ${newLoanAmount.toLocaleString()}`}`,
        customerId: customer.id,
        createdBy: userId,
        branchId: currentUser?.branchId, // No fallback - validated above
        userId: userId,
        userName: currentUser?.name || currentUser?.email,
        type: 'income' // Mark as income to distinguish from expenses
      }
      
      // Update expenses array with the income entry
      const updatedExpenses = [...(userData.expenses || []), incomeEntry]
      
      // Also save to shared storage for admin visibility
      const sharedExpenses = sharedData.expenses || []
      const updatedSharedExpenses = [...sharedExpenses, incomeEntry]

      // Save to admin-specific storage with expense
      await writeSharedData({
        ...sharedData,
        customers: updatedCustomers,
        transactions: [...updatedTransactions, paymentTransaction],
        expenses: updatedSharedExpenses
      }, adminId)
      
      // Save income entry to user-specific storage
      await writeData({
        ...userData,
        expenses: updatedExpenses
      }, userId)

      const updatedCustomer = updatedCustomers.find(c => c.id === customer.id)
      onBalanceUpdate(updatedCustomer)
      setShowPaymentModal(false)
      alert(`Payment of KES ${paymentAmount.toLocaleString()} recorded successfully!`)
      onClose()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment')
    }
  }

  const creditTransactions = transactions.filter(t => t.paymentMethod === 'credit')
  const totalCreditSales = creditTransactions.reduce((sum, t) => sum + (t.total || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card rounded-lg shadow-2xl max-w-2xl w-full p-6 border-2 border-border my-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-foreground mb-2">Customer Details</h2>
        <p className="text-sm text-muted-foreground mb-6">{customer.name}</p>

        {/* Customer Info */}
        <div className="bg-muted/30 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Phone:</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">📞 {customer.phone || 'N/A'}</span>
              {customer.phone && (
                <a 
                  href={`tel:${customer.phone}`}
                  className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded text-xs font-semibold"
                >
                  Call
                </a>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Address:</span>
            <span className="font-semibold text-foreground">{customer.address || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created By:</span>
            {customer.createdBy ? (
              <div className="text-right">
                <div className="font-semibold text-foreground">👤 {customer.createdBy.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{customer.createdBy.role}</div>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm italic">Unknown</span>
            )}
          </div>
          
          {/* Credit Limit */}
          {customer.creditLimit > 0 && (
            <>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">Credit Limit:</span>
                <span className="font-semibold text-primary">KES {customer.creditLimit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className={`font-semibold ${customer.balance > 0 ? 'text-destructive' : 'text-success'}`}>
                  KES {(customer.balance || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available Credit:</span>
                <span className="font-bold text-success">
                  KES {(customer.creditLimit - (customer.balance || 0)).toLocaleString()}
                </span>
              </div>
            </>
          )}
          
          {/* Special Pricing */}
          {customer.specialPricing && customer.discountRate > 0 && (
            <div className="flex justify-between pt-2 border-t border-border bg-green-50 dark:bg-green-950/30 rounded px-2 py-1">
              <span className="text-green-700 dark:text-green-300 font-medium">💰 Special Pricing:</span>
              <span className="font-bold text-green-700 dark:text-green-300">{customer.discountRate}% Discount</span>
            </div>
          )}
          
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-muted-foreground">Loan Amount:</span>
            <span className={`font-bold text-lg ${(customer.loanAmount ?? customer.balance ?? 0) > 0 ? 'text-destructive' : 'text-success'}`}>
              KES {(customer.loanAmount ?? customer.balance ?? 0).toLocaleString()}
            </span>
          </div>
          {(customer.loanAmount ?? customer.balance ?? 0) > 0 && (
            <>
              {customer.loanDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan Date:</span>
                  <span className="font-semibold text-foreground">{new Date(customer.loanDate).toLocaleDateString()}</span>
                </div>
              )}
              {customer.loanDueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Due:</span>
                  <span className={`font-semibold ${
                    new Date(customer.loanDueDate) < new Date() ? 'text-destructive' :
                    new Date(customer.loanDueDate).toISOString().split('T')[0] === new Date().toISOString().split('T')[0] ? 'text-yellow-600' :
                    'text-foreground'
                  }`}>
                    {new Date(customer.loanDueDate).toLocaleDateString()}
                    {new Date(customer.loanDueDate) < new Date() && ' ⚠️ Overdue'}
                    {new Date(customer.loanDueDate).toISOString().split('T')[0] === new Date().toISOString().split('T')[0] && ' 📅 Today'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Payment Button */}
        {(customer.loanAmount ?? customer.balance ?? 0) > 0 && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full px-4 py-2.5 bg-success hover:bg-success/90 text-white font-semibold rounded-lg transition-colors shadow-lg mb-6"
          >
            💰 Record Loan Payment
          </button>
        )}

        {/* Loan Payment History */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">Loan Payment History</h3>
          {transactions.filter(t => t.type === 'loan_payment').length > 0 ? (
            <div className="space-y-2">
              {transactions
                .filter(t => t.type === 'loan_payment')
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map((payment) => (
                  <div key={payment.id} className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-foreground">
                          {new Date(payment.timestamp).toLocaleDateString()} {new Date(payment.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Recorded by: {payment.recordedBy || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-green-600 dark:text-green-400">
                          KES {payment.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Payment</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground">
              No loan payments recorded yet
            </div>
          )}
        </div>

        {/* Purchase History */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">Purchase History on Credit</h3>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Total Credit Purchases:</span>
              <span className="font-semibold text-foreground">{creditTransactions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-semibold text-primary">KES {totalCreditSales.toLocaleString()}</span>
            </div>
          </div>

          {creditTransactions.length > 0 && (
            <div className="mt-4 max-h-80 overflow-y-auto">
              <div className="space-y-3">
                {creditTransactions.map((t) => (
                  <div key={t.id} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-foreground">
                          {new Date(t.timestamp).toLocaleDateString()} {new Date(t.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Transaction ID: {t.id}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-primary">KES {t.total.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Credit Sale</div>
                      </div>
                    </div>
                    
                    {/* Itemized List */}
                    {t.items && t.items.length > 0 && (
                      <div className="mt-2 border-t border-border pt-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">Items Purchased:</div>
                        <div className="space-y-1">
                          {t.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm bg-muted/20 rounded px-2 py-1">
                              <div className="flex-1">
                                <span className="font-medium text-foreground">{item.name}</span>
                                <span className="text-muted-foreground ml-2">({item.sku})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">Qty: {item.quantity}</span>
                                <span className="text-muted-foreground">@ KES {item.price.toLocaleString()}</span>
                                <span className="font-semibold text-foreground">
                                  KES {(item.quantity * item.price).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Transaction Summary */}
                        <div className="mt-2 pt-2 border-t border-border space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span className="font-medium">KES {t.subtotal.toLocaleString()}</span>
                          </div>
                          {t.discountAmount > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Discount ({t.discount}%):</span>
                              <span className="font-medium text-destructive">-KES {t.discountAmount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                            <span className="text-foreground">Total:</span>
                            <span className="text-primary">KES {t.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
        >
          Close
        </button>

        {/* Payment Modal */}
        {showPaymentModal && (
          <PaymentModal
            customer={customer}
            onRecord={handleRecordPayment}
            onClose={() => setShowPaymentModal(false)}
          />
        )}
      </div>
    </div>
  )
}

// Payment Modal Component
function PaymentModal({ customer, onRecord, onClose }) {
  const [paymentAmount, setPaymentAmount] = useState(customer.loanAmount || 0)
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0')
      return
    }
    if (paymentAmount > loanTotal) {
      alert(`Payment amount cannot exceed loan amount of KES ${loanTotal.toLocaleString()}`)
      return
    }
    onRecord(paymentAmount, paymentMethod)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-md w-full p-6 border-2 border-border">
        <h2 className="text-2xl font-bold text-foreground mb-2">Record Loan Payment</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Customer: <span className="font-semibold text-foreground">{customer.name}</span>
          <br />
          Loan Amount: <span className="font-semibold text-destructive">KES {loanTotal.toLocaleString()}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Payment Amount (KES)</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number.parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
              min="0"
              step="0.01"
              required
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentAmount(loanTotal / 2)}
                className="text-xs px-3 py-1 bg-muted hover:bg-muted/80 rounded-lg"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => setPaymentAmount(loanTotal)}
                className="text-xs px-3 py-1 bg-muted hover:bg-muted/80 rounded-lg"
              >
                Full Payment
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                💵 Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa')}
                className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                  paymentMethod === 'mpesa'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                📱 M-Pesa
              </button>
            </div>
          </div>

          {paymentAmount > 0 && (
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Loan:</span>
                <span className="font-bold text-lg text-primary">
                  KES {(loanTotal - paymentAmount).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-success hover:bg-success/90 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
