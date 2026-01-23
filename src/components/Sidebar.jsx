"use client"

import { useState, useEffect } from "react"
import MenuIcon from "./icons/MenuIcon"
import DashboardIcon from "./icons/DashboardIcon"
import ShoppingCartIcon from "./icons/ShoppingCartIcon"
import BoxIcon from "./icons/BoxIcon"
import ChartBarIcon from "./icons/ChartBarIcon"
import SettingsIcon from "./icons/SettingsIcon"
import LogoutIcon from "./icons/LogoutIcon"
import UsersIcon from "./icons/UsersIcon"
import DocumentIcon from "./icons/DocumentIcon"
import CashIcon from "./icons/CashIcon"
import HelpIcon from "./icons/HelpIcon"
import ThemeToggle from "./ThemeToggle"
import { getStorageMode } from "../utils/storage"
import { getFirstName } from "../utils/nameHelpers"

export default function Sidebar({ currentPage, onPageChange, userRole, currentUser, onLogout }) {
  const [isOpen, setIsOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [storageMode, setStorageMode] = useState("web")

  // Helper function to create fallback logo element
  const createLogoFallback = (size = 'large') => {
    const fallback = document.createElement('div')
    if (size === 'large') {
      fallback.className = 'w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-[#B8941F] rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg'
      fallback.innerHTML = '<span class="text-[#2C1810] text-xl font-bold">WB</span>'
    } else {
      fallback.className = 'w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-[#B8941F] rounded-full flex items-center justify-center'
      fallback.innerHTML = '<span class="text-[#2C1810] text-lg font-bold">WB</span>'
    }
    return fallback
  }

  useEffect(() => {
    // Add global style for hiding scrollbar in sidebar navigation
    const style = document.createElement('style')
    style.textContent = `
      .sidebar-nav-scrollable::-webkit-scrollbar {
        display: none;
      }
    `
    document.head.appendChild(style)
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  useEffect(() => {
    // Detect storage mode
    setStorageMode(getStorageMode())
    
    // Only run browser-specific code in browser environment
    if (typeof window === "undefined") {
      return
    }
    
    // Detect if mobile on mount
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    
    // Add resize listener
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Split menu items into main navigation and admin sections
  const mainMenuItems = userRole === "admin"
    ? [
        { id: "admin-dashboard", label: "Dashboard", icon: DashboardIcon },
        { id: "pos", label: "POS System", icon: ShoppingCartIcon },
        { id: "inventory", label: "Inventory", icon: BoxIcon },
        { id: "customers", label: "Customers", icon: UsersIcon },
        { id: "suppliers", label: "Suppliers", icon: UsersIcon },
        { id: "purchase-orders", label: "Purchase Orders", icon: DocumentIcon },
        { id: "supplier-payments", label: "Payments", icon: CashIcon },
        { id: "expenses", label: "Expense Tracker", icon: CashIcon },
        { id: "reports", label: "Reports", icon: ChartBarIcon },
        { id: "transactions-history", label: "Transaction History", icon: DocumentIcon },
      ]
    : userRole === "manager"
    ? [
        { id: "manager-dashboard", label: "Dashboard", icon: DashboardIcon },
        { id: "inventory", label: "Inventory", icon: BoxIcon },
        { id: "suppliers", label: "Suppliers", icon: UsersIcon },
        { id: "purchase-orders", label: "Purchase Orders", icon: DocumentIcon },
        { id: "supplier-payments", label: "Payments", icon: CashIcon },
        { id: "reports", label: "Reports", icon: ChartBarIcon },
        { id: "transactions-history", label: "Transaction History", icon: DocumentIcon },
      ]
    : [
        { id: "pos", label: "POS System", icon: ShoppingCartIcon },
        { id: "cashier-dashboard", label: "Dashboard", icon: DashboardIcon },
        { id: "inventory", label: "Inventory", icon: BoxIcon },
        { id: "customers", label: "Customers", icon: UsersIcon },
        { id: "suppliers", label: "Suppliers", icon: UsersIcon },
        { id: "purchase-orders", label: "Purchase Orders", icon: DocumentIcon },
        { id: "reports", label: "Reports", icon: ChartBarIcon },
        { id: "transactions-history", label: "Transaction History", icon: DocumentIcon },
      ]

  // Common menu items available to all users
  const commonSettingsItems = [
    { id: "user-guide", label: "User Guide", icon: HelpIcon },
  ]
  
  // Only show admin-specific menu items for admin role
  const adminMenuItems = userRole === "admin" 
    ? [
        { id: "admin-settings", label: "Admin Settings", icon: SettingsIcon },
        { id: "data-management", label: "Backup & Restore", icon: SettingsIcon },
        ...commonSettingsItems
      ]
    : commonSettingsItems

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 rounded-lg bg-[#6B0F1A] text-white shadow-xl hover:bg-[#8B1E2A] transition-all border-2 border-[#D4AF37]/40 hover:scale-105 active:scale-95"
        title={isOpen ? "Close menu" : "Open menu"}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        <MenuIcon className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isOpen ? "w-72" : "w-72 lg:w-20"}
          fixed lg:sticky top-0 left-0
          bg-gradient-to-b from-[#2C1810] via-[#1a0f0a] to-[#2C1810] text-[#F5F5DC] border-r-2 border-[#D4AF37]/30 
          h-screen transition-all duration-300 z-40 flex flex-col shadow-2xl
        `}
      >
        {/* Sticky Header with Logo */}
        <div className="sticky top-0 z-10 p-6 border-b-2 border-[#D4AF37]/20 flex items-center justify-between min-h-[80px] bg-gradient-to-b from-[#2C1810] via-[#1a0f0a] to-[#2C1810]">
          {isOpen && (
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                <img 
                  src="/cellar-logo-badge.svg" 
                  alt="Whiskey Ballet Logo" 
                  className="w-12 h-12" 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.appendChild(createLogoFallback('large'));
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-[#D4AF37]">Whiskey Ballet</h2>
                <p className="text-xs text-[#F5F5DC]/70">
                  Wines & Spirits
                  {storageMode === 'desktop' && " • Desktop"}
                </p>
              </div>
            </div>
          )}
          {!isOpen && (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto flex-shrink-0">
              <img 
                src="/cellar-logo-badge.svg" 
                alt="Whiskey Ballet Logo" 
                className="w-12 h-12" 
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.appendChild(createLogoFallback('small'));
                }}
              />
            </div>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`hidden lg:flex p-2.5 rounded-lg transition-all flex-shrink-0 shadow-lg hover:shadow-xl hover:scale-105 ${
              isOpen 
                ? "bg-[#D4AF37]/20 border-2 border-[#D4AF37]/50 hover:bg-[#D4AF37]/30" 
                : "bg-[#6B0F1A] border-2 border-[#D4AF37]/40 hover:bg-[#8B1E2A]"
            }`}
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <MenuIcon className={`w-5 h-5 ${isOpen ? "text-[#D4AF37]" : "text-[#F5F5DC]"}`} />
          </button>
        </div>

        {/* Scrollable Navigation - Hide scrollbar */}
        <nav className="flex-1 p-4 overflow-y-auto sidebar-nav-scrollable" style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {/* Main Navigation */}
          <div className="space-y-1 mb-4">
            {mainMenuItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id)
                    // Close sidebar on mobile after selecting item
                    if (isMobile) {
                      setIsOpen(false)
                    }
                  }}
                  className={`w-full flex items-center gap-3 pr-4 pl-4 py-3 rounded-lg transition-all touch-manipulation relative leading-6 ${
                    currentPage === item.id
                      ? "bg-gradient-to-r from-[#6B0F1A]/30 to-[#6B0F1A]/10 text-[#D4AF37] font-semibold shadow-lg"
                      : "text-[#F5F5DC]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 active:bg-[#D4AF37]/20 font-normal"
                  }`}
                  title={!isOpen ? item.label : ""}
                >
                  {/* Accent bar for active state */}
                  {currentPage === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-10 bg-gradient-to-b from-[#D4AF37] to-[#B8941F] rounded-r-full shadow-lg" />
                  )}
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isOpen && <span className="text-sm tracking-wide">{item.label}</span>}
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div className="my-4 mx-4">
            <div className="h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
          </div>

          {/* Admin Section */}
          <div className="space-y-1">
            {adminMenuItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id)
                    // Close sidebar on mobile after selecting item
                    if (isMobile) {
                      setIsOpen(false)
                    }
                  }}
                  className={`w-full flex items-center gap-3 pr-4 pl-4 py-3 rounded-lg transition-all touch-manipulation relative leading-6 ${
                    currentPage === item.id
                      ? "bg-gradient-to-r from-[#6B0F1A]/30 to-[#6B0F1A]/10 text-[#D4AF37] font-semibold shadow-lg"
                      : "text-[#F5F5DC]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 active:bg-[#D4AF37]/20 font-normal"
                  }`}
                  title={!isOpen ? item.label : ""}
                >
                  {/* Accent bar for active state */}
                  {currentPage === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-10 bg-gradient-to-b from-[#D4AF37] to-[#B8941F] rounded-r-full shadow-lg" />
                  )}
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isOpen && <span className="text-sm tracking-wide">{item.label}</span>}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Sticky Footer - Profile Card and Logout */}
        <div className="sticky bottom-0 z-10 p-4 space-y-2 border-t-2 border-[#D4AF37]/20 bg-gradient-to-t from-[#2C1810] via-[#1a0f0a] to-[#2C1810]">
          {isOpen && (
            <div className="px-3 py-3 bg-gradient-to-br from-[#6B0F1A]/20 to-[#6B0F1A]/10 rounded-lg border-2 border-[#D4AF37]/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center flex-shrink-0 text-[#2C1810] font-bold text-lg shadow-lg">
                {userRole === 'admin' ? 'A' : userRole === 'manager' ? 'M' : 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#D4AF37] truncate">
                  {currentUser?.name ? getFirstName(currentUser.name) : (userRole === 'admin' ? 'Admin' : userRole === 'manager' ? 'Manager' : 'Cashier')}
                </div>
                <div className="text-xs text-[#F5F5DC]/70 truncate">
                  {userRole === 'admin' ? 'Administrator' : userRole === 'manager' ? 'Stock Manager' : 'Cashier'}
                </div>
              </div>
              <ThemeToggle />
            </div>
          )}
          {!isOpen && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center text-[#2C1810] font-bold text-lg shadow-lg">
                {userRole === 'admin' ? 'A' : userRole === 'manager' ? 'M' : 'C'}
              </div>
              <ThemeToggle />
            </div>
          )}
          
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all hover:bg-red-500/20 text-[#FF6B6B] hover:text-red-400 text-sm tracking-wide font-medium"
            title={!isOpen ? "Logout" : ""}
          >
            <LogoutIcon className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
