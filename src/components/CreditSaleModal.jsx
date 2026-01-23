"use client"

import { useState } from "react"
import { toast } from "sonner"

export default function CreditSaleModal({ customers = [], onSelectCustomer, onCreateCustomer, onClose }) {
  const [view, setView] = useState("list") // "list" or "create"
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    creditLimit: 5000,
    paymentDueDate: "",
  })

  // Filter customers by search term
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCustomerSelect = (customer) => {
    onSelectCustomer(customer)
    onClose()
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === "creditLimit" ? parseFloat(value) || 0 : value,
    })
  }

  const handleCreateCustomer = (e) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Validation Error', {
        description: 'Customer name is required',
      })
      return
    }
    
    // Create new customer with minimal required fields
    const newCustomer = {
      name: formData.name,
      phone: formData.phone || "", // Optional
      creditLimit: formData.creditLimit || 5000,
      balance: 0,
      createdDate: new Date().toISOString(),
      specialPricing: false,
      discountRate: 0,
      loanAmount: 0,
      loanDate: "",
      loanDueDate: formData.paymentDueDate || "",
    }

    onCreateCustomer(newCustomer)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl max-w-2xl w-full border-2 border-border max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Select Credit Customer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose an existing customer or create a new one
          </p>
        </div>

        {/* View Toggle */}
        <div className="p-4 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setView("list")}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border hover:bg-muted"
              }`}
            >
              📋 Select Customer
            </button>
            <button
              onClick={() => setView("create")}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                view === "create"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border hover:bg-muted"
              }`}
            >
              ➕ New Customer
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === "list" ? (
            <>
              {/* Search Bar */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search customers by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  autoFocus
                />
              </div>

              {/* Customer List */}
              {filteredCustomers.length > 0 ? (
                <div className="space-y-2">
                  {filteredCustomers.map((customer) => {
                    const availableCredit = (customer.creditLimit || 0) - (customer.balance || 0)
                    const hasCredit = availableCredit > 0

                    return (
                      <button
                        key={customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          hasCredit
                            ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                            : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 hover:border-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 cursor-pointer"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-foreground text-lg">{customer.name}</div>
                            {customer.phone && (
                              <div className="text-sm text-muted-foreground mt-1">
                                📞 {customer.phone}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`font-bold text-lg ${hasCredit ? "text-success" : "text-destructive"}`}>
                              KES {availableCredit.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">Available Credit</div>
                          </div>
                        </div>

                        {/* Credit Details */}
                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Credit Limit: </span>
                            <span className="font-semibold text-foreground">
                              KES {(customer.creditLimit || 0).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Balance: </span>
                            <span className="font-semibold text-destructive">
                              KES {(customer.balance || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {!hasCredit && (
                          <div className="mt-2 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                            ⚠️ Credit limit reached - You can still select but increase limit first
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3 opacity-30">👥</div>
                  <p className="text-base font-semibold text-muted-foreground">
                    {searchTerm ? "No customers found" : "No credit customers yet"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchTerm
                      ? "Try adjusting your search"
                      : "Create your first credit customer to get started"}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Create New Customer Form */
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  placeholder="e.g., John Doe"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  placeholder="e.g., 0712345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Credit Limit (KES)
                </label>
                <input
                  type="number"
                  name="creditLimit"
                  value={formData.creditLimit}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  min="0"
                  step="1000"
                  placeholder="5000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum amount customer can purchase on credit
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Payment Due Date (Optional)
                </label>
                <input
                  type="date"
                  name="paymentDueDate"
                  value={formData.paymentDueDate}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  When should this customer pay for their purchases?
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  <strong>Quick Setup:</strong> You can create a customer with just a name. 
                  Phone number and payment date are optional. You can always edit customer details later.
                </p>
              </div>

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
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors shadow-lg"
                >
                  Create & Select
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {view === "list" && (
          <div className="p-4 border-t border-border bg-muted/20">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
