import React, { useState, useEffect } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { readSharedData, writeSharedData } from "../utils/storage"
import { getAdminIdForStorage } from "../utils/auth"

export default function InventoryCSVUpload({ currentUser, onInventoryUpdate, selectedBranch }) {
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Auto-close success message after 5 seconds
  useEffect(() => {
    if (result && result.errors.length === 0) {
      const timer = setTimeout(() => {
        setResult(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [result])

  const parseCSV = (csvText, targetBranchId = '') => {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid')
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const products = []

    // Required columns
    const requiredColumns = ['name', 'price']
    const missingColumns = requiredColumns.filter(col => !headers.includes(col))
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}. Required: name, price`)
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map(v => v.trim())
      const product = {}

      headers.forEach((header, index) => {
        product[header] = values[index] || ''
      })

      // Validate required fields
      if (!product.name || !product.price) {
        console.warn(`Skipping row ${i + 1}: missing name or price`)
        continue
      }

      // CRITICAL: Determine the correct branchId for this product
      // Priority: targetBranchId (passed in) > CSV column > currentUser.branchId (cashier)
      let productBranchId = targetBranchId || product.branchid || product.branch_id || ''
      if (!productBranchId && currentUser?.branchId) {
        productBranchId = currentUser.branchId // Cashier's branch
      }

      products.push({
        name: product.name,
        sku: product.sku || '',
        barcode: product.barcode || '',
        price: parseFloat(product.price) || 0,
        costPrice: parseFloat(product.costprice || product.cost_price || 0) || 0,
        quantity: parseInt(product.quantity || product.stock || 0) || 0,
        category: product.category || 'General',
        reorderLevel: parseInt(product.reorderlevel || product.reorder_level || 5) || 5,
        supplier: product.supplier || '',
        description: product.description || '',
        unit: product.unit || 'pcs',
        location: product.location || '',
        expiryDate: product.expirydate || product.expiry_date || '',
        batchNumber: product.batchnumber || product.batch_number || '',
        kebsNumber: product.kebsnumber || product.kebs_number || '',
        branchId: productBranchId
      })
    }

    return products
  }

  const handleFileUpload = async (file) => {
    if (!file) return
    
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    // CRITICAL: Prevent CSV upload without a target branch
    if (!selectedBranch) {
      if (currentUser?.role === 'admin') {
        setError('Please select a branch before importing CSV. This prevents data from being assigned to the wrong branch.')
      } else {
        setError('Your account is missing branch assignment. Please contact admin or re-login.')
      }
      return
    }

    setProcessing(true)
    setError(null)
    setResult(null)

    try {
      const text = await file.text()
      // Pass selectedBranch to parseCSV so it assigns branchId correctly during parsing
      const parsedProducts = parseCSV(text, selectedBranch)

      if (parsedProducts.length === 0) {
        throw new Error('No valid products found in CSV file')
      }

      console.log(`📥 Parsed ${parsedProducts.length} products with target branchId: ${selectedBranch}`)
      console.log(`📥 First product branchId after parsing:`, parsedProducts[0]?.branchId)

      // Get admin ID for storage
      const adminId = getAdminIdForStorage(currentUser)
      const sharedData = await readSharedData(adminId)
      const existingInventory = sharedData.inventory || []

      let created = 0
      let updated = 0
      const errors = []

      // Generate next available ID
      let nextId = existingInventory.length > 0 
        ? Math.max(...existingInventory.map(p => p.id || 0)) + 1 
        : 1

      // CRITICAL FIX: Start with ALL existing inventory to preserve other branches
      const updatedInventory = [...existingInventory]
      
      console.log(`📥 CSV Import: Starting with ${existingInventory.length} existing products`)
      console.log(`📥 Importing ${parsedProducts.length} products for user: ${currentUser.name} (role: ${currentUser.role})`)
      console.log(`📥 Target branchId: ${selectedBranch || currentUser.branchId || 'admin-no-branch'}`)
      console.log(`📥 First parsed product branchId:`, parsedProducts[0]?.branchId)

      parsedProducts.forEach((product, index) => {
        try {
          // Try to find existing product by SKU, barcode, or name
          let existingIndex = -1
          
          if (product.sku) {
            existingIndex = updatedInventory.findIndex(p => 
              p.sku && p.sku.toLowerCase() === product.sku.toLowerCase()
            )
          }
          
          if (existingIndex === -1 && product.barcode) {
            existingIndex = updatedInventory.findIndex(p => 
              p.barcode && p.barcode === product.barcode
            )
          }
          
          if (existingIndex === -1) {
            existingIndex = updatedInventory.findIndex(p => 
              p.name.toLowerCase() === product.name.toLowerCase() &&
              p.branchId === product.branchId
            )
          }

          if (existingIndex !== -1) {
            // Update existing product
            updatedInventory[existingIndex] = {
              ...updatedInventory[existingIndex],
              ...product,
              id: updatedInventory[existingIndex].id, // Keep original ID
              updatedAt: new Date().toISOString(),
              updatedBy: {
                id: currentUser?.id || '',
                name: currentUser?.name || currentUser?.email || 'Unknown',
                role: currentUser?.role || ''
              }
            }
            updated++
          } else {
            // Create new product
            updatedInventory.push({
              ...product,
              id: nextId++,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: {
                id: currentUser?.id || '',
                name: currentUser?.name || currentUser?.email || 'Unknown',
                role: currentUser?.role || ''
              }
            })
            created++
          }
        } catch (err) {
          errors.push(`Row ${index + 2}: ${err.message}`)
        }
      })

      // Save to database
      await writeSharedData({
        ...sharedData,
        inventory: updatedInventory
      }, adminId)

      console.log(`✅ CSV Import Complete: ${created} created, ${updated} updated`)
      console.log(`📦 Sample saved product:`, updatedInventory.find(p => p.branchId === selectedBranch))

      setResult({
        success: true,
        total: parsedProducts.length,
        created,
        updated,
        errors
      })

      // Update parent component to reload inventory
      if (onInventoryUpdate) {
        onInventoryUpdate(updatedInventory)
      }

      // Call the callback to reload inventory in parent
      if (onInventoryUpdate) {
        onInventoryUpdate(updatedInventory)
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    handleFileUpload(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    handleFileUpload(file)
  }

  const downloadTemplate = () => {
    const template = `name,sku,barcode,price,costPrice,quantity,category,reorderLevel,supplier,unit,description,location,expiryDate,batchNumber,kebsNumber,branchId
Whiskey Jameson,SKU001,12345678,2500,2000,50,Spirits,10,ABC Suppliers,bottle,Irish Whiskey 750ml,Shelf A1,2027-12-31,BATCH001,KEBS001,ruiru
Vodka Smirnoff,SKU002,87654321,1800,1400,30,Spirits,10,ABC Suppliers,bottle,Vodka 750ml,Shelf A2,2027-06-30,BATCH002,KEBS002,ruiru
Beer Tusker,SKU003,11223344,200,150,100,Beer,20,XYZ Distributors,bottle,Lager 500ml,Cooler 1,2026-03-31,BATCH003,KEBS003,ruiru`
    
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inventory_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import Inventory from CSV
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a CSV file to create or update products in bulk
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
          >
            Download Template
          </Button>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="text-sm font-medium mb-2">
            {isDragging ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}
          </p>
          <p className="text-xs text-muted-foreground mb-4">or</p>
          <label htmlFor="csv-upload">
            <Button
              type="button"
              variant="outline"
              disabled={processing}
              onClick={() => document.getElementById('csv-upload').click()}
            >
              {processing ? 'Processing...' : 'Browse Files'}
            </Button>
          </label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 relative">
            <button
              onClick={() => setResult(null)}
              className="absolute top-2 right-2 p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded-sm transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-green-600 dark:text-green-400" />
            </button>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-green-800 dark:text-green-200">
                  Import Successful!
                </p>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>• {result.created} products created</li>
                  <li>• {result.updated} products updated</li>
                  <li>• {result.total} total records processed</li>
                  {result.success && (
                    <li className="mt-2 text-green-600 dark:text-green-400">✓ Modal will close automatically in 3 seconds</li>
                  )}
                </ul>
                {result.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Warnings:
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                      {result.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>• ... and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2">CSV Format Guidelines:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Required columns:</strong> name, price</li>
            <li>• <strong>Optional columns:</strong> sku, barcode, costPrice, quantity, category, reorderLevel, supplier, unit, description, location, expiryDate, batchNumber, kebsNumber, branchId</li>
            <li>• Products are matched by SKU, barcode, or name for updates</li>
            <li>• If no match found, a new product is created</li>
            <li>• Column names are case-insensitive</li>
            <li>• Use comma (,) as delimiter</li>
          </ul>
        </div>
      </div>
    </Card>
  )
}
