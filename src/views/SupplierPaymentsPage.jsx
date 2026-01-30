"use client"

import { useState, useEffect } from "react"
import TopBar from "../components/TopBar"
import { getAdminIdForStorage } from "../utils/auth"
import { subscribeToSuppliers } from "../services/realtimeListeners"
import { subscribeToPurchaseOrders, subscribeToSupplierPayments } from "../services/realtimeExtraListeners"
// TODO: Implement subscribeToSupplierPayments and subscribeToPurchaseOrders for full real-time

export default function SupplierPaymentsPage({ currentUser }) {
  const [payments, setPayments] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [filterSupplier, setFilterSupplier] = useState("all")

  // Real-time Firestore listeners for suppliers, supplierPayments, and purchaseOrders
  useEffect(() => {
    if (!currentUser) return;
    const adminId = getAdminIdForStorage(currentUser);
    let unsubSuppliers = null;
    let unsubSupplierPayments = null;
    let unsubPurchaseOrders = null;
    unsubSuppliers = subscribeToSuppliers(adminId, (data) => {
      setSuppliers(data);
    });
    unsubSupplierPayments = subscribeToSupplierPayments(adminId, (data) => {
      setPayments(data);
    });
    unsubPurchaseOrders = subscribeToPurchaseOrders(adminId, (data) => {
      setPurchaseOrders(data);
    });
    return () => {
      if (unsubSuppliers) unsubSuppliers();
      if (unsubSupplierPayments) unsubSupplierPayments();
      if (unsubPurchaseOrders) unsubPurchaseOrders();
    };
  }, [currentUser]);

  // Calculate supplier balances
  const calculateSupplierBalance = (supplierId) => {
    // Total from received POs
    const totalPurchases = purchaseOrders
      .filter(po => po.supplierId === supplierId && (po.status === "received" || po.status === "partially_received"))
      .reduce((sum, po) => sum + po.items.reduce((itemSum, item) => itemSum + (item.quantity * item.unitPrice), 0), 0)

    // Total paid
    const totalPaid = payments
      .filter(p => p.supplierId === supplierId)
      .reduce((sum, p) => sum + p.amount, 0)

    return {
      totalPurchases,
      totalPaid,
      balance: totalPurchases - totalPaid
    }
  }

  // Save payment
  const savePayment = async (newPayment) => {
    try {
      const userId = currentUser?.id
      if (!userId) return

      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      const userData = await readData(userId)
      
      const updatedPayments = [...(sharedData.supplierPayments || []), newPayment]
      
      // Update supplier outstanding balance
      const supplierBalance = calculateSupplierBalance(newPayment.supplierId)
      const updatedSuppliers = (sharedData.suppliers || []).map(s =>
        s.id === newPayment.supplierId
          ? { ...s, outstandingBalance: supplierBalance.balance - newPayment.amount }
          : s
      )

      // Record the payment as an expense to track cash outflow (user-specific)
      const expenses = userData.expenses || []
      const maxExpenseId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) : 0
      const supplier = updatedSuppliers.find(s => s.id === newPayment.supplierId)
      const supplierName = supplier?.name || "Unknown Supplier"
      
      const paymentExpense = {
        id: maxExpenseId + 1,
        description: `Payment to ${supplierName}`,
        category: 'Supplier Payment',
        amount: newPayment.amount,
        date: new Date().toISOString(),
        paymentMethod: newPayment.paymentMethod || 'cash',
        notes: newPayment.notes || `Payment reference: ${newPayment.reference || 'N/A'}`,
        linkedPayment: newPayment.id,
        linkedSupplier: newPayment.supplierId,
        branchId: currentUser?.branchId || ''
      }
      const updatedExpenses = [...expenses, paymentExpense]

      // Save shared data (payments and suppliers)
      await writeSharedData({
        ...sharedData,
        supplierPayments: updatedPayments,
        suppliers: updatedSuppliers
      }, adminId)
      
      // Save user-specific data (expenses)
      await writeData({
        ...userData,
        expenses: updatedExpenses
      }, userId)
      
      setPayments(updatedPayments)
      setSuppliers(updatedSuppliers)
    } catch (error) {
      console.error("Error saving payment:", error)
    }
  }

  const handleRecordPayment = (paymentData) => {
    const maxId = Math.max(...payments.map(p => p.id), 0)
    const paymentToAdd = {
      ...paymentData,
      id: maxId + 1,
      branchId: currentUser?.branchId || '',
      paymentDate: new Date().toISOString(),
      recordedBy: currentUser?.name || currentUser?.email || "Unknown"
    }
    savePayment(paymentToAdd)
    setShowPaymentModal(false)
    setSelectedSupplier(null)
  }

  // Filter by branch first, then by supplier
  const branchFilteredPayments = currentUser?.role === 'cashier'
    ? payments.filter(p => p.branchId === currentUser.branchId || !p.branchId)
    : payments // Admin sees all
    
  const filteredPayments = branchFilteredPayments
    .filter(p => filterSupplier === "all" || p.supplierId === parseInt(filterSupplier))
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    return supplier?.name || "Unknown Supplier"
  }

  // Calculate totals
  const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalOutstanding = suppliers.reduce((sum, s) => {
    const balance = calculateSupplierBalance(s.id)
    return sum + balance.balance
  }, 0)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Supplier Payments"
        subtitle="Track payments and credit purchases"
        actions={[
          <button
            key="payment"
            onClick={() => setShowPaymentModal(true)}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
          >
            + Record Payment
          </button>
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Total Paid</h3>
            <p className="text-2xl font-bold text-success">KES {totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Outstanding Balance</h3>
            <p className="text-2xl font-bold text-destructive">KES {totalOutstanding.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Suppliers with Credit</h3>
            <p className="text-2xl font-bold text-foreground">
              {suppliers.filter(s => calculateSupplierBalance(s.id).balance > 0).length}
            </p>
          </div>
        </div>

        {/* Supplier Balances */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Supplier Balances</h2>
          {suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No suppliers added yet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map(supplier => {
                const balance = calculateSupplierBalance(supplier.id)
                return (
                  <div key={supplier.id} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-foreground">{supplier.name}</h3>
                        <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                      </div>
                      {balance.balance > 0 && (
                        <button
                          onClick={() => {
                            setSelectedSupplier(supplier)
                            setShowPaymentModal(true)
                          }}
                          className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-xs font-semibold transition-colors"
                        >
                          Pay
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Purchases:</span>
                        <span className="font-semibold text-foreground">
                          KES {balance.totalPurchases.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="font-semibold text-success">
                          KES {balance.totalPaid.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground font-semibold">Balance:</span>
                        <span className={`font-bold ${balance.balance > 0 ? 'text-destructive' : 'text-success'}`}>
                          KES {balance.balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payment History */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-foreground">Payment History</h2>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payment history yet
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-accent">
                  <tr>
                    <th className="text-left p-4 font-semibold text-foreground">Date</th>
                    <th className="text-left p-4 font-semibold text-foreground">Supplier</th>
                    <th className="text-left p-4 font-semibold text-foreground">Amount</th>
                    <th className="text-left p-4 font-semibold text-foreground">Method</th>
                    <th className="text-left p-4 font-semibold text-foreground">Reference</th>
                    <th className="text-left p-4 font-semibold text-foreground">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(payment => (
                    <tr key={payment.id} className="border-t border-border hover:bg-accent/50">
                      <td className="p-4 text-foreground">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-foreground font-semibold">
                        {getSupplierName(payment.supplierId)}
                      </td>
                      <td className="p-4 text-foreground font-bold">
                        KES {payment.amount.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                          {payment.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {payment.reference || "N/A"}
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {payment.recordedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          supplier={selectedSupplier}
          suppliers={suppliers}
          calculateSupplierBalance={calculateSupplierBalance}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedSupplier(null)
          }}
          onSave={handleRecordPayment}
        />
      )}
    </div>
  )
}

function PaymentModal({ supplier, suppliers, calculateSupplierBalance, onClose, onSave }) {
  const [formData, setFormData] = useState({
    supplierId: supplier?.id || "",
    amount: "",
    paymentMethod: "cash",
    reference: "",
    notes: ""
  })

  const selectedSupplier = suppliers.find(s => s.id === parseInt(formData.supplierId))
  const supplierBalance = selectedSupplier ? calculateSupplierBalance(selectedSupplier.id) : null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.supplierId || !formData.amount) {
      alert("Please fill in all required fields")
      return
    }

    const amount = parseFloat(formData.amount)
    if (supplierBalance && amount > supplierBalance.balance) {
      if (!window.confirm(`Payment amount (KES ${amount.toLocaleString()}) exceeds outstanding balance (KES ${supplierBalance.balance.toLocaleString()}). Continue?`)) {
        return
      }
    }

    onSave({
      ...formData,
      supplierId: parseInt(formData.supplierId),
      amount
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Record Payment</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Supplier *
              </label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={!!supplier}
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {supplierBalance && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Outstanding Balance: <span className="font-bold text-destructive">
                    KES {supplierBalance.balance.toLocaleString()}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Payment Amount *
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Payment Method *
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Reference Number
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Transaction ref, cheque no., etc."
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
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
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
