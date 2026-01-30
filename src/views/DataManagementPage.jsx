"use client"

import { useState, useEffect } from "react"
import { jsPDF } from "jspdf"
import "jspdf-autotable"
import TopBar from "../components/TopBar"
import AdminTrashBin from "../components/AdminTrashBin"
import { readData, writeData, exportData, importData, getStorageMode, readSharedData, writeSharedData, getStorageInfo } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"
import { 
  performDailyBackup, 
  getAllBackups, 
  restoreFromBackup, 
  getBackupStats, 
  deleteBackup, 
  deleteAllBackups,
  downloadBackupAsJSON,
  convertToCSV,
  downloadCSV
} from "../utils/autoBackup"
import { 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2,
  Database,
  HardDrive,
  Package,
  ShoppingCart,
  TrendingUp,
  FileText,
  FileSpreadsheet,
  Clock,
  Shield
} from "lucide-react"

export default function DataManagementPage({ currentUser }) {
  // Admin-only access check
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8 bg-card border border-border rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            This page is only accessible to administrators.
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact your administrator if you need access to backup and restore features.
          </p>
        </div>
      </div>
    )
  }

  const [data, setData] = useState(null)
  const [storageMode, setStorageMode] = useState("web")
  const [storageInfo, setStorageInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [importStatus, setImportStatus] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [lastBackupDate, setLastBackupDate] = useState(null)
  const [backupStats, setBackupStats] = useState(null)
  const [indexedDBBackups, setIndexedDBBackups] = useState([])
  const [showTrashBin, setShowTrashBin] = useState(false)
  const [showBackupHistory, setShowBackupHistory] = useState(false)

  useEffect(() => {
    loadData()
    setStorageMode(getStorageMode())
    loadLastBackupDate()
    loadStorageInfo()
    loadBackupStats()
    performAutoBackup()
  }, [currentUser])

  const loadStorageInfo = async () => {
    try {
      const info = await getStorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.error('Error loading storage info:', error)
    }
  }

  const loadBackupStats = async () => {
    try {
      const stats = await getBackupStats()
      setBackupStats(stats)
      setIndexedDBBackups(stats.backups || [])
    } catch (error) {
      console.error('Error loading backup stats:', error)
    }
  }

  const performAutoBackup = async () => {
    try {
      if (!currentUser?.id) return
      
      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      const result = await performDailyBackup(sharedData, {
        lastBackupDate: localStorage.getItem('last-indexeddb-backup')
      })
      
      if (result.success) {
        localStorage.setItem('last-indexeddb-backup', result.backup.date)
        await loadBackupStats()
        console.log('✅ Auto-backup successful:', result.message)
      } else if (result.quotaExceeded) {
        console.warn('⚠️ IndexedDB quota exceeded:', result.message)
        setImportStatus({
          success: false,
          message: '⚠️ Auto-backup storage full',
          details: result.message
        })
        setTimeout(() => setImportStatus(null), 8000)
      }
    } catch (error) {
      console.error('Auto-backup error:', error)
    }
  }

  const loadLastBackupDate = () => {
    const userId = currentUser?.id
    const backupKey = `last-backup-date-${userId}`
    const lastBackup = localStorage.getItem(backupKey)
    if (lastBackup) {
      setLastBackupDate(new Date(lastBackup))
    }
  }

  const saveLastBackupDate = () => {
    const userId = currentUser?.id
    const backupKey = `last-backup-date-${userId}`
    const now = new Date().toISOString()
    localStorage.setItem(backupKey, now)
    setLastBackupDate(new Date(now))
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const userId = currentUser?.id
      if (!userId) {
        console.error('No user ID available')
        return
      }
      // Load both user-specific and shared data
      const userData = await readData(userId)
      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      
      // Merge data for display - use shared data for inventory and transactions
      const mergedData = {
        ...userData,
        inventory: sharedData.inventory || [],
        transactions: sharedData.transactions || []
      }
      setData(mergedData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const userId = currentUser?.id
      // Calculate stats for the message
      const products = data?.inventory?.length || 0
      const transactions = data?.transactions?.length || 0
      
      const result = await exportData(data, userId)
      if (result.success || result) {
        saveLastBackupDate()
        setImportStatus({ 
          success: true, 
          message: '✅ Backup created successfully! Your business data is safe.',
          details: `Backed up ${products} products and ${transactions} transactions`
        })
        setTimeout(() => setImportStatus(null), 5000)
      } else {
        setImportStatus({ 
          success: false, 
          message: '❌ Failed to create backup: ' + (result.error || 'Unknown error'),
          details: 'Please try again or contact support if the problem persists.'
        })
        setTimeout(() => setImportStatus(null), 5000)
      }
    } catch (error) {
      setImportStatus({ 
        success: false, 
        message: '❌ Error creating backup: ' + error.message,
        details: 'Please try again or contact support if the problem persists.'
      })
      setTimeout(() => setImportStatus(null), 5000)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportElectron = async () => {
    setIsImporting(true)
    try {
      const userId = currentUser?.id
      if (!userId) {
        setImportStatus({ 
          success: false, 
          message: '❌ Not authenticated',
          details: 'Please log in again and try restoring your backup.'
        })
        setTimeout(() => setImportStatus(null), 5000)
        return
      }
      
      setImportStatus({ 
        success: null, 
        message: '⏳ Restoring your business data...',
        details: 'Please wait while we restore your backup.'
      })
      
      const result = await importData(userId)
      if (result.success && result.data) {
        await writeData(result.data, userId)
        setData(result.data)
        
        setImportStatus({ 
          success: true, 
          message: `✅ Successfully restored ${result.data.inventory?.length || 0} products and ${result.data.transactions?.length || 0} transactions!`,
          details: 'Your business data has been restored from backup.'
        })
        setTimeout(() => setImportStatus(null), 5000)
      } else {
        setImportStatus({ 
          success: false, 
          message: result.error === 'Import cancelled' ? '⚠️ Restore cancelled' : '❌ Failed to restore backup',
          details: result.error || 'No backup file was selected.'
        })
        setTimeout(() => setImportStatus(null), 5000)
      }
    } catch (error) {
      setImportStatus({ 
        success: false, 
        message: '❌ Error restoring backup: ' + error.message,
        details: 'Please try again or contact support if the problem persists.'
      })
      setTimeout(() => setImportStatus(null), 5000)
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportWeb = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setIsImporting(true)
    try {
      const userId = currentUser?.id
      if (!userId) {
        setImportStatus({ 
          success: false, 
          message: '❌ Not authenticated',
          details: 'Please log in again and try restoring your backup.'
        })
        setTimeout(() => setImportStatus(null), 5000)
        return
      }
      
      setImportStatus({ 
        success: null, 
        message: '⏳ Restoring your business data...',
        details: 'Please wait while we restore your backup.'
      })
      
      const text = await file.text()
      const importedData = JSON.parse(text)
      
      // Validate data structure
      if (!importedData.inventory || !importedData.transactions) {
        setImportStatus({ 
          success: false, 
          message: '❌ Invalid backup file',
          details: 'The file you selected is not a valid backup. Please select a correct backup file.'
        })
        setTimeout(() => setImportStatus(null), 5000)
        return
      }

      await writeData(importedData, userId)
      setData(importedData)
      
      setImportStatus({ 
        success: true, 
        message: `✅ Successfully restored ${importedData.inventory?.length || 0} products and ${importedData.transactions?.length || 0} transactions!`,
        details: 'Your business data has been restored from backup.'
      })
      setTimeout(() => setImportStatus(null), 5000)
    } catch (error) {
      setImportStatus({ 
        success: false, 
        message: '❌ Error restoring backup: ' + error.message,
        details: 'The backup file may be corrupted. Please try a different backup file.'
      })
      setTimeout(() => setImportStatus(null), 5000)
    } finally {
      setIsImporting(false)
    }
    
    // Reset input
    event.target.value = ''
  }

  const handleClearData = async () => {
    if (!window.confirm('⚠️ WARNING: Delete All Business Data?\n\nThis will permanently delete:\n• All products\n• All sales transactions\n• All suppliers\n• All purchase orders\n• All customer records\n• All expenses\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
      return
    }

    // Second confirmation for safety
    if (!window.confirm('⛔ FINAL WARNING!\n\nThis is your last chance to cancel.\n\nClick OK to permanently delete all your business data.')) {
      return
    }

    const userId = currentUser?.id
    if (!userId) {
      setImportStatus({ 
        success: false, 
        message: '❌ Not authenticated',
        details: 'Please log in again to perform this action.'
      })
      setTimeout(() => setImportStatus(null), 5000)
      return
    }

    const emptyData = {
      inventory: [],
      transactions: [],
      suppliers: [],
      purchaseOrders: [],
      goodsReceivedNotes: [],
      supplierPayments: [],
      stockAdjustments: [],
      customers: [],
      expenses: [],
      settings: {
        storeName: 'Whiskey Ballet',
        currency: 'KES',
        vatRate: 0.16,
        vatEnabled: true,
        spendingLimitPercentage: 50,
        enableSpendingAlerts: true,
        lastBackupDate: null
      },
      lastSync: null
    }

    try {
      // Use adminId to clear shared data (inventory, transactions, etc.)
      const adminId = getAdminIdForStorage(currentUser)
      await writeSharedData(emptyData, adminId)
      
      // Also clear user-specific data
      await writeData(emptyData, userId)
      
      setData(emptyData)
      setImportStatus({ 
        success: true, 
        message: '✅ All business data has been deleted',
        details: 'You can now start fresh or restore from a previous backup.'
      })
      setTimeout(() => setImportStatus(null), 5000)
    } catch (error) {
      setImportStatus({ 
        success: false, 
        message: '❌ Error deleting data: ' + error.message,
        details: 'Please try again or contact support if the problem persists.'
      })
      setTimeout(() => setImportStatus(null), 5000)
    }
  }

  const exportDataToPDF = () => {
    if (!data) {
      setImportStatus({ 
        success: false, 
        message: '❌ No data available to export',
        details: 'Please wait for data to load first.'
      })
      return
    }

    const doc = new jsPDF()

    // Title
    doc.setFontSize(20)
    doc.text('Whiskey Ballet - Business Data Report', 14, 20)
    
    // Summary
    doc.setFontSize(12)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, 14, 30)
    doc.text(`Total Products: ${dataStats.products}`, 14, 38)
    doc.text(`Total Transactions: ${dataStats.transactions}`, 14, 46)
    doc.text(`Total Sales: KES ${dataStats.totalSales.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, 14, 54)

    // Products Table
    if (data.inventory && data.inventory.length > 0) {
      doc.text('Products', 14, 68)
      const productHeaders = ['Name', 'SKU', 'Category', 'Price', 'Stock', 'Status']
      const productRows = data.inventory.map(p => [
        p.name,
        p.sku,
        p.category,
        `KES ${p.sellingPrice?.toFixed(2) || 0}`,
        p.quantity || 0,
        (p.quantity || 0) > 0 ? 'In Stock' : 'Out of Stock'
      ])
      
      doc.autoTable({
        startY: 72,
        head: [productHeaders],
        body: productRows,
        theme: 'grid',
        headStyles: { fillColor: [107, 15, 26], textColor: 255 },
        styles: { fontSize: 8 }
      })
    }

    // Transactions Table
    if (data.transactions && data.transactions.length > 0) {
      const finalY = doc.lastAutoTable?.finalY || 72
      doc.text('Recent Transactions', 14, finalY + 14)
      
      const transactionHeaders = ['Date', 'Method', 'Items', 'Total']
      const transactionRows = data.transactions.slice(-20).map(t => [
        new Date(t.timestamp).toLocaleDateString('en-KE'),
        t.paymentMethod || 'Cash',
        t.items?.length || 0,
        `KES ${(t.total || 0).toFixed(2)}`
      ])
      
      doc.autoTable({
        startY: finalY + 18,
        head: [transactionHeaders],
        body: transactionRows,
        theme: 'grid',
        headStyles: { fillColor: [212, 175, 55], textColor: [44, 24, 16] },
        styles: { fontSize: 8 }
      })
    }

    doc.save(`whiskeyballet-report-${new Date().toISOString().split('T')[0]}.pdf`)
    
    setImportStatus({ 
      success: true, 
      message: '✅ PDF report generated successfully!',
      details: 'The report has been downloaded to your device.'
    })
    setTimeout(() => setImportStatus(null), 3000)
  }

  const exportProductsToCSV = () => {
    if (!data?.inventory || data.inventory.length === 0) {
      setImportStatus({ 
        success: false, 
        message: '❌ No products to export',
        details: 'Add some products first.'
      })
      setTimeout(() => setImportStatus(null), 3000)
      return
    }

    const headers = ['Name', 'SKU', 'Category', 'Cost Price', 'Selling Price', 'VAT Amount', 'Quantity', 'Low Stock Alert', 'Alcohol %', 'Bottle Size', 'KEBS Number', 'Inventory Units']
    const csvData = data.inventory.map(p => ({
      'Name': p.name || '',
      'SKU': p.sku || '',
      'Category': p.category || '',
      'Cost Price': p.costPrice || 0,
      'Selling Price': p.sellingPrice || 0,
      'VAT Amount': p.vatAmount || 0,
      'Quantity': p.quantity || 0,
      'Low Stock Alert': p.lowStockAlert || 0,
      'Alcohol %': p.alcoholPercentage || '',
      'Bottle Size': p.bottleSize || '',
      'KEBS Number': p.kebsNumber || '',
      'Inventory Units': p.inventoryUnits || ''
    }))

    const csv = convertToCSV(csvData, headers)
    downloadCSV(csv, `whiskeyballet-products-${new Date().toISOString().split('T')[0]}.csv`)
    
    setImportStatus({ 
      success: true, 
      message: `✅ Exported ${data.inventory.length} products to CSV`,
      details: 'The file has been downloaded to your device.'
    })
    setTimeout(() => setImportStatus(null), 3000)
  }

  const exportTransactionsToCSV = () => {
    if (!data?.transactions || data.transactions.length === 0) {
      setImportStatus({ 
        success: false, 
        message: '❌ No transactions to export',
        details: 'Complete some sales first.'
      })
      setTimeout(() => setImportStatus(null), 3000)
      return
    }

    const headers = ['Date', 'Time', 'Payment Method', 'Items Count', 'Subtotal', 'VAT', 'Total', 'Age Verified', 'Cashier']
    const csvData = data.transactions.map(t => {
      const date = new Date(t.timestamp)
      return {
        'Date': date.toLocaleDateString('en-KE'),
        'Time': date.toLocaleTimeString('en-KE'),
        'Payment Method': t.paymentMethod || 'Cash',
        'Items Count': t.items?.length || 0,
        'Subtotal': t.subtotal || 0,
        'VAT': t.vatAmount || 0,
        'Total': t.total || 0,
        'Age Verified': t.ageVerified ? 'Yes' : 'No',
        'Cashier': t.cashierName || 'Unknown'
      }
    })

    const csv = convertToCSV(csvData, headers)
    downloadCSV(csv, `whiskeyballet-transactions-${new Date().toISOString().split('T')[0]}.csv`)
    
    setImportStatus({ 
      success: true, 
      message: `✅ Exported ${data.transactions.length} transactions to CSV`,
      details: 'The file has been downloaded to your device.'
    })
    setTimeout(() => setImportStatus(null), 3000)
  }

  const exportAllDataToCSV = () => {
    if (!data) {
      setImportStatus({ 
        success: false, 
        message: '❌ No data to export',
        details: 'No data available in the system.'
      })
      setTimeout(() => setImportStatus(null), 3000)
      return
    }

    // Create comprehensive data export with all fields
    const headers = [
      'Data Type', 'Name/Description', 'SKU/ID', 'Category', 
      'Cost Price (KES)', 'Selling Price (KES)', 'VAT Amount (KES)', 'Profit (KES)', 'Margin (%)',
      'Quantity/Count', 'Low Stock Alert', 'Date/Time', 'Payment Method',
      'Alcohol %', 'Bottle Size', 'KEBS Number', 'Units', 'Status', 'Additional Info'
    ]

    const allData = []

    // Add products
    if (data.inventory && data.inventory.length > 0) {
      data.inventory.forEach(p => {
        allData.push({
          'Data Type': 'Product',
          'Name/Description': p.name || '',
          'SKU/ID': p.sku || '',
          'Category': p.category || '',
          'Cost Price (KES)': p.costPrice || 0,
          'Selling Price (KES)': p.sellingPrice || p.price || 0,
          'VAT Amount (KES)': p.vatAmount || 0,
          'Profit (KES)': p.profit || 0,
          'Margin (%)': p.margin || 0,
          'Quantity/Count': p.quantity || 0,
          'Low Stock Alert': p.reorderLevel || 0,
          'Date/Time': p.addedDate || '',
          'Payment Method': '',
          'Alcohol %': p.alcoholPercentage || '',
          'Bottle Size': p.bottleSize || '',
          'KEBS Number': p.kebsNumber || '',
          'Units': p.inventoryUnits || 'bottle',
          'Status': (p.quantity || 0) > 0 ? 'In Stock' : 'Out of Stock',
          'Additional Info': p.expiryDate ? `Expiry: ${p.expiryDate}` : ''
        })
      })
    }

    // Add transactions
    if (data.transactions && data.transactions.length > 0) {
      data.transactions.forEach(t => {
        const date = new Date(t.timestamp)
        allData.push({
          'Data Type': 'Transaction',
          'Name/Description': `${t.items?.length || 0} items sold`,
          'SKU/ID': t.id || '',
          'Category': 'Sale',
          'Cost Price (KES)': '',
          'Selling Price (KES)': '',
          'VAT Amount (KES)': t.vatAmount || 0,
          'Profit (KES)': '',
          'Margin (%)': '',
          'Quantity/Count': t.items?.length || 0,
          'Low Stock Alert': '',
          'Date/Time': `${date.toLocaleDateString('en-KE')} ${date.toLocaleTimeString('en-KE')}`,
          'Payment Method': t.paymentMethod || 'Cash',
          'Alcohol %': '',
          'Bottle Size': '',
          'KEBS Number': '',
          'Units': '',
          'Status': t.paymentStatus || 'Completed',
          'Additional Info': `Total: KES ${t.total || 0}, Cashier: ${t.cashierName || 'Unknown'}`
        })
      })
    }

    const csv = convertToCSV(allData, headers)
    const fileName = `whiskeyballet-complete-backup-${new Date().toISOString().split('T')[0]}.csv`
    downloadCSV(csv, fileName)
    
    const productCount = data.inventory?.length || 0
    const transactionCount = data.transactions?.length || 0
    
    setImportStatus({ 
      success: true, 
      message: `✅ Complete backup exported! ${productCount} products & ${transactionCount} transactions`,
      details: `File saved as: ${fileName}`
    })
    setTimeout(() => setImportStatus(null), 5000)
  }

  const handleRestoreFromIndexedDB = async (backupId) => {
    if (!window.confirm('Restore from this backup? This will replace your current data.')) {
      return
    }

    try {
      const dateString = backupId.replace('backup-', '')
      const result = await restoreFromBackup(dateString)
      
      if (result.success) {
        const adminId = getAdminIdForStorage(currentUser)
        await writeSharedData(result.data, adminId)
        setData(result.data)
        
        setImportStatus({ 
          success: true, 
          message: `✅ Restored from backup (${dateString})`,
          details: `Restored ${result.data.inventory?.length || 0} products and ${result.data.transactions?.length || 0} transactions.`
        })
        setTimeout(() => setImportStatus(null), 5000)
        await loadData()
      } else {
        setImportStatus({ 
          success: false, 
          message: '❌ Restore failed',
          details: result.message
        })
        setTimeout(() => setImportStatus(null), 5000)
      }
    } catch (error) {
      setImportStatus({ 
        success: false, 
        message: '❌ Error restoring backup: ' + error.message,
        details: 'Please try again or use a JSON backup file.'
      })
      setTimeout(() => setImportStatus(null), 5000)
    }
  }

  const handleDeleteIndexedDBBackup = async (backupId) => {
    if (!window.confirm('Delete this backup? This cannot be undone.')) {
      return
    }

    try {
      await deleteBackup(backupId)
      await loadBackupStats()
      
      setImportStatus({ 
        success: true, 
        message: '✅ Backup deleted',
        details: 'The backup has been removed from auto-backup storage.'
      })
      setTimeout(() => setImportStatus(null), 3000)
    } catch (error) {
      setImportStatus({ 
        success: false, 
        message: '❌ Error deleting backup: ' + error.message
      })
      setTimeout(() => setImportStatus(null), 3000)
    }
  }

  const handleDownloadIndexedDBBackup = async (backupId) => {
    try {
      const dateString = backupId.replace('backup-', '')
      const result = await restoreFromBackup(dateString)
      
      if (result.success) {
        downloadBackupAsJSON(result.data, `whiskeyballet-backup-${dateString}.json`)
        
        setImportStatus({ 
          success: true, 
          message: '✅ Backup downloaded',
          details: 'The JSON backup file has been saved to your device.'
        })
        setTimeout(() => setImportStatus(null), 3000)
      }
    } catch (error) {
      setImportStatus({ 
        success: false, 
        message: '❌ Error downloading backup: ' + error.message
      })
      setTimeout(() => setImportStatus(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Backup & Restore" subtitle="Keep your business data safe" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your data...</p>
          </div>
        </div>
      </div>
    )
  }

  const dataStats = {
    products: data?.inventory?.length || 0,
    transactions: data?.transactions?.length || 0,
    totalSales: data?.transactions?.reduce((sum, t) => sum + (t.total || 0), 0) || 0,
    storageSize: new Blob([JSON.stringify(data)]).size
  }

  // Constants for backup warnings
  const UNKNOWN_USER_ID = 'unknown'
  const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
  const HIGH_WARNING_DAYS = 7
  const MEDIUM_WARNING_DAYS = 3
  
  const displayUserId = currentUser?.id || UNKNOWN_USER_ID

  // Calculate days since last backup
  const daysSinceBackup = lastBackupDate 
    ? Math.floor((new Date() - lastBackupDate) / MILLISECONDS_PER_DAY)
    : null

  const getBackupWarning = () => {
    if (!lastBackupDate) return { show: true, level: 'high', message: 'No backup created yet' }
    if (daysSinceBackup > HIGH_WARNING_DAYS) return { show: true, level: 'high', message: `Last backup was ${daysSinceBackup} days ago` }
    if (daysSinceBackup > MEDIUM_WARNING_DAYS) return { show: true, level: 'medium', message: `Last backup was ${daysSinceBackup} days ago` }
    return { show: false, level: 'low', message: 'Backup is recent' }
  }

  const backupWarning = getBackupWarning()

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Backup & Export" subtitle="Export your business data as CSV files" />

      <div className="p-6 flex-1 overflow-auto">
        {/* Status Message */}
        {importStatus && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            importStatus.success === null
              ? 'bg-blue-50 border-blue-500 text-blue-800'
              : importStatus.success 
              ? 'bg-green-50 border-green-500 text-green-800' 
              : 'bg-red-50 border-red-500 text-red-800'
          }`}>
            <p className="font-semibold text-lg">{importStatus.message}</p>
            {importStatus.details && (
              <p className="text-sm mt-1">{importStatus.details}</p>
            )}
          </div>
        )}

        {/* Backup Warning */}
        {backupWarning.show && !importStatus && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            backupWarning.level === 'high'
              ? 'bg-red-50 border-red-500 text-red-800'
              : 'bg-yellow-50 border-yellow-500 text-yellow-800'
          }`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-lg">⚠️ {backupWarning.message}</p>
                <p className="text-sm mt-1">
                  We recommend creating a backup at least once a week to keep your business data safe.
                  {' '}Create a backup now to protect your {dataStats.products} products and {dataStats.transactions} transactions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Storage Info */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-foreground">Your Business Data</h2>
          </div>
          
          {/* Storage Space Warning */}
          {storageInfo && storageInfo.mode === 'web' && storageInfo.percentUsed > 70 && (
            <div className={`mb-4 p-4 rounded-lg border-2 ${
              storageInfo.percentUsed > 90
                ? 'bg-red-50 border-red-500 text-red-800'
                : 'bg-yellow-50 border-yellow-500 text-yellow-800'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-lg">
                    {storageInfo.percentUsed > 90 ? '⚠️ Storage Almost Full!' : '⚠️ Storage Getting Full'}
                  </p>
                  <p className="text-sm mt-1">
                    You're using {storageInfo.percentUsed.toFixed(1)}% ({storageInfo.used.toFixed(2)} MB) of your {storageInfo.quota.toFixed(0)} MB browser storage.
                    {storageInfo.percentUsed > 90 ? ' Export and delete old data to free space.' : ' Consider exporting old transactions.'}
                  </p>
                  <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full ${storageInfo.percentUsed > 90 ? 'bg-red-600' : 'bg-yellow-600'}`}
                      style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-blue-700" />
                <p className="text-sm text-blue-700 font-medium">Products</p>
              </div>
              <p className="text-3xl font-bold text-blue-900">{dataStats.products}</p>
              <p className="text-xs text-blue-600 mt-1">Items in inventory</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border-2 border-green-500">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-5 h-5 text-green-700" />
                <p className="text-sm text-green-700 font-medium">Transactions</p>
              </div>
              <p className="text-3xl font-bold text-green-900">{dataStats.transactions}</p>
              <p className="text-xs text-green-600 mt-1">Sales recorded</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-500">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-700" />
                <p className="text-sm text-purple-700 font-medium">Total Sales</p>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                KES {dataStats.totalSales.toLocaleString()}
              </p>
              <p className="text-xs text-purple-600 mt-1">All-time revenue</p>
            </div>
          </div>
          
          {/* Last Backup Info */}
          {lastBackupDate && (
            <div className="mt-4 p-3 bg-green-50 border border-green-300 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Last backup: {lastBackupDate.toLocaleDateString()} at {lastBackupDate.toLocaleTimeString()}
                  {' '}({daysSinceBackup === 0 ? 'Today' : daysSinceBackup === 1 ? 'Yesterday' : `${daysSinceBackup} days ago`})
                </span>
              </div>
            </div>
          )}
          
          {/* Storage Mode Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <HardDrive className="w-5 h-5" />
              <div className="flex-1">
                <span className="text-sm font-medium">
                  {storageMode === 'web' 
                    ? '💾 Stored safely on this device' 
                    : '💾 Stored in secure file system'}
                </span>
                <p className="text-xs text-blue-600 mt-1">
                  {storageMode === 'web' 
                    ? `Using ${(dataStats.storageSize / 1024).toFixed(1)} KB of browser storage`
                    : 'No storage limit in desktop mode'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Trash Bin - Recovery System */}
        {currentUser && currentUser.role === 'admin' && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm mb-6">
            <h2 className="text-xl font-bold text-foreground mb-2">🗑️ Deleted Items Recovery</h2>
            <p className="text-sm text-muted-foreground mb-4">
              View and restore deleted items. Items are safely preserved and can be recovered by admins.
            </p>
            <button
              onClick={() => setShowTrashBin(true)}
              className="flex items-center gap-3 px-6 py-4 bg-linear-to-br from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-600 dark:border-red-700 rounded-lg transition-all group shadow-lg w-full md:w-auto"
            >
              <Trash2 className="w-6 h-6 text-red-700 dark:text-red-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <span className="font-bold text-red-900 dark:text-red-300 text-lg block">Open Trash Bin</span>
                <span className="text-xs text-red-700 dark:text-red-400">View and restore deleted items</span>
              </div>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold text-foreground mb-2">Backup & Export Options</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Export your business data as CSV files for backup, analysis, or accounting purposes. CSV files can be opened in Excel or Google Sheets.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Complete Backup CSV */}
            <button
              onClick={exportAllDataToCSV}
              className="flex flex-col items-start p-6 bg-linear-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-600 dark:border-green-700 rounded-lg transition-all group shadow-lg"
            >
              <div className="flex items-center gap-3 mb-3 w-full">
                <Database className="w-8 h-8 text-green-700 dark:text-green-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="font-bold text-green-900 dark:text-green-300 text-lg block">📊 Complete Backup CSV</span>
                  <span className="text-xs text-green-700 dark:text-green-400">Everything in one file!</span>
                </div>
              </div>
              <div className="text-left w-full">
                <p className="text-sm text-green-800 dark:text-green-300 font-medium mb-1">
                  Export ALL data with prices & details
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {dataStats.products} products + {dataStats.transactions} transactions • Complete business history
                </p>
              </div>
            </button>

            {/* Export Products CSV */}
            <button
              onClick={exportProductsToCSV}
              className="flex flex-col items-start p-6 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:hover:bg-teal-900/30 border-2 border-teal-500 dark:border-teal-700 rounded-lg transition-all group"
            >
              <div className="flex items-center gap-3 mb-3 w-full">
                <FileSpreadsheet className="w-8 h-8 text-teal-700 dark:text-teal-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="font-bold text-teal-900 dark:text-teal-300 text-lg block">Products Only CSV</span>
                  <span className="text-xs text-teal-700 dark:text-teal-400">Inventory list</span>
                </div>
              </div>
              <div className="text-left w-full">
                <p className="text-sm text-teal-800 dark:text-teal-300 font-medium mb-1">
                  Export inventory as CSV spreadsheet
                </p>
                <p className="text-xs text-teal-600 dark:text-teal-400">
                  {dataStats.products} products • For editing and analysis
                </p>
              </div>
            </button>

            {/* Export Transactions CSV */}
            <button
              onClick={exportTransactionsToCSV}
              className="flex flex-col items-start p-6 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 border-2 border-indigo-500 dark:border-indigo-700 rounded-lg transition-all group"
            >
              <div className="flex items-center gap-3 mb-3 w-full">
                <FileSpreadsheet className="w-8 h-8 text-indigo-700 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="font-bold text-indigo-900 dark:text-indigo-300 text-lg block">Transactions Only CSV</span>
                  <span className="text-xs text-indigo-700 dark:text-indigo-400">Sales history</span>
                </div>
              </div>
              <div className="text-left w-full">
                <p className="text-sm text-indigo-800 dark:text-indigo-300 font-medium mb-1">
                  Export sales data as CSV
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  {dataStats.transactions} transactions • For accounting records
                </p>
              </div>
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              className="flex flex-col items-start p-6 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 border-2 border-yellow-500 dark:border-yellow-700 rounded-lg transition-all group"
            >
              <div className="flex items-center gap-3 mb-3 w-full">
                <RefreshCw className="w-8 h-8 text-yellow-700 dark:text-yellow-400 group-hover:rotate-180 transition-transform duration-500" />
                <div className="text-left">
                  <span className="font-bold text-yellow-900 dark:text-yellow-300 text-lg block">Refresh Data</span>
                  <span className="text-xs text-yellow-700 dark:text-yellow-400">Reload from storage</span>
                </div>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 text-left">
                Update the displayed information with latest data
              </p>
            </button>
          </div>

          {/* Auto-Backup Status */}
          {backupStats && backupStats.count > 0 && (
            <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="w-6 h-6 text-blue-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-blue-900 text-lg">📦 Auto-Backup History</h3>
                    <button
                      onClick={() => setShowBackupHistory(!showBackupHistory)}
                      className="text-sm text-blue-700 hover:text-blue-900 font-medium"
                    >
                      {showBackupHistory ? 'Hide' : 'Show'} ({backupStats.count})
                    </button>
                  </div>
                  <p className="text-sm text-blue-700 mb-2">
                    System automatically creates daily backups in IndexedDB storage.
                    {' '}Last 30 days kept • {backupStats.totalSizeMB} MB used
                  </p>
                  
                  {showBackupHistory && (
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                      {indexedDBBackups.map((backup) => (
                        <div key={backup.id} className="flex items-center justify-between p-3 bg-white rounded border border-blue-200">
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-medium text-blue-900">{backup.date}</p>
                              <p className="text-xs text-blue-600">
                                {(backup.size / 1024).toFixed(1)} KB • 
                                {' '}{backup.data?.inventory?.length || 0} products, 
                                {' '}{backup.data?.transactions?.length || 0} transactions
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDownloadIndexedDBBackup(backup.id)}
                              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                              title="Download as JSON"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRestoreFromIndexedDB(backup.id)}
                              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                              title="Restore this backup"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteIndexedDBBackup(backup.id)}
                              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                              title="Delete backup"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Delete Section - Separate and More Prominent Warning */}
          <div className="mt-6 p-4 bg-red-50 border-2 border-red-500 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-red-700 shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-red-900 text-lg mb-1">⚠️ Danger Zone</h3>
                <p className="text-sm text-red-700 mb-3">
                  This action will <strong>permanently delete all your business data</strong>. 
                  Make sure you have a backup before proceeding!
                </p>
                <button
                  onClick={handleClearData}
                  className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all hover:scale-105"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete All Business Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Location Info */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm mt-6">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-foreground">Storage Information</h2>
          </div>
          {storageMode === 'web' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-300">
                <p className="text-foreground font-medium mb-2">
                  💾 Where is my data stored?
                </p>
                <p className="text-sm text-muted-foreground">
                  Your business data is stored <strong>safely on this device</strong> in your browser's secure storage area. 
                  It's private to you and not accessible to other websites.
                </p>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-900 font-semibold mb-1">⚠️ Important: Keep Regular Backups!</p>
                    <p className="text-sm text-yellow-800">
                      Your data may be lost if you:
                    </p>
                    <ul className="text-sm text-yellow-800 mt-2 space-y-1 ml-4">
                      <li>• Clear your browser's data or cookies</li>
                      <li>• Uninstall or reset your browser</li>
                      <li>• Use browser's "Clear History" feature</li>
                      <li>• Switch to a different device or browser</li>
                    </ul>
                    <p className="text-sm text-yellow-900 font-semibold mt-3">
                      💡 Solution: Create regular backups (we recommend weekly) to prevent data loss!
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-900 font-semibold mb-1">✅ How to Keep Your Data Safe</p>
                    <ol className="text-sm text-green-800 space-y-2 ml-4 list-decimal">
                      <li>Click "Backup Your Business" regularly (at least once a week)</li>
                      <li>Save the backup file to a safe location (USB drive, cloud storage, etc.)</li>
                      <li>Keep multiple backups from different dates</li>
                      <li>Test your backup by restoring it occasionally</li>
                    </ol>
                  </div>
                </div>
              </div>

              <details className="bg-muted p-4 rounded-lg">
                <summary className="text-sm font-medium text-foreground cursor-pointer">
                  🔧 Technical Details (for advanced users)
                </summary>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>
                    <span className="font-semibold">Storage Technology:</span> Browser localStorage API
                  </p>
                  <p>
                    <span className="font-semibold">Storage Key:</span>{' '}
                    <code className="bg-background px-2 py-1 rounded text-xs">
                      double-ee-pos-data-user-{displayUserId}
                    </code>
                  </p>
                  <p>
                    <span className="font-semibold">Current Size:</span> {(dataStats.storageSize / 1024).toFixed(2)} KB
                    {' '}(~{((dataStats.storageSize / (10 * 1024 * 1024)) * 100).toFixed(1)}% of typical 10MB limit)
                  </p>
                  <p className="text-xs mt-2">
                    💡 You can view this data in your browser's DevTools:<br />
                    Open DevTools (F12) → Application/Storage → Local Storage → select your domain
                  </p>
                </div>
              </details>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-300">
                <p className="text-foreground font-medium mb-2">
                  💾 Where is my data stored?
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Your business data is stored in a <strong>secure file on your computer</strong>. 
                  This provides better reliability and no storage limits.
                </p>
                <div className="bg-background p-3 rounded border border-border">
                  <p className="text-xs text-muted-foreground mb-1">File Location:</p>
                  <code className="text-sm text-foreground font-mono">
                    ~/.config/double-ee-pos/pos-data-user-{displayUserId}.json
                  </code>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-900 font-semibold mb-1">✅ Desktop Mode Benefits</p>
                    <ul className="text-sm text-green-800 space-y-1 ml-4">
                      <li>• No storage size limits</li>
                      <li>• More reliable than browser storage</li>
                      <li>• Data persists even if you reinstall the app</li>
                      <li>• You can manually copy/backup the file anytime</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-900 font-semibold mb-1">⚠️ Still Create Regular Backups!</p>
                    <p className="text-sm text-yellow-800">
                      Even in desktop mode, create backups to protect against:
                    </p>
                    <ul className="text-sm text-yellow-800 mt-2 space-y-1 ml-4">
                      <li>• Computer crashes or hardware failures</li>
                      <li>• Accidental file deletion</li>
                      <li>• Moving to a different computer</li>
                      <li>• System reinstallation</li>
                    </ul>
                  </div>
                </div>
              </div>

              <details className="bg-muted p-4 rounded-lg">
                <summary className="text-sm font-medium text-foreground cursor-pointer">
                  🔧 Technical Details (for advanced users)
                </summary>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>
                    <span className="font-semibold">View data with:</span>{' '}
                    <code className="bg-background px-2 py-1 rounded text-xs">
                      cat ~/.config/double-ee-pos/pos-data-user-{displayUserId}.json
                    </code>
                  </p>
                  <p>
                    <span className="font-semibold">Backup manually:</span>{' '}
                    <code className="bg-background px-2 py-1 rounded text-xs">
                      cp ~/.config/double-ee-pos/pos-data-user-{displayUserId}.json ~/backup.json
                    </code>
                  </p>
                  <p className="text-xs mt-2">
                    💡 The file is automatically created and updated when you use the app
                  </p>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
      
      {/* Admin Trash Bin Modal */}
      {showTrashBin && currentUser && (
        <AdminTrashBin
          adminId={getAdminIdForStorage(currentUser)}
          onClose={() => setShowTrashBin(false)}
          onRestore={() => {
            // Reload data after restoration
            loadData()
          }}
        />
      )}
    </div>
  )
}
