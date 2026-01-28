"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import TopBar from "../components/TopBar"
import ProductGrid from "../components/ProductGrid"
import ProductTable from "../components/ProductTable"
import CartPanel from "../components/CartPanel"
import MPesaModal from "../components/MPesaModal"
import CashPaymentModal from "../components/CashPaymentModal"
import ReceiptModal from "../components/ReceiptModal"
import CreditSaleModal from "../components/CreditSaleModal"
import Pagination from "../components/Pagination"
import { readData, writeData, readSharedData, writeSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"
import { isExpired, isExpiringSoon } from "../utils/dateHelpers"
import { logActivity, ACTIVITY_TYPES } from "../utils/activityLog"
import { calculateCartTotals, calculateItemVAT } from "../utils/pricing"
import { useDebounce } from "../hooks/useDebounce"

const CATEGORIES = ["All", "Red Wine", "White Wine", "Rosé Wine", "Sparkling Wine", "Whisky", "Vodka", "Rum", "Gin", "Tequila", "Brandy", "Liqueur", "Beer", "Spirits", "Mixers", "Other"]
const EXPIRY_FILTERS = ["All", "Fresh", "Expiring Soon", "Expired"]

export default function PosPage({ inventory: initialInventory = [], onInventoryChange, currentUser }) {
  const [inventory, setInventory] = useState(initialInventory)
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [expiryFilter, setExpiryFilter] = useState("All")
  const [viewMode, setViewMode] = useState("table") // "table" or "grid"
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [showMPesaModal, setShowMPesaModal] = useState(false)
  const [showCashModal, setShowCashModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showCreditSaleModal, setShowCreditSaleModal] = useState(false)
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(null)
  const [pendingCustomer, setPendingCustomer] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customers, setCustomers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [barcodeBuffer, setBarcodeBuffer] = useState("")
  const barcodeInputRef = useRef(null)

  // Debounce search for better performance
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Load shared data (inventory, transactions, customers) with auto-refresh
  useEffect(() => {
    const loadSharedData = async () => {
      try {
        const userId = currentUser?.id
        if (!userId) return

        const adminId = getAdminIdForStorage(currentUser)
        const branchId = currentUser?.branchId
        
        // CRITICAL DEBUG: Check user branchId
        if (!branchId && currentUser.role === 'cashier') {
          console.error(`🚨 CRITICAL: User ${currentUser.name} is a cashier but has NO branchId!`)
          console.error('User object:', currentUser)
        }
        
        console.log(`🔍 PosPage: Loading data for ${currentUser.name} (Role: ${currentUser.role}, Branch: ${branchId || 'NONE'})`)
        
        const sharedData = await readSharedData(adminId)
        
        // CRITICAL DEBUG: Check product branchIds
        const totalProducts = (sharedData.inventory || []).length
        const productsWithBranch = (sharedData.inventory || []).filter(i => i.branchId).length
        const productsWithoutBranch = totalProducts - productsWithBranch
        
        console.log(`📦 Total products in DB: ${totalProducts}`)  
        console.log(`✅ Products WITH branchId: ${productsWithBranch}`)
        console.log(`❌ Products WITHOUT branchId: ${productsWithoutBranch}`)
        
        // Filter inventory and transactions by branchId with STRICT validation
        let filteredInventory = sharedData.inventory || []
        let filteredTransactions = sharedData.transactions || []
        
        if (branchId) {
          // STRICT: Only items with matching branchId (exclude undefined)
          filteredInventory = filteredInventory.filter(i => {
            const hasMatch = i.branchId === branchId
            if (!i.branchId && hasMatch) {
              console.error(`🚨 BUG DETECTED: Product "${i.name}" has undefined branchId but passed filter!`)
            }
            return i.branchId && i.branchId === branchId
          })
          filteredTransactions = filteredTransactions.filter(t => t.branchId && t.branchId === branchId)
          
          console.log(`🔒 FILTERED for branch "${branchId}": ${filteredInventory.length} products`)
          console.log('Sample products:', filteredInventory.slice(0, 3).map(p => `${p.name} (branch: ${p.branchId})`).join(', '))
          
          if (productsWithoutBranch > 0) {
            console.warn(`⚠️ ${productsWithoutBranch} products excluded (no branchId) - RUN MIGRATION!`)
          }
        } else if (currentUser.role === 'cashier') {
          // Cashier with no branch - show nothing
          console.error(`🚨 Cashier ${currentUser.name} has no branch - showing EMPTY inventory!`)
          filteredInventory = []
          filteredTransactions = []
        }
        
        setInventory(filteredInventory)
        setTransactions(filteredTransactions)
        setCustomers(sharedData.customers || [])
        
        // Also update parent component
        if (onInventoryChange) {
          onInventoryChange(filteredInventory)
        }
      } catch (error) {
        console.error('Error loading shared data:', error)
      }
    }

    // Initial load
    loadSharedData()
    
    // Auto-refresh every 5 seconds to sync with other users (admin/cashiers)
    // This ensures real-time visibility of transactions and inventory changes
    const interval = setInterval(loadSharedData, 5000)
    
    return () => clearInterval(interval)
  }, [currentUser])

  // Barcode scanner handler - captures barcode scanner input
  useEffect(() => {
    const handleBarcodeInput = (e) => {
      // Only process if not typing in search box
      if (document.activeElement?.type === 'text' || document.activeElement?.type === 'number') {
        return
      }

      const key = e.key
      
      // Build barcode buffer as scanner types
      if (key.length === 1) {
        setBarcodeBuffer(prev => prev + key)
      }
      
      // Scanner sends Enter after barcode
      if (key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault()
        handleBarcodeScanned(barcodeBuffer)
        setBarcodeBuffer("")
      }
    }

    // Clear buffer after 100ms of no input (scanner is much faster)
    const clearBuffer = setTimeout(() => {
      if (barcodeBuffer.length > 0 && barcodeBuffer.length < 8) {
        setBarcodeBuffer("") // Clear partial/manual input
      }
    }, 100)

    window.addEventListener('keydown', handleBarcodeInput)
    
    return () => {
      window.removeEventListener('keydown', handleBarcodeInput)
      clearTimeout(clearBuffer)
    }
  }, [barcodeBuffer, inventory])

  const handleBarcodeScanned = (barcode) => {
    const trimmedBarcode = barcode.trim()
    
    // Find product by barcode or SKU (excluding soft-deleted items)
    const product = inventory.find(p => 
      !p.deletedAt && (
        p.barcode === trimmedBarcode || 
        p.sku?.toLowerCase() === trimmedBarcode.toLowerCase()
      )
    )

    if (product) {
      addToCart(product, 1)
      toast.success('Product added!', {
        description: `${product.name} - KES ${product.price?.toLocaleString() || 0}`,
        duration: 2000,
      })
    } else {
      toast.error('Product not found', {
        description: `No product with barcode: ${trimmedBarcode}`,
        duration: 3000,
      })
    }
  }

  const filteredProducts = inventory.filter(
    (p) => {
      // Filter out soft-deleted items
      if (p.deletedAt) return false
      
      const matchesSearch = 
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
        p.sku.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.barcode?.includes(debouncedSearch)
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory
      
      // Apply expiry filter
      let matchesExpiry = true
      if (expiryFilter === "Expired") {
        matchesExpiry = isExpired(p.expiryDate)
      } else if (expiryFilter === "Expiring Soon") {
        matchesExpiry = isExpiringSoon(p.expiryDate) && !isExpired(p.expiryDate)
      } else if (expiryFilter === "Fresh") {
        matchesExpiry = !isExpired(p.expiryDate) && !isExpiringSoon(p.expiryDate)
      }
      
      return matchesSearch && matchesCategory && matchesExpiry
    }
  )

  // Pagination logic
  const totalProducts = filteredProducts.length
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, expiryFilter, debouncedSearch])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    // Scroll to top of products list
    const productsSection = document.getElementById('products-section')
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const addToCart = (product, quantityToAdd = 1) => {
    if (product.quantity <= 0) {
      alert("Product out of stock!")
      return
    }
    const existing = cart.find((item) => item.id === product.id)
    
    // Apply special customer pricing if applicable
    const basePrice = product.price ?? product.sellingPrice ?? 0
    let effectivePrice = basePrice
    if (selectedCustomer?.specialPricing && selectedCustomer?.discountRate > 0) {
      const discount = selectedCustomer.discountRate / 100
      effectivePrice = basePrice * (1 - discount)
    }
    
    if (existing) {
      const newQuantity = existing.quantity + quantityToAdd
      if (newQuantity > product.quantity) {
        alert("Insufficient stock!")
        return
      }
      setCart(cart.map((item) => (item.id === product.id ? { ...item, quantity: newQuantity } : item)))
    } else {
      if (quantityToAdd > product.quantity) {
        alert("Insufficient stock!")
        return
      }
      setCart([...cart, { ...product, price: effectivePrice, quantity: quantityToAdd }])
    }
  }

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId, quantity) => {
    const product = inventory.find((p) => p.id === productId)
    if (quantity > product?.quantity) {
      alert("Insufficient stock!")
      return
    }
    if (quantity <= 0) {
      removeFromCart(productId)
    } else {
      setCart(cart.map((item) => (item.id === productId ? { ...item, quantity } : item)))
    }
  }

  const updatePrice = (productId, newPrice) => {
    setCart(cart.map((item) => (item.id === productId ? { ...item, price: newPrice } : item)))
  }

  const clearCart = () => {
    if (window.confirm("Are you sure you want to clear the cart?")) {
      setCart([])
      setDiscount(0)
      setSelectedCustomer(null)
      setAgeVerified(false) // Reset age verification for new transaction
      toast.info('Cart Cleared', {
        description: 'Ready for next customer'
      })
    }
  }

  const handleCheckout = async (method, customer = null) => {
    // For credit sales, show the customer selection modal if no customer selected
    if (method === "credit") {
      if (!customer) {
        setShowCreditSaleModal(true)
        return
      }
      
      // Check credit limit
      const customerBalance = customer.balance || 0
      const customerLimit = customer.creditLimit || 0
      const availableCredit = customerLimit - customerBalance
      
      if (total > availableCredit) {
        toast.error('Credit Limit Exceeded', {
          description: `Available credit: KES ${availableCredit.toLocaleString()}. Transaction amount: KES ${total.toLocaleString()}`,
        })
        return
      }
      
      setSelectedCustomer(customer)
    }
    
    // Proceed with payment directly
    setPaymentMethod(method)
    if (method === "mpesa") {
      setShowMPesaModal(true)
    } else if (method === "cash") {
      // For cash payments, show cash modal to capture amount paid and calculate change
      setShowCashModal(true)
    } else {
      // For credit payments, save transaction first then show receipt
      await handleCompletePayment(method, customer)
    }
  }

  const handleCompletePayment = async (method = null, customer = null) => {
    // Use the provided method or fall back to the state
    const finalPaymentMethod = method || paymentMethod || 'cash'
    const finalCustomer = customer || selectedCustomer
    
    // CRITICAL CHECK: If cashier has no branchId, ABORT
    if (currentUser.role === 'cashier' && !currentUser.branchId) {
      console.error(`🚨 CRITICAL: Cashier ${currentUser.name} has NO branchId! Cannot complete sale.`)
      alert(`ERROR: Your account is missing branch assignment. Please logout and login again. Sale was NOT completed.`)
      return
    }
    
    // Calculate updated inventory for CURRENT BRANCH ONLY based on cart
    const updatedBranchInventory = inventory.map((item) => {
      const cartItem = cart.find((c) => c.id === item.id)
      if (cartItem) {
        return { ...item, quantity: item.quantity - cartItem.quantity }
      }
      return item
    })
    
    // DEBUG: Log what's in updatedBranchInventory
    console.log(`🔍 PosPage: updatedBranchInventory has ${updatedBranchInventory.length} items`)
    updatedBranchInventory.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.name} - branchId: ${item.branchId}, id: ${item.id}, qty: ${item.quantity}`)
    })
    
    // Save transaction AND inventory to SHARED storage atomically
    try {
      const userId = currentUser?.id
      if (!userId) {
        throw new Error('User not authenticated')
      }
      
      // Get admin ID for storage
      const adminId = getAdminIdForStorage(currentUser)
      
      // Read from admin-specific storage for inventory, transactions, and customers
      const sharedData = await readSharedData(adminId)
      // Read from user-specific storage for expenses
      const userData = await readData(userId)
      
      // Calculate VAT and per-item breakdown
      const cartTotals = calculateCartTotals(cart, discount, 0.16)
      const itemsWithVAT = calculateItemVAT(cart, 0.16)
      
      const transaction = {
        id: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date().toISOString(),
        userId: userId, // Track which user made the transaction
        cashier: currentUser?.name || 'Unknown',
        cashierId: userId,
        branchId: currentUser?.branchId ?? 'NO_BRANCH', // Track which branch this sale belongs to
        customerId: finalCustomer?.id || null,
        customerName: finalCustomer?.name || null,
        items: itemsWithVAT.map(item => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
          itemTotal: item.itemTotal,
          itemVAT: item.itemVAT,
          itemPriceBeforeVAT: item.itemPriceBeforeVAT,
          vatRate: item.vatRate
        })),
        subtotal: cartTotals.subtotal,
        discount: discount,
        discountAmount: cartTotals.discountAmount,
        priceBeforeVAT: cartTotals.priceBeforeVAT,
        vatAmount: cartTotals.totalVAT,
        vatRate: 0.16,
        total: cartTotals.total,
        paymentMethod: finalPaymentMethod,
        paymentStatus: finalPaymentMethod === 'credit' ? 'pending' : 'completed',
        itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
        // Age verification compliance (Alcoholic Drinks Control Act, 2010)
        ageVerified: true,
        ageVerifiedAt: new Date().toISOString(),
        ageVerifiedBy: currentUser?.name || 'Unknown'
      }
      
      console.log('💳 Transaction saved with branchId:', transaction.branchId, '(from user:', currentUser?.name, ')')
            if (!transaction.branchId || transaction.branchId === 'NO_BRANCH') {
              console.warn('❗ Transaction branchId missing or invalid! User:', currentUser)
            }
      
      const transactions = sharedData.transactions || []
      transactions.push(transaction)
      
      // Update customer balance and loan amount if credit sale
      let updatedCustomers = sharedData.customers || []
      let updatedExpenses = userData.expenses || []
      
      if (finalPaymentMethod === 'credit' && finalCustomer) {
        const currentDate = new Date().toISOString()
        // Default loan duration in days
        const DEFAULT_LOAN_DURATION_DAYS = 30
        const defaultDueDate = new Date(Date.now() + DEFAULT_LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
        
        updatedCustomers = updatedCustomers.map(c =>
          c.id === finalCustomer.id
            ? { 
                ...c, 
                balance: (c.balance || 0) + total,
                loanAmount: (c.loanAmount || 0) + total,
                loanDate: c.loanDate || currentDate,
                loanDueDate: c.loanDueDate || defaultDueDate
              }
            : c
        )
        
        // Create expense entry for credit sale (money owed to business)
        const expenseEntry = {
          id: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          date: currentDate,
          category: 'Credit Sales',
          description: `Credit sale to ${finalCustomer.name} (Transaction: ${transaction.id})`,
          amount: total,
          paymentMethod: 'Credit',
          notes: `Customer loan - Due: ${new Date(defaultDueDate).toLocaleDateString()}`,
          transactionId: transaction.id,
          customerId: finalCustomer.id,
          createdBy: userId
        }
        
        updatedExpenses.push(expenseEntry)
      }
      
      // CRITICAL: Merge inventory from all branches to prevent data loss
      const allInventoryItems = sharedData.inventory || []
      const currentBranch = currentUser.branchId
      
      // Filter out items from current branch (we'll replace them with updated quantities)
      const otherBranchItems = currentBranch 
        ? allInventoryItems.filter(item => item.branchId !== currentBranch)
        : []
      
      // Combine: other branches' items (unchanged) + current branch items (updated quantities)
      const mergedInventory = [
        ...otherBranchItems,
        ...updatedBranchInventory
      ]
      
      // DEBUG: Log detailed breakdown of merged inventory
      console.log(`💾 PosPage: Merging inventory - Other branches: ${otherBranchItems.length}, Current branch: ${updatedBranchInventory.length}, Total: ${mergedInventory.length}`)
      console.log(`🔍 Merged inventory breakdown:`)
      const branchBreakdown = {}
      mergedInventory.forEach(item => {
        const branch = item.branchId || 'NO_BRANCH'
        branchBreakdown[branch] = (branchBreakdown[branch] || 0) + 1
        console.log(`   - ${item.name} (ID: ${item.id}, Branch: ${item.branchId}, Qty: ${item.quantity})`)
      })
      console.log(`📊 By branch:`, branchBreakdown)
      
      // Save inventory, transactions, and customers to admin-specific storage
      console.log(`💾 PosPage: Saving transaction with ${mergedInventory.length} products, ${transactions.length} transactions`)
      
      // DEBUG: What are we actually saving?
      console.log(`🚨 ABOUT TO SAVE - Inventory items:`)
      mergedInventory.forEach(item => {
        console.log(`   ${item.name}: branchId="${item.branchId}", id="${item.id}", qty=${item.quantity}`)
      })
      
      await writeSharedData({
        ...sharedData,
        inventory: mergedInventory,
        transactions: transactions,
        customers: updatedCustomers
      }, adminId)
      
      console.log(`✅ PosPage: Transaction saved successfully`)
      
      // DEBUG: Verify what was saved by reading it back
      const verifyData = await readSharedData(adminId)
      console.log(`🔍 VERIFICATION - After save, DB has ${verifyData.inventory?.length || 0} items:`)
      verifyData.inventory?.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.name}: branchId="${item.branchId}", id="${item.id}", qty=${item.quantity}`)
      })
      
      // Save expenses to user-specific storage (only admin can see expenses)
      await writeData({
        ...userData,
        expenses: updatedExpenses
      }, userId)
      
      // Update local state immediately for instant UI feedback (use branch-specific inventory for UI)
      setInventory(updatedBranchInventory)
      setTransactions(transactions)
      setCustomers(updatedCustomers)
      
      // Also update parent component
      if (onInventoryChange) {
        onInventoryChange(updatedBranchInventory)
      }
      
      // Log activity
      await logActivity(
        ACTIVITY_TYPES.TRANSACTION_COMPLETED,
        `Transaction completed: ${cart.length} items, Total: KES ${total.toLocaleString()}`,
        {
          transactionId: transaction.id,
          itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
          total: total,
          paymentMethod: finalPaymentMethod,
          customerId: finalCustomer?.id,
          customerName: finalCustomer?.name,
          branchId: currentUser?.branchId || null
        },
        currentUser
      )
      
      // Show success message
      const paymentText = finalPaymentMethod === 'mpesa' ? 'M-Pesa' : 
                          finalPaymentMethod === 'credit' ? 'Credit' : 'Cash'
      toast.success('Transaction completed successfully!', {
        description: finalPaymentMethod === 'credit' 
          ? `Credit sale of KES ${total.toLocaleString()} for ${finalCustomer?.name} (tracked as expense)`
          : `Payment of KES ${total.toLocaleString()} received via ${paymentText}`,
        duration: 3000,
      })
      
      // Close modals and show receipt after a brief delay to let user see the success message
      setShowMPesaModal(false)
      setShowCashModal(false)
      setTimeout(() => {
        setShowReceiptModal(true)
      }, 500)
    } catch (error) {
      console.error('Error saving transaction:', error)
      toast.error('Failed to save transaction', {
        description: 'Please try again or contact support if the issue persists.',
      })
      // Don't show receipt if save failed
    }
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const handleNewSale = () => {
    setCart([])
    setPaymentMethod(null)
    setShowReceiptModal(false)
    setDiscount(0)
    setSelectedCustomer(null)
  }

  const handleCreditCustomerSelect = async (customer) => {
    setSelectedCustomer(customer)
    setShowCreditSaleModal(false)
    // Proceed with credit checkout
    await handleCheckout("credit", customer)
  }

  const handleCreateCreditCustomer = async (newCustomerData) => {
    try {
      const userId = currentUser?.id
      if (!userId) {
        toast.error('User not authenticated')
        return
      }

      // Get admin ID for storage
      const adminId = getAdminIdForStorage(currentUser)

      // Read from admin-specific storage for customers
      const sharedData = await readSharedData(adminId)
      const maxId = Math.max(0, ...(sharedData.customers || []).map(c => c.id))
      
      const customerToAdd = {
        ...newCustomerData,
        id: maxId + 1,
        balance: 0,
        createdDate: new Date().toISOString(),
      }

      const updatedCustomers = [...(sharedData.customers || []), customerToAdd]
      
      // Save to admin-specific storage
      await writeSharedData({
        ...sharedData,
        customers: updatedCustomers
      }, adminId)

      setCustomers(updatedCustomers)
      
      toast.success('Customer created successfully!', {
        description: `${customerToAdd.name} has been added to your customers`,
      })

      // Auto-select the new customer and close modal
      setSelectedCustomer(customerToAdd)
      setShowCreditSaleModal(false)
      
      // Proceed with credit checkout
      await handleCheckout("credit", customerToAdd)
    } catch (error) {
      console.error('Error adding customer:', error)
      toast.error('Failed to create customer', {
        description: 'Please try again or contact support if the issue persists.',
      })
    }
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discountAmount = (subtotal * discount) / 100
  const total = subtotal - discountAmount

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar 
        title="Point of Sale" 
        subtitle="Process transactions efficiently"
        actions={[
          <div key="view-toggle" className="hidden sm:flex items-center bg-muted/50 rounded-xl p-1 ring-1 ring-border/50 shadow-inner">
            <button
              onClick={() => setViewMode("table")}
              className={`px-4 py-2 rounded-lg font-semibold transition-all touch-manipulation ${
                viewMode === "table" 
                  ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md scale-105" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              📋 Table
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-4 py-2 rounded-lg font-semibold transition-all touch-manipulation ${
                viewMode === "grid" 
                  ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md scale-105" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              🔲 Grid
            </button>
          </div>,
          <button
            key="clear"
            onClick={clearCart}
            disabled={cart.length === 0}
            className="px-3 sm:px-4 py-2 bg-destructive/10 hover:bg-destructive/20 active:bg-destructive/30 text-destructive rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation text-sm sm:text-base"
          >
            🗑️ <span className="hidden sm:inline">Clear Cart</span>
          </button>
        ]}
      />
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden gap-4 sm:gap-6 p-3 sm:p-6">
        {/* Products Section */}
        <div className="flex-1 flex flex-col min-w-0 order-2 lg:order-1">
          {/* Search and Filters */}
          <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:gap-3">
            {/* Barcode Scanner Help */}
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-lg">📦</span>
              <span className="text-xs text-green-700 dark:text-green-300">
                <strong>Barcode Scanner Ready:</strong> Just scan any product - it will be added to cart automatically!
              </span>
            </div>
            
            {/* Barcode Scanner Indicator */}
            {barcodeBuffer.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-600 rounded-lg px-4 py-2 flex items-center gap-3 animate-pulse">
                <span className="text-2xl">🔍</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">Scanning Barcode...</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">{barcodeBuffer}</div>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 sm:gap-3">
              <input
                type="text"
                placeholder="🔍 Search products or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground text-sm sm:text-base"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground font-semibold text-sm sm:text-base"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Expiry Status</label>
                <select
                  value={expiryFilter}
                  onChange={(e) => setExpiryFilter(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground font-semibold text-sm sm:text-base"
                >
                  {EXPIRY_FILTERS.map(filter => (
                    <option key={filter} value={filter}>{filter}</option>
                  ))}
                </select>
              </div>
              {selectedCustomer?.specialPricing && (
                <div className="flex items-center bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-lg px-3 sm:px-4 py-2">
                  <span className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300">
                    💰 {selectedCustomer.discountRate}% Special Pricing Active
                  </span>
                </div>
              )}
            </div>
            {/* Mobile view toggle */}
            <div className="flex sm:hidden gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex-1 px-3 py-2 rounded-xl font-semibold transition-all touch-manipulation ${
                  viewMode === "grid" 
                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg" 
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
                style={{ boxShadow: viewMode === "grid" ? '0 10px 15px -3px rgba(34, 84, 61, 0.3)' : 'none' }}
              >
                🔲 Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex-1 px-3 py-2 rounded-xl font-semibold transition-all touch-manipulation ${
                  viewMode === "table" 
                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg" 
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
                style={{ boxShadow: viewMode === "table" ? '0 10px 15px -3px rgba(34, 84, 61, 0.3)' : 'none' }}
              >
                📋 List
              </button>
            </div>
          </div>
          <div id="products-section" className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-1">
              {viewMode === "table" ? (
                <ProductTable 
                  products={paginatedProducts} 
                  onAddProduct={addToCart} 
                  cart={cart}
                  selectedCustomer={selectedCustomer}
                  branchId={currentUser?.branchId}
                />
              ) : (
                <ProductGrid 
                  products={paginatedProducts} 
                  onAddProduct={addToCart} 
                  cart={cart}
                  branchId={currentUser?.branchId}
                />
              )}
            </div>

            {/* Pagination */}
            {totalProducts > 10 && (
              <div className="mt-auto">
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalProducts}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-full lg:w-96 flex-shrink-0 order-1 lg:order-2">
          <CartPanel
            items={cart}
            subtotal={subtotal}
            discount={discount}
            onDiscountChange={setDiscount}
            total={total}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateQuantity}
            onUpdatePrice={updatePrice}
            onCheckout={handleCheckout}
            selectedCustomer={selectedCustomer}
          />
        </div>
      </div>

      {showMPesaModal && (
        <MPesaModal total={total} onClose={() => setShowMPesaModal(false)} onComplete={handleCompletePayment} />
      )}

      {showCashModal && (
        <CashPaymentModal total={total} onClose={() => setShowCashModal(false)} onComplete={handleCompletePayment} />
      )}

      {showReceiptModal && (
        <ReceiptModal
          items={cart}
          subtotal={subtotal}
          discount={discount}
          total={total}
          paymentMethod={paymentMethod}
          currentUser={currentUser}
          onClose={() => setShowReceiptModal(false)}
          onNewSale={handleNewSale}
        />
      )}

      {showCreditSaleModal && (
        <CreditSaleModal
          customers={customers}
          onSelectCustomer={handleCreditCustomerSelect}
          onCreateCustomer={handleCreateCreditCustomer}
          onClose={() => setShowCreditSaleModal(false)}
        />
      )}
    </div>
  )
}
