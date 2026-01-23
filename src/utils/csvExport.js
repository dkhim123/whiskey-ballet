/**
 * Utility functions for exporting data as CSV
 */

/**
 * Convert an array of objects to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} headers - Optional array of header objects with { key, label }
 * @returns {string} CSV formatted string
 */
export function convertToCSV(data, headers = null) {
  if (!data || data.length === 0) {
    return ''
  }

  // If headers not provided, use keys from first object
  const keys = headers 
    ? headers.map(h => h.key)
    : Object.keys(data[0])

  const headerLabels = headers
    ? headers.map(h => h.label)
    : keys

  // Create header row
  const headerRow = headerLabels.map(escapeCSVValue).join(',')

  // Create data rows
  const dataRows = data.map(item => {
    return keys.map(key => {
      const value = item[key]
      return escapeCSVValue(value)
    }).join(',')
  })

  return [headerRow, ...dataRows].join('\n')
}

/**
 * Escape special characters in CSV values
 * @param {any} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeCSVValue(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)
  
  // If value contains comma, newline, or quotes, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Download data as CSV file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Name of the file to download
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    // Create a link to the file
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Export expenses data to CSV
 * @param {Array} expenses - Array of expense objects
 * @param {string} filename - Name of the file to download
 */
export function exportExpensesToCSV(expenses, filename = 'expenses.csv') {
  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount (KES)' },
    { key: 'paymentMethod', label: 'Payment Method' },
    { key: 'type', label: 'Type' },
  ]

  const formattedData = expenses.map(expense => ({
    date: new Date(expense.date).toLocaleString(),
    category: expense.category || '',
    description: expense.description || '',
    amount: expense.amount || 0,
    paymentMethod: expense.paymentMethod || 'N/A',
    type: expense.type === 'income' ? 'Income' : 'Expense',
  }))

  const csv = convertToCSV(formattedData, headers)
  downloadCSV(csv, filename)
}

/**
 * Export transactions/sales data to CSV
 * @param {Array} transactions - Array of transaction objects
 * @param {string} filename - Name of the file to download
 */
export function exportTransactionsToCSV(transactions, filename = 'sales.csv') {
  const headers = [
    { key: 'timestamp', label: 'Date & Time' },
    { key: 'id', label: 'Transaction ID' },
    { key: 'itemsSold', label: 'Items Sold' },
    { key: 'total', label: 'Total Amount (KES)' },
    { key: 'paymentMethod', label: 'Payment Method' },
    { key: 'paymentStatus', label: 'Status' },
    { key: 'customerName', label: 'Customer' },
    { key: 'itemCount', label: 'Item Count' },
    { key: 'recordedBy', label: 'Recorded By' },
  ]

  const formattedData = transactions.map(transaction => {
    // Format items sold as "Product Name x Qty, Product Name x Qty"
    const itemsSold = transaction.items && transaction.items.length > 0
      ? transaction.items.map(item => `${item.name} x${item.quantity}`).join(', ')
      : 'N/A'
    
    return {
      timestamp: new Date(transaction.timestamp).toLocaleString(),
      id: transaction.id || '',
      itemsSold: itemsSold,
      total: transaction.total || 0,
      paymentMethod: transaction.paymentMethod || 'cash',
      paymentStatus: transaction.paymentStatus || 'completed',
      customerName: transaction.customerName || 'Walk-in',
      itemCount: transaction.itemCount || transaction.items?.length || 0,
      recordedBy: transaction.cashier || transaction.cashierName || transaction.recordedBy || 'Unknown',
    }
  })

  const csv = convertToCSV(formattedData, headers)
  downloadCSV(csv, filename)
}

/**
 * Export customers data to CSV
 * @param {Array} customers - Array of customer objects
 * @param {string} filename - Name of the file to download
 */
export function exportCustomersToCSV(customers, filename = 'customers.csv') {
  const headers = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'loanAmount', label: 'Loan Amount (KES)' },
    { key: 'loanDate', label: 'Loan Date' },
    { key: 'loanDueDate', label: 'Due Date' },
    { key: 'creditLimit', label: 'Credit Limit (KES)' },
    { key: 'balance', label: 'Current Balance (KES)' },
    { key: 'createdDate', label: 'Joined Date' },
  ]

  const formattedData = customers.map(customer => ({
    name: customer.name || '',
    phone: customer.phone || '',
    address: customer.address || '',
    loanAmount: customer.loanAmount || 0,
    loanDate: customer.loanDate ? new Date(customer.loanDate).toLocaleDateString() : '',
    loanDueDate: customer.loanDueDate ? new Date(customer.loanDueDate).toLocaleDateString() : '',
    creditLimit: customer.creditLimit || 0,
    balance: customer.balance || 0,
    createdDate: customer.createdDate ? new Date(customer.createdDate).toLocaleDateString() : '',
  }))

  const csv = convertToCSV(formattedData, headers)
  downloadCSV(csv, filename)
}
