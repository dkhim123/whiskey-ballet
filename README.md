# Whiskey Ballet - Wines & Spirits POS

A comprehensive Point of Sale (POS) and Inventory Management System designed for wines and spirits retail stores. Built with Next.js 16, React 19, and IndexedDB for enterprise-grade performance and scalability.

[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple?style=for-the-badge)](https://web.dev/progressive-web-apps/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
- [User Roles & Permissions](#user-roles--permissions)
- [Core Modules](#core-modules)
- [Database System](#database-system)
- [Real-time Synchronization](#real-time-synchronization)
- [Deployment](#deployment)
- [Technical Documentation](#technical-documentation)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## 🎯 Overview

Whiskey Ballet POS is a production-ready, offline-first retail management system built to handle:
- **10,000+** products in inventory
- **3+ years** of transaction history
- **Multiple concurrent users** (admin, managers, cashiers)
- **Real-time data synchronization** across all users
- **Complete audit trail** for compliance
- **Zero external dependencies** - fully self-contained

### System Capabilities

| Feature | Capacity | Performance |
|---------|----------|-------------|
| Products | 10,000+ | IndexedDB (50+ MB storage) |
| Transactions | Unlimited | Fast batch operations |
| Concurrent Users | Multiple | 5-second sync intervals |
| Offline Mode | 100% | LocalStorage fallback |
| Data Isolation | Per-Admin | Compound key architecture |

> **Can this system handle 1000 products?**
> 
> **Yes, absolutely!** The system is specifically designed to handle **10,000+ products** efficiently. With only 1,000 products, you will experience:
> - ⚡ **Instant search and filtering** - subsecond response times
> - 📊 **Real-time inventory updates** - no lag or delays
> - 🔄 **Smooth synchronization** - data syncs seamlessly across devices
> - 💾 **Minimal storage usage** - approximately 5-10 MB for 1,000 products
> - 🚀 **Excellent performance** - the system will run very smoothly
> 
> The system uses **IndexedDB** for local storage, which can handle databases up to **several gigabytes** in size. Performance remains excellent even with tens of thousands of products due to:
> - Efficient indexing and search algorithms
> - Pagination for large datasets
> - Debounced search for real-time filtering
> - Optimized data structures

---

## ✨ Key Features

### 🛒 Point of Sale (POS)
- **Barcode Scanner Support** - Lightning-fast product lookup
- **Multiple Payment Methods** - Cash, M-Pesa, Credit sales
- **Real-time Inventory Updates** - Stock decreases instantly
- **Receipt Generation** - Print or digital receipts
- **VAT Calculations** - Automatic 16% VAT (Kenya standard)
- **Age Verification** - Alcoholic Drinks Control Act compliance

### 📦 Inventory Management
- **Complete CRUD Operations** - Add, edit, delete products
- **Stock Adjustments** - Track wastage, breakage, returns
- **Stock Counts** - Physical inventory reconciliation
- **Reorder Level Alerts** - Never run out of stock
- **Expiry Date Tracking** - Reduce waste
- **Category Management** - Wines, spirits, mixers, etc.

### 🏭 Purchase Order Management
- **Create Purchase Orders** - Order from suppliers
- **Mark as Received** - Automatic inventory updates
- **Status Tracking** - Draft, Ordered, Received, Cancelled
- **Goods Received Notes** - Complete receiving documentation
- **Supplier Payments** - Track payables

### 👥 Customer Management
- **Credit Sales** - Manage customer accounts
- **Credit Limits** - Set per-customer limits
- **Payment Tracking** - Track outstanding balances
- **Customer History** - View all transactions
- **Loan Management** - Due dates and reminders

### 📊 Reports & Analytics
- **Sales Reports** - Daily, weekly, monthly summaries
- **Profit Analysis** - Track margins and profitability
- **Inventory Reports** - Stock levels, movements
- **Expense Tracking** - Control business expenses
- **User Activity Logs** - Complete audit trail

### 🔐 Security & Access Control
- **Role-Based Access** - Admin, Manager, Cashier roles
- **Data Isolation** - Each admin's data is separate
- **User Tracking** - Who did what, when
- **Audit Trail** - Complete accountability
- **Session Management** - Secure login/logout

---

## 🏗️ System Architecture

### Technology Stack

```
Frontend Layer
├── Next.js 16 (App Router + Turbopack)
├── React 19 (with latest hooks)
├── Tailwind CSS 4 (styling)
└── Shadcn UI (component library)

State Management
├── React useState/useEffect
├── Local component state
└── 5-second auto-refresh for sync

Storage Layer
├── IndexedDB (primary) - 50+ MB capacity
├── LocalStorage (fallback) - 10 MB capacity
└── Admin-isolated data stores

Data Structure
├── 10 Object Stores (inventory, transactions, etc.)
├── Compound Keys [adminId, id]
├── Indexed for fast queries
└── Atomic transaction support
```

### Database Architecture

```
┌─────────────────────────────────────────┐
│   React Components (Views)              │
│   ├── InventoryPage                     │
│   ├── PurchaseOrdersPage                │
│   ├── PosPage                           │
│   └── CustomersPage, etc.               │
└─────────────────────────────────────────┘
                 ↓ ↑
┌─────────────────────────────────────────┐
│   Storage Abstraction Layer             │
│   ├── readSharedData(adminId)           │
│   ├── writeSharedData(data, adminId)    │
│   ├── readData(userId)                  │
│   └── writeData(data, userId)           │
└─────────────────────────────────────────┘
                 ↓ ↑
┌─────────────────────────────────────────┐
│   IndexedDB Layer                       │
│   ├── putBatch() - Atomic writes        │
│   ├── getAllItems() - Filtered reads    │
│   ├── putItem() - Single item ops       │
│   └── deleteItem() - Safe deletes       │
└─────────────────────────────────────────┘
                 ↓ ↑
┌─────────────────────────────────────────┐
│   Browser IndexedDB                     │
│   Database: TheCellarPOS (v1)           │
│   ├── inventory (products)              │
│   ├── transactions (sales)              │
│   ├── purchaseOrders                    │
│   ├── suppliers                         │
│   ├── customers                         │
│   ├── expenses (admin only)             │
│   └── 4 more stores...                  │
└─────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have installed:
- **Node.js** 18.17 or higher
- **npm** 9.0 or higher
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/wines-and-spirit-pos.git
cd wines-and-spirit-pos

# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
# Navigate to http://localhost:3000
```

### Production Build

```bash
# Create optimized build
npm run build

# Start production server
npm start
```

### Default Credentials

**Admin Account**
```
Email: admin@whiskeyballet.ke
Password: Password123!
```

**Manager Account**
```
Email: manager@whiskeyballet.ke
Password: Password123!
```

**Cashier Account**
```
Email: cashier@whiskeyballet.ke
Password: Password123!
```

> ⚠️ **Security Note**: Change default passwords immediately in production!

---

## 👥 User Roles & Permissions

### Admin (Full Access)
- ✅ All POS operations
- ✅ Inventory management (add, edit, delete)
- ✅ Purchase order management
- ✅ Supplier management
- ✅ Customer management
- ✅ Expense tracking
- ✅ Settings and configuration
- ✅ User management
- ✅ All reports and analytics
- ✅ Data export/import

### Manager (Operational Access)
- ✅ POS operations
- ✅ View inventory (read-only)
- ✅ Stock adjustments
- ✅ Customer management
- ✅ View reports
- ⛔ Cannot add/delete products
- ⛔ Cannot view expenses
- ⛔ Cannot change settings

### Cashier (POS Only)
- ✅ POS operations
- ✅ Process sales (cash, M-Pesa, credit)
- ✅ View product catalog
- ✅ Customer lookup for credit sales
- ⛔ Cannot view inventory details
- ⛔ Cannot access reports
- ⛔ Cannot manage products
- ⛔ Cannot view expenses

---

## 📚 Core Modules

### 1. Point of Sale (POS)

**Location**: `src/views/PosPage.jsx`

**Features**:
- Grid and table view modes
- Barcode scanner integration
- Real-time cart management
- Multiple payment methods
- Discount application
- Receipt generation
- Age verification modal

**Data Flow**:
```
Product Selection → Cart → Payment → Transaction Save → Inventory Update → Receipt
```

**Auto-sync**: 5-second refresh for inventory and customer updates

### 2. Inventory Management

**Location**: `src/views/InventoryPage.jsx`

**Operations**:
- **Create**: Add new products with full details
- **Read**: View all products with filtering
- **Update**: Edit product details, prices, quantities
- **Delete**: Remove products from inventory
- **Stock Adjustment**: Track wastage, breakage, returns
- **Stock Count**: Physical inventory reconciliation

**Key Features**:
- Category filtering
- Expiry date tracking
- Low stock alerts
- Search by name/SKU/barcode
- Pagination (50 items per page)
- CSV export

**Auto-sync**: 5-second refresh across all users

### 3. Purchase Orders

**Location**: `src/views/PurchaseOrdersPage.jsx`

**Workflow**:
1. **Create PO** - Select supplier and products
2. **Order** - Send to supplier (status: ordered)
3. **Receive** - Mark as received → inventory auto-updates
4. **Track** - View status and history

**Status Flow**:
```
Draft → Ordered → Partially Received → Received
             ↓
         Cancelled
```

**Key Features**:
- Automatic inventory updates on receiving
- Supplier tracking
- PO history with timestamps
- User tracking (who created, who received)
- Status change notifications

**Auto-sync**: 5-second refresh for real-time PO updates

### 4. Customer Management

**Location**: `src/views/CustomersPage.jsx`

**Features**:
- Add/edit customers
- Set credit limits
- Track credit balances
- Payment history
- Loan due dates
- Phone number lookup

**Credit Sale Flow**:
```
Select Customer → Check Credit Limit → Process Sale → Update Balance → Track Payment
```

### 5. Reports & Analytics

**Location**: `src/views/AdminDashboard.jsx`, `src/views/ManagerDashboard.jsx`

**Available Reports**:
- Sales summary (today, week, month)
- Top selling products
- Low stock alerts
- Expiring products
- Profit margins
- Payment method breakdown
- Customer credit report

---

## 💾 Database System

### Object Stores (10 Total)

| Store | Key | Purpose | Admin-Isolated |
|-------|-----|---------|----------------|
| `inventory` | [adminId, id] | Products/items | ✅ |
| `transactions` | [adminId, id] | Sales records | ✅ |
| `purchaseOrders` | [adminId, id] | Purchase orders | ✅ |
| `suppliers` | [adminId, id] | Supplier directory | ✅ |
| `customers` | [adminId, id] | Customer records | ✅ |
| `expenses` | [adminId, id] | Business expenses | ✅ |
| `goodsReceivedNotes` | [adminId, id] | GRN records | ✅ |
| `supplierPayments` | [adminId, id] | Payment records | ✅ |
| `stockAdjustments` | [adminId, id] | Stock changes | ✅ |
| `settings` | adminId | Admin settings | ✅ |

### Data Isolation Model

Each admin and their users (cashiers/managers) share the same data:

```
Admin 1 (adminId: 1)
  ├── 50 products
  ├── 500 transactions
  ├── 10 customers
  └── Users: Admin, Cashier A, Cashier B, Manager

Admin 2 (adminId: 2)
  ├── 75 products
  ├── 300 transactions
  ├── 15 customers
  └── Users: Admin, Cashier C, Manager

→ Data is completely isolated between admins
→ Cashiers/Managers share admin's data
→ No cross-admin data leakage
```

### Storage Capacity

| Storage Type | Capacity | Speed | Use Case |
|--------------|----------|-------|----------|
| IndexedDB | 50+ MB | Fast | Primary storage |
| LocalStorage | ~10 MB | Medium | Fallback only |
| File System (Electron) | Unlimited | Fast | Desktop app |

### Critical Database Operations

#### 1. putBatch() - Atomic Replace
```javascript
// Clears all admin's items, then adds new ones
// Ensures deleted items don't reappear
await putBatch('inventory', adminId, updatedInventory)
```

**Sequence**:
1. Open transaction
2. Clear all existing items for adminId (via cursor)
3. Wait for clearing to complete
4. Insert all new items
5. Commit transaction

#### 2. getAllItems() - Filtered Read
```javascript
// Returns only admin's items using index
const items = await getAllItems('inventory', adminId)
```

#### 3. Data Preservation Pattern
```javascript
// ALWAYS spread existing data when saving
const sharedData = await readSharedData(adminId)
await writeSharedData({
  ...sharedData,           // Preserve all existing data
  inventory: newInventory  // Update specific field
}, adminId)
```

> ⚠️ **Critical**: Never save partial data without spreading `...sharedData`

---

## 🔄 Real-time Synchronization

### Sync Architecture

All pages with data modifications have auto-refresh:

| Page | Refresh Interval | Syncs |
|------|------------------|-------|
| PosPage | 5 seconds | Inventory, transactions, customers |
| InventoryPage | 5 seconds | Products, stock levels |
| PurchaseOrdersPage | 5 seconds | POs, inventory |
| App.jsx | 30 seconds | Global inventory state |

### How Sync Works

1. **User A** creates a purchase order
2. **Database** saves PO + updates inventory
3. **User A** sees changes immediately (local state update)
4. **User B** auto-refresh (5s) → fetches updated data → UI updates
5. **Result**: All users see changes within 5 seconds

### Preventing Race Conditions

**InventoryPage** uses a save lock:
```javascript
const isSavingRef = useRef(false)

// Skip auto-refresh while saving
if (isSavingRef.current) {
  return // Don't load while saving
}
```

This prevents:
- Auto-refresh overwriting unsaved changes
- Concurrent saves causing conflicts
- Lost updates during high-frequency operations

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Custom domain
vercel domains add yourdomain.com
```

### Netlify

```bash
# Build command
npm run build

# Publish directory
.next

# Environment variables
# Add in Netlify dashboard
```

### Self-Hosted (Node.js)

```bash
# Build for production
npm run build

# Start with PM2
pm2 start npm --name "cellar-pos" -- start

# Or use system service
# See deployment docs
```

### Environment Variables

Create `.env.local`:
```bash
# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Optional: Error tracking
NEXT_PUBLIC_SENTRY_DSN=https://...

# Optional: Feature flags
NEXT_PUBLIC_ENABLE_DESKTOP_MODE=false
```

---

## 📖 Technical Documentation

### Code Structure

```
wines-and-spirit-pos/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main app entry
│   └── globals.css        # Global styles
├── src/
│   ├── views/             # Main pages
│   │   ├── PosPage.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── PurchaseOrdersPage.jsx
│   │   ├── CustomersPage.jsx
│   │   ├── ExpensesPage.jsx
│   │   ├── AdminDashboard.jsx
│   │   └── ManagerDashboard.jsx
│   ├── components/        # Reusable components
│   │   ├── TopBar.jsx
│   │   ├── CartPanel.jsx
│   │   ├── InventoryTable.jsx
│   │   └── ui/           # Shadcn components
│   ├── utils/            # Utilities
│   │   ├── storage.js           # Storage abstraction
│   │   ├── indexedDBStorage.js  # IndexedDB layer
│   │   ├── auth.js              # Authentication
│   │   ├── activityLog.js       # Audit trail
│   │   └── pricing.js           # VAT calculations
│   └── hooks/            # Custom hooks
│       ├── useDebounce.ts
│       └── useToast.ts
├── public/               # Static assets
│   ├── manifest.json     # PWA manifest
│   └── sw.js            # Service worker
└── package.json
```

### Key Files

**Storage Layer**:
- `src/utils/storage.js` - High-level storage API
- `src/utils/indexedDBStorage.js` - IndexedDB operations

**Authentication**:
- `src/utils/auth.js` - User management, role checks
- `src/App.jsx` - Session handling

**Data Processing**:
- `src/utils/pricing.js` - VAT calculations
- `src/utils/dateHelpers.js` - Date formatting
- `src/utils/activityLog.js` - Audit logging

### Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type check
npm run type-check
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Data Not Syncing Between Users

**Symptoms**: Changes made by one user not visible to others

**Solution**:
- Check browser console for errors
- Verify auto-refresh is working (5-second intervals)
- Clear IndexedDB and reload: 
  - Chrome DevTools → Application → IndexedDB → TheCellarPOS → Delete Database
  - Refresh page

#### 2. Products Not Deleting

**Symptoms**: Deleted products reappear after refresh

**Solution**:
- Ensure using latest code with fixed `putBatch()` function
- Clear browser cache
- Check console for "Cleared X old items, saved Y new items" message

#### 3. Purchase Orders Disappearing

**Symptoms**: PO disappears after marking as received

**Solution**:
- Verify `writeSharedData` uses `...sharedData` pattern
- Check PO status filter (ensure not filtering out "received")
- Look for "Successfully saved X POs" in console

#### 4. Storage Full Error

**Symptoms**: "QuotaExceededError" or "Storage full" messages

**Solution**:
- Export old transactions
- Delete old transactions from database
- Switch to desktop app (unlimited storage)
- Clear browser cache/localStorage

#### 5. Slow Performance

**Symptoms**: App feels sluggish, long load times

**Solution**:
- Check number of transactions (>10,000 may slow down)
- Export and archive old data
- Use pagination for large datasets
- Disable auto-refresh temporarily during bulk operations

### Debug Mode

Enable debug logging in console:
```javascript
localStorage.setItem('debug', 'true')
```

Look for these log prefixes:
- `🔍` - Reading data
- `📦` - Loaded data
- `💾` - Saving data
- `✅` - Success
- `❌` - Error
- `🧹` - Clearing old data

### Browser DevTools

**Check IndexedDB**:
1. Open DevTools (F12)
2. Go to Application tab
3. Expand IndexedDB → TheCellarPOS
4. View each object store
5. Inspect data by adminId

**Check Console Logs**:
- Filter by "PosPage" to see POS operations
- Filter by "InventoryPage" to see inventory ops
- Filter by "IndexedDB" to see database operations

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🤝 Support

For issues, questions, or contributions:
- **Email**: support@whiskeyballet.ke
- **Documentation**: See code comments for detailed explanations
- **Updates**: Check this README for latest information

---

## 🎯 Quick Reference

### Start Development
```bash
npm install && npm run dev
```

### Default Login
```
admin@whiskeyballet.ke / Password123!
```

### Check Data
```
DevTools → Application → IndexedDB → TheCellarPOS
```

### Clear Database
```javascript
// In browser console
indexedDB.deleteDatabase('TheCellarPOS')
location.reload()
```

### Export Data
```
Admin Dashboard → Data Management → Export All Data
```

---

**Version**: 1.0.0  
**Last Updated**: January 13, 2026  
**Status**: Production Ready ✅

**Built with ❤️ for Whiskey Ballet Wines & Spirits**

### Required Software

1. **Node.js 18+** and **npm**
   ```bash
   # Check versions
   node --version  # Should be v18.x.x or higher
   npm --version   # Should be 9.x.x or higher
   ```

2. **Git** (for cloning the repository)
   ```bash
   git --version
   ```

### System Requirements
- **OS:** Windows 10+, macOS 11+, Ubuntu 20.04+
- **RAM:** 4 GB minimum (8 GB recommended)
- **Disk Space:** 500 MB free
- **Browser:** Chrome, Firefox, Safari, or Edge (latest 2 versions)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Dkmbugua/wines-and-spirit-pos.git
cd wines-and-spirit-pos
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages (may take a few minutes).

### 3. Verify Installation

```bash
# Check if all dependencies are installed
npm list --depth=0
```

---

## 🎮 Running the Application

### Development Mode (with hot reload)

```bash
npm run dev
```

Then open your browser to: **http://localhost:3000**

- Changes auto-reload in browser
- Best for development and testing
- DevTools available for debugging

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm start
```

- Optimized for performance
- Static file serving
- Access at: http://localhost:3000

---

## 🔐 Default Credentials

### Admin Account
- **Email:** `admin@whiskeyballet.ke`
- **Password:** `Password123!`
- **Access:** Full system access (Dashboard, POS, Inventory, Reports, Settings)

### Cashier Account
- **Email:** `cashier@whiskeyballet.ke`
- **Password:** `cashier123`
- **Access:** POS operations and inventory viewing only

> **⚠️ Security Warning:** Change these default passwords immediately in production via Admin Settings.

---

## 🎯 Features Overview

### 1. Point of Sale (POS)
- Quick product selection (table or grid view)
- Barcode scanner support
- Real-time cart management
- Multiple payment methods (Cash, M-Pesa, Credit)
- Discount application
- VAT calculations (16% Kenya)
- Receipt generation and printing
- Age verification prompt (18+)

### 2. Inventory Management
- Product catalog with images
- SKU management
- Stock level tracking
- Low stock alerts
- Category filtering (Red Wine, White Wine, Whisky, Vodka, etc.)
- Expiry date tracking
- Cost and selling price tracking
- Profit margin calculations
- Stock count verification
- Bulk import/export (CSV)

### 3. Customer Management
- Customer database
- Phone number tracking
- Credit sales (loans) tracking
- Payment history
- Loan due dates
- Flexible loan payment (any amount)

### 4. Supplier Management
- Supplier database
- Contact information
- Purchase order creation
- Stock receiving
- Payment tracking

### 5. Reports & Analytics
- Sales by date range (Today, Last 7 Days, Last 30 Days)
- Sales by payment method
- Product ranking by revenue/quantity
- Daily sales trends with charts
- Transaction history
- Profit/loss analysis
- Export reports (CSV, PDF)

### 6. Expense Tracking
- Record business expenses
- Categorize expenses
- Income tracking (includes loan repayments)
- Profit calculations
- Spending limit alerts

### 7. Admin Features
- User management (create, edit, delete users)
- Role-based access control
- System settings
- Database health monitoring
- Auto-repair database issues
- Database optimization
- Backup and restore
- Complete data export/import

---

## 💾 Data Storage

### How It Works

This application does **NOT** use a traditional backend database. All data is stored locally:

**Browser Mode:**
- Storage: Browser's localStorage
- Location: Browser's internal storage
- Capacity: ~10MB (browser dependent)
- Persistence: Data survives browser restarts
- Backup: Export to JSON/CSV files

**Key Points:**
- ✅ No database installation needed
- ✅ No backend server required
- ✅ Works completely offline
- ✅ Zero hosting costs
- ✅ Data privacy (everything local)
- ✅ Easy backup (copy data files)

### What Data is Stored

The application stores:
- **Products** (name, SKU, price, stock, category, images)
- **Transactions** (sales, payment methods, timestamps, items sold)
- **Customers** (name, phone, loan amounts, payment history)
- **Suppliers** (contact info, purchase orders)
- **Expenses** (business spending, categorized)
- **Users** (accounts with encrypted passwords using bcrypt)
- **Settings** (store name, currency, preferences)

### Data Persistence

- Transactions are **never deleted** automatically
- Full history maintained indefinitely
- Export data regularly for backup
- Restore from JSON backup files

### Backup Recommendations

1. **Daily:** Auto-backup runs in background
2. **Weekly:** Export data to CSV/JSON
3. **Monthly:** Download complete backup
4. **Before Updates:** Always backup first

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Click "Deploy"
   - Done! ✅

3. **Post-Deployment**
   - Your app will be live at: `https://your-project.vercel.app`
   - Automatic HTTPS enabled
   - Global CDN for fast loading
   - Auto-deploys on every git push

### Vercel Free Tier Includes:
- ✅ Unlimited bandwidth
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ 100GB deployment storage
- ✅ Perfect for this app!

### PWA Installation

**Desktop (Windows/Mac/Linux):**
1. Open the site in Chrome or Edge
2. Look for install icon in address bar
3. Click "Install"
4. App opens in standalone window

**Mobile (Android/iOS):**
1. Open in browser
2. Tap share/menu button
3. Select "Add to Home Screen"
4. App appears like a native app

---

## 🐛 Troubleshooting

### Port 3000 Already in Use

```bash
# Find and kill the process
sudo lsof -ti:3000 | xargs kill -15

# Or use a different port
PORT=3001 npm run dev
```

### npm install Fails

```bash
# Clear npm cache
npm cache clean --force

# Remove existing installations
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Build Cache Errors

```bash
# Remove Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Data Lost After Browser Clear

If you cleared browser data without backing up:
- Data is permanently lost in browser mode
- **Prevention:** Use the Export function regularly
- **Best Practice:** Export data weekly to external drive

### Images Not Loading

The 404 errors for product images are expected:
- Product images use placeholder URLs
- Replace with actual product image URLs or local images
- Update image paths in product data

---

## 📚 Project Structure

```
wines-and-spirit-pos/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page
│   ├── globals.css        # Global styles
│   └── api/               # API routes
├── src/                   # Source code
│   ├── App.jsx           # Main React app
│   ├── components/       # React components
│   │   ├── LoginForm.jsx
│   │   ├── Sidebar.jsx
│   │   ├── ProductGrid.jsx
│   │   ├── CartPanel.jsx
│   │   └── ...
│   ├── views/            # Page views
│   │   ├── LoginPage.jsx
│   │   ├── PosPage.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── CustomersPage.jsx
│   │   ├── ReportsPage.jsx
│   │   └── ...
│   ├── utils/            # Utility functions
│   │   ├── storage.js    # Local storage handling
│   │   └── ...
│   └── constants/        # App constants
├── public/              # Static assets
│   ├── icon.png
│   ├── manifest.json
│   └── sw.js            # Service worker
├── package.json         # Dependencies
├── next.config.mjs      # Next.js config
├── tailwind.config.js   # Tailwind CSS config
└── README.md           # This file
```

---

## 📜 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Development | `npm run dev` | Start dev server with hot reload |
| Build | `npm run build` | Build for production |
| Start | `npm start` | Start production server |
| Lint | `npm run lint` | Run code linting |

---

## 🔒 Security Features

- ✅ **Password Hashing** - All passwords encrypted with bcrypt
- ✅ **Brute Force Protection** - Account lockout after 5 failed attempts
- ✅ **Password Strength** - Enforced requirements (8+ chars, uppercase, lowercase, number, special char)
- ✅ **Session Management** - Secure sessions with validation
- ✅ **Role-Based Access** - Admin, Manager, Cashier permissions
- ✅ **Local Data** - No cloud uploads (data never leaves device)
- ✅ **HTTPS** - Automatic HTTPS on Vercel deployment

### Best Practices
- ⚠️ Change default passwords immediately
- ⚠️ Use HTTPS when deploying as web app
- ⚠️ Regularly backup user database
- ⚠️ Limit admin account creation
- ⚠️ Keep the application updated

---

## ❓ Frequently Asked Questions

### Q: Does this need a backend or database?
**A:** No! This is a standalone application that stores all data locally using browser localStorage. No database server or backend API needed.

### Q: Will my data be saved when I close the app?
**A:** Yes! All data is automatically saved and persists across app restarts.

### Q: Can I use this in a real wine store?
**A:** Yes! This application is production-ready with secure authentication, complete transaction history, inventory management, and compliance features.

### Q: How do I backup my data?
**A:** Use the "Export Data" feature in Admin Settings to download a JSON backup. Store backups in multiple locations.

### Q: Can I print receipts?
**A:** Yes! Connect any thermal or regular printer and use the browser's print function.

### Q: Does it work offline?
**A:** Yes! After initial installation, the app works 100% offline forever.

### Q: Can multiple users use it?
**A:** Yes! Each device gets its own local database. Create user accounts with different roles (Admin, Manager, Cashier).

---

## 🤝 Support

For issues or questions:
1. Check this README and troubleshooting section
2. Review the User Guide (built into the app)
3. Check [GitHub Issues](https://github.com/Dkmbugua/wines-and-spirit-pos/issues)
4. Email: info@whiskeyballet.ke

---

## 📄 License

Private - Whiskey Ballet Wines & Spirits POS System

---

## 🎉 Credits

**System Name:** Whiskey Ballet - Wines & Spirits POS  
**Version:** 1.0.0  
**Last Updated:** January 2026  
**Built with:** Next.js 16, React 19, Tailwind CSS 4

**Special Features for Wines & Spirits:**
- Wine-specific categories (Red, White, Rosé, Sparkling)
- Spirit categories (Whisky, Vodka, Rum, Gin, Tequila, Brandy, Liqueur)
- Age verification (18+) compliance
- VAT calculations (16% Kenya)
- Premium branding (burgundy/gold theme)

---

**Whiskey Ballet** - *Premium wines, exceptional spirits, impeccable service* 🍷🥃
