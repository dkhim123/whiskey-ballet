"use client"

import { useState, useEffect, useRef } from "react"
import LoginPage from "./views/LoginPage"
import PosPage from "./views/PosPage"
import InventoryPage from "./views/InventoryPage"
import AdminDashboard from "./views/AdminDashboard"
import CashierDashboard from "./views/CashierDashboard"
import ManagerDashboard from "./views/ManagerDashboard"
import ReportsPage from "./views/ReportsPage"
import DataManagementPage from "./views/DataManagementPage"
import SuppliersPage from "./views/SuppliersPage"
import PurchaseOrdersPage from "./views/PurchaseOrdersPage"
import SupplierPaymentsPage from "./views/SupplierPaymentsPage"
import CustomersPage from "./views/CustomersPage"
import ExpensesPage from "./views/ExpensesPage"
import UserGuidePage from "./views/UserGuidePage"
import AdminSettingsPage from "./views/AdminSettingsPage"
import BranchManagementPage from "./views/BranchManagementPage"
import TransactionsHistoryPage from "./views/TransactionsHistoryPage"
import ProfilePage from "./views/ProfilePage"
import BranchStaffPage from "./views/BranchStaffPage"
import Sidebar from "./components/Sidebar"
import ScrollArea from "./components/ScrollArea"
import PWAInstallPrompt from "./components/PWAInstallPrompt"
import PWAUpdatePrompt from "./components/PWAUpdatePrompt"
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration"
import AccountHealthCheck from "./components/AccountHealthCheck"
import { ThemeProvider } from "./components/ThemeProvider"
import { readData, writeData, getStorageMode, readSharedData, writeSharedData, migrateTransactionsPaymentStatus } from "./utils/storage"
import { saveSession, loadSession, updateSessionPage, clearSession } from "./utils/session"
import { clearLocalDataIfSafe } from "./utils/clearLocalData"
import { initializeDefaultUsers, registerUser, getAdminIdForStorage } from "./utils/auth"
import { calculateVAT, calculateProfit, calculateMargin } from "./utils/pricing"
import { getAccessiblePages } from "./utils/permissions"
// Initialize Firebase (cloud database for real-time sync and backup)
import { db, auth, isFirebaseConfigured } from "./config/firebase"
import { doc, onSnapshot } from "firebase/firestore"
// Initialize branch service for multi-branch management
import { initializeBranchService } from "./services/branchService"

export default function App() {
  const [currentPage, setCurrentPage] = useState("login")
  const [userRole, setUserRole] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [inventory, setInventory] = useState([])
  const [storageMode, setStorageMode] = useState("web")
  const profileUnsubRef = useRef(null)

  // Load data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const mode = getStorageMode()
        setStorageMode(mode)
        const session = loadSession();
        if (session) {
          console.log('📂 Restoring session:', { 
            role: session.userRole, 
            page: session.currentPage, 
            userName: session.user?.name 
          })
          setUserRole(session.userRole)
          setCurrentUser(session.user)
          
          // Validate page access based on role permissions
          const accessiblePages = getAccessiblePages(session.user)
          if (!accessiblePages.includes(session.currentPage)) {
            console.warn(`⚠️ User ${session.user?.name} (${session.userRole}) attempted to access unauthorized page: ${session.currentPage}`)
            // Redirect to appropriate default page
            const defaultPage = session.userRole === 'admin' ? 'admin-dashboard' 
              : session.userRole === 'manager' ? 'manager-dashboard'
              : 'cashier-dashboard'
            setCurrentPage(defaultPage)
            updateSessionPage(defaultPage)
          } else {
            setCurrentPage(session.currentPage) // Restore the actual page user was on
          }
          
          // Get admin ID for storage (for cashiers/managers, uses their creator's ID)
          const adminId = getAdminIdForStorage(session.user)
          // Load admin-specific inventory (isolated per admin)
          readSharedData(adminId).then(data => {
            if (data && data.inventory && data.inventory.length > 0) {
              setInventory(data.inventory)
            } else {
              // Initialize with empty data - admin will populate their own inventory
              writeSharedData({ 
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
              }, adminId)
              setInventory([])
            }
          }).catch(err => console.error("Data load error:", err))
        }
      } catch (error) {
        console.error("Error loading data:", error)
      }
    }
    
    loadData()
  }, [])

  // Periodically refresh inventory to sync changes from other users (e.g., cashier marking PO as received)
  // NOTE: This is a lightweight sync. InventoryPage manages its own data loading/saving.
  useEffect(() => {
    if (!currentUser) return // Only refresh when logged in
    
    const refreshInventory = async () => {
      try {
        const adminId = getAdminIdForStorage(currentUser)
        const data = await readSharedData(adminId)
        if (data && data.inventory) {
          setInventory(data.inventory)
        }
      } catch (error) {
        console.error("Error refreshing inventory:", error)
      }
    }
    
    // Refresh every 30 seconds to sync changes made by other users
    const interval = setInterval(refreshInventory, 30000)
    return () => clearInterval(interval)
  }, [currentUser])

  // Real-time profile sync across tabs/browsers (plain English):
  // - When you change name/photo on one device, we want it to show on the other device immediately.
  // - We listen to Firestore: userProfiles/{uid}
  // - When it changes, we merge the new fields into currentUser + session + localStorage.
  useEffect(() => {
    // Cleanup any previous listener
    if (profileUnsubRef.current) {
      profileUnsubRef.current()
      profileUnsubRef.current = null
    }

    if (!currentUser) return
    if (!isFirebaseConfigured() || !db) return

    const uid =
      auth?.currentUser?.uid ||
      currentUser?.firebaseUid ||
      currentUser?.uid ||
      (typeof currentUser?.id === "string" ? currentUser.id : null)

    if (!uid) return

    const unsub = onSnapshot(
      doc(db, "userProfiles", uid),
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data() || {}

        // Only merge safe identity fields for UI display.
        const patch = {
          name: typeof data.name === "string" ? data.name : undefined,
          photoURL: typeof data.photoURL === "string" ? data.photoURL : undefined,
          avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
          // Keep org scope in sync if it changes (rare, but supports reassignment)
          adminId: typeof data.adminId === "string" ? data.adminId : undefined,
          branchId: typeof data.branchId === "string" ? data.branchId : data.branchId === null ? null : undefined,
          role: typeof data.role === "string" ? data.role : undefined,
        }

        setCurrentUser((prev) => {
          if (!prev) return prev
          const merged = { ...prev, ...patch }

          try {
            saveSession(userRole, currentPage, merged)
          } catch (e) {
            // ignore
          }
          try {
            localStorage.setItem("currentUser", JSON.stringify(merged))
          } catch (e) {
            // ignore
          }

          return merged
        })
      },
      (err) => {
        console.warn("Profile realtime sync failed:", err)
      }
    )

    profileUnsubRef.current = unsub
    return () => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current()
        profileUnsubRef.current = null
      }
    }
  }, [currentUser?.id, currentUser?.firebaseUid, currentUser?.uid, userRole, currentPage])

  // NOTE: Removed auto-save useEffect here - InventoryPage now manages its own saves
  // This prevents race conditions and ensures atomic database operations

  const handleLogin = async (role, user) => {
    setUserRole(role)
    setCurrentUser(user)
    
    // Determine default page for new login (not page reload)
    let page = "pos"
    if (role === "admin") {
      page = "admin-dashboard"
    } else if (role === "manager") {
      page = "manager-dashboard"
    } else if (role === "cashier") {
      page = "cashier-dashboard"
    }
    setCurrentPage(page)
    
    // Save session using utility with user data
    saveSession(role, page, user)
    
    // Get admin ID for storage (for cashiers/managers, uses their creator's ID)
    // IMPORTANT: must be computed before any migrations/reads that require admin isolation.
    const adminId = getAdminIdForStorage(user)

    // Some services (e.g. branchService) read `currentUser` from localStorage.
    // Keep it in sync with the active session to avoid "adminId undefined" crashes.
    try {
      localStorage.setItem(
        'currentUser',
        JSON.stringify({
          ...(user || {}),
          adminId, // explicit for easy access
        })
      )
    } catch (e) {
      // Non-fatal (e.g. storage blocked)
      console.warn('Unable to persist currentUser to localStorage:', e)
    }

    // Run one-time migration to fix transaction paymentStatus
    try {
      const migrationResult = await migrateTransactionsPaymentStatus(adminId)
      if (migrationResult.migrated > 0) {
        console.log(`✅ Migration: Fixed ${migrationResult.migrated} transactions`)
      }
    } catch (migrationError) {
      console.error('Migration failed:', migrationError)
      // Don't block login if migration fails
    }
    
    // Pure offline: Load from admin-specific local storage only
    try {
      const data = await readSharedData(adminId)
      if (data && data.inventory && data.inventory.length > 0) {
        console.log(`✅ Loaded data from admin-specific storage (adminId: ${adminId})`)
        setInventory(data.inventory)
      } else {
        // Initialize with empty data - admin will populate their own inventory
        console.log(`✅ Initializing admin ${adminId} with empty data`)
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
        await writeSharedData(emptyData, adminId)
        setInventory([])
      }
    } catch (error) {
      console.error("Error loading data:", error)
      
      // Fall back to empty inventory on error
      setInventory([])
    }
  }

  const handleLogout = async () => {
    // Stop realtime profile listener immediately
    if (profileUnsubRef.current) {
      profileUnsubRef.current()
      profileUnsubRef.current = null
    }
    setCurrentPage("login")
    setUserRole(null)
    setCurrentUser(null)
    // Clear session using utility
    clearSession()
    // Purge all local data if safe (no pending sync)
    try {
      // Keep IndexedDB data (offline-first). Only clear session/branch keys.
      await clearLocalDataIfSafe({ deleteIndexedDB: false })
    } catch (e) {
      console.warn('Error clearing local data on logout:', e)
    }
  }

  const handleUserUpdate = (patch) => {
    if (!patch) return
    const updatedUser = { ...(currentUser || {}), ...patch }
    setCurrentUser(updatedUser)

    try {
      // Keep the session in sync so refresh restores the updated name/photo
      saveSession(userRole, currentPage, updatedUser)
    } catch (e) {
      // ignore
    }

    try {
      localStorage.setItem('currentUser', JSON.stringify(updatedUser))
    } catch (e) {
      // ignore
    }
  }

  // No loading screen - go straight to login or main app
  if (currentPage === "login") {
    return (
      <ThemeProvider>
        <LoginPage onLogin={handleLogin} />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background">
        <AccountHealthCheck currentUser={currentUser} onLogout={handleLogout} />
        <Sidebar 
          currentPage={currentPage} 
          onPageChange={(page) => {
            setCurrentPage(page)
            // Update session using utility
            updateSessionPage(page)
          }} 
          userRole={userRole} 
          currentUser={currentUser}
          onLogout={handleLogout} 
        />
        <ScrollArea className="flex-1">
          {currentPage === "pos" && <PosPage key={currentUser?.id} inventory={inventory} onInventoryChange={setInventory} currentUser={currentUser} />}
          {currentPage === "inventory" && <InventoryPage key={currentUser?.id} inventory={inventory} onInventoryChange={setInventory} currentUser={currentUser} />}
          {currentPage === "customers" && <CustomersPage key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "profile" && <ProfilePage key={currentUser?.id} currentUser={currentUser} userRole={userRole} onUserUpdate={handleUserUpdate} />}
          {currentPage === "admin-dashboard" && <AdminDashboard key={currentUser?.id} currentUser={currentUser} onPageChange={(page) => {
            setCurrentPage(page)
            updateSessionPage(page)
          }} />}
          {currentPage === "cashier-dashboard" && <CashierDashboard key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "manager-dashboard" && <ManagerDashboard key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "reports" && <ReportsPage key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "transactions-history" && <TransactionsHistoryPage key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "expenses" && <ExpensesPage key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "branch-staff" && <BranchStaffPage key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "user-guide" && <UserGuidePage />}
          {currentPage === "data-management" && <DataManagementPage key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "admin-settings" && <AdminSettingsPage currentUser={currentUser} inventory={inventory} />}
          {currentPage === "branch-management" && <BranchManagementPage currentUser={currentUser} />}
          {currentPage === "suppliers" && <SuppliersPage key={currentUser?.id} currentUser={currentUser} />}
          {currentPage === "purchase-orders" && <PurchaseOrdersPage key={currentUser?.id} currentUser={currentUser} onInventoryChange={setInventory} />}
          {currentPage === "supplier-payments" && <SupplierPaymentsPage key={currentUser?.id} currentUser={currentUser} />}
        </ScrollArea>
        <PWAInstallPrompt />
        <PWAUpdatePrompt />
        <ServiceWorkerRegistration />
      </div>
    </ThemeProvider>
  )
}
