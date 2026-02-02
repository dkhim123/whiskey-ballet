
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

function BrandBadge({ size = "lg" }) {
  const [imgOk, setImgOk] = useState(true)
  const sizeClass = size === "sm" ? "w-10 h-10" : "w-12 h-12"
  const textClass = size === "sm" ? "text-lg" : "text-xl"
  const shapeClass = "rounded-xl"

  return (
    // overflow-hidden is IMPORTANT:
    // some SVGs are wider than the box; without clipping they "spill" and look like multiple logos.
    <div className={`${sizeClass} ${shapeClass} overflow-hidden flex items-center justify-center shrink-0`}>
      {imgOk ? (
        <img
          src="/cellar-logo-badge.svg"
          alt="Whiskey Ballet Logo"
          className="w-full h-full object-contain"
          onError={() => setImgOk(false)}
        />
      ) : (
        <div
          className={`${sizeClass} bg-linear-to-br from-[#D4AF37] to-[#B8941F] ${shapeClass} flex items-center justify-center shadow-lg`}
        >
          <span className={`text-[#2C1810] ${textClass} font-bold`}>WB</span>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ currentPage, onPageChange, userRole, currentUser, onLogout }) {
  const [isOpen, setIsOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [storageMode, setStorageMode] = useState("web")

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
    setStorageMode(getStorageMode())
    if (typeof window === "undefined") return
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  const commonSettingsItems = [
    { id: "profile", label: "My Profile", icon: UsersIcon },
    { id: "user-guide", label: "User Guide", icon: HelpIcon },
  ]
  const adminMenuItems = userRole === "admin"
    ? [
        { id: "admin-settings", label: "Admin Settings", icon: SettingsIcon },
        { id: "branch-management", label: "Branches", icon: SettingsIcon },
        { id: "data-management", label: "Backup & Restore", icon: SettingsIcon },
        ...commonSettingsItems
      ]
    : commonSettingsItems

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`lg:hidden fixed top-4 ${isOpen ? "left-[17rem]" : "left-4"} z-50 p-2.5 rounded-xl bg-[#2C1810]/80 text-[#F5F5DC] shadow-xl hover:bg-[#2C1810] transition-all border border-[#D4AF37]/25 hover:border-[#D4AF37]/40 backdrop-blur-sm hover:scale-105 active:scale-95`}
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
          bg-linear-to-b from-[#2C1810] via-[#1a0f0a] to-[#2C1810] text-[#F5F5DC] border-r-2 border-[#D4AF37]/30
          h-screen transition-all duration-300 z-40 flex flex-col shadow-2xl
        `}
      >
        {/* Sticky Header with Logo */}
        <div
          className={`sticky top-0 z-10 border-b border-[#D4AF37]/20 flex items-center justify-between bg-linear-to-b from-[#2C1810] via-[#1a0f0a] to-[#2C1810] ${
            isOpen ? "p-6 min-h-[84px]" : "p-4 min-h-[84px]"
          }`}
        >
          {isOpen ? (
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <BrandBadge size="lg" />
              <div className="flex flex-col justify-center leading-tight flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-[#F5F5DC] tracking-tight truncate">
                  Whiskey Ballet
                </h2>
                <p className="text-xs text-[#F5F5DC]/60 tracking-wide truncate">
                  Wines & Spirits{storageMode === 'desktop' ? " • Desktop" : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1">
              <BrandBadge size="sm" />
            </div>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`hidden lg:flex p-2.5 rounded-xl transition-all shrink-0 shadow-md hover:shadow-lg hover:scale-105 border ${
              isOpen
                ? "bg-[#F5F5DC]/5 border-[#D4AF37]/25 hover:bg-[#F5F5DC]/10 hover:border-[#D4AF37]/40"
                : "bg-[#F5F5DC]/5 border-[#D4AF37]/25 hover:bg-[#F5F5DC]/10 hover:border-[#D4AF37]/40"
            }`}
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <MenuIcon className="w-5 h-5 text-[#F5F5DC]" />
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
                    if (isMobile) setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 pr-4 pl-4 py-3 rounded-lg transition-all touch-manipulation relative leading-6 ${
                    currentPage === item.id
                      ? "bg-linear-to-r from-[#6B0F1A]/30 to-[#6B0F1A]/10 text-[#D4AF37] font-semibold shadow-lg"
                      : "text-[#F5F5DC]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 active:bg-[#D4AF37]/20 font-normal"
                  }`}
                  title={!isOpen ? item.label : ""}
                >
                  {currentPage === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-linear-to-b from-[#D4AF37] to-[#B8941F] rounded-r-full shadow-lg" />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  {isOpen && <span className="text-sm tracking-wide">{item.label}</span>}
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div className="my-4 mx-4">
            <div className="h-px bg-linear-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
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
                    if (isMobile) setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 pr-4 pl-4 py-3 rounded-lg transition-all touch-manipulation relative leading-6 ${
                    currentPage === item.id
                      ? "bg-linear-to-r from-[#6B0F1A]/30 to-[#6B0F1A]/10 text-[#D4AF37] font-semibold shadow-lg"
                      : "text-[#F5F5DC]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 active:bg-[#D4AF37]/20 font-normal"
                  }`}
                  title={!isOpen ? item.label : ""}
                >
                  {currentPage === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-linear-to-b from-[#D4AF37] to-[#B8941F] rounded-r-full shadow-lg" />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  {isOpen && <span className="text-sm tracking-wide">{item.label}</span>}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Sticky Footer - Profile Card and Logout */}
        <div className="sticky bottom-0 z-10 p-4 space-y-2 border-t-2 border-[#D4AF37]/20 bg-linear-to-t from-[#2C1810] via-[#1a0f0a] to-[#2C1810]">
          {isOpen ? (
            <div className="px-3 py-3 bg-linear-to-br from-[#6B0F1A]/20 to-[#6B0F1A]/10 rounded-lg border-2 border-[#D4AF37]/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center shrink-0 text-[#2C1810] font-bold text-lg shadow-lg">
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
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center text-[#2C1810] font-bold text-lg shadow-lg">
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
            <LogoutIcon className="w-5 h-5 shrink-0" />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
