"use client"

import { useState } from "react"
import TopBar from "../components/TopBar"

export default function UserGuidePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeSection, setActiveSection] = useState("")

  const guideContent = [
    {
      id: "getting-started",
      title: "🚀 Getting Started",
      icon: "🚀",
      content: [
        {
          subtitle: "Logging In",
          steps: [
            "Open Whiskey Ballet POS in your browser",
            "Enter your email address and password",
            "Select your role (Admin, Manager, or Cashier)",
            "Click the 'Sign In' button",
            "You'll see the main dashboard after logging in"
          ],
          image: "/guide/login.png",
          tips: "Use admin@whiskeyballet.ke with admin123 for admin access. All data is stored locally on your device for 100% offline operation."
        }
      ]
    },
    {
      id: "pos-system",
      title: "🛒 Point of Sale (POS)",
      icon: "🛒",
      content: [
        {
          subtitle: "Making a Sale",
          steps: [
            "Click 'POS System' in the sidebar menu",
            "Search for products using the search bar or click on product cards",
            "Click on a product to add it to the cart",
            "Adjust quantity using + and - buttons if needed",
            "Select payment method (Cash or M-Pesa)",
            "Click 'Complete Sale' button",
            "A receipt will be generated automatically"
          ],
          image: "/guide/pos.png",
          tips: "You can scan barcodes directly if you have a barcode scanner connected"
        },
        {
          subtitle: "Credit Sales",
          steps: [
            "Add items to cart as normal",
            "Select a customer from the dropdown menu",
            "Check the customer's available credit",
            "Click 'CREDIT SALE' button",
            "The system updates the customer's balance automatically"
          ],
          tips: "Credit sales are only available for registered customers with credit limits"
        }
      ]
    },
    {
      id: "inventory",
      title: "📦 Managing Inventory",
      icon: "📦",
      content: [
        {
          subtitle: "Adding New Products",
          steps: [
            "Click 'Inventory' in the sidebar",
            "Click the '+ Add Product' button",
            "Fill in product details:",
            "  → Product Name (required)",
            "  → Barcode/SKU (required)",
            "  → Category",
            "  → Cost Price (what you pay)",
            "  → Selling Price (what customers pay)",
            "  → Initial quantity",
            "  → Low stock alert level",
            "  → Expiry date (optional, for perishable items)",
            "Click 'Add Product' to save"
          ],
          image: "/guide/add-product.png",
          tips: "Set realistic low stock levels to get alerts before you run out"
        },
        {
          subtitle: "Editing Products",
          steps: [
            "Find the product in the inventory table",
            "Click the 'Edit' button (pencil icon)",
            "Update any information you need to change",
            "Click 'Save Changes'"
          ],
          tips: "You can update prices, quantities, and all product information"
        },
        {
          subtitle: "Stock Adjustments",
          steps: [
            "Click the adjustment button (🔧 icon) on any product",
            "Select the reason for adjustment:",
            "  → Damaged - for broken items",
            "  → Expired - for items past expiry",
            "  → Lost/Stolen - for missing inventory",
            "  → Found/Recovered - for items you found",
            "  → Manual Correction - for counting errors",
            "Enter the quantity",
            "Add notes if needed",
            "Click 'Apply Adjustment'"
          ],
          tips: "All adjustments are tracked for auditing purposes"
        }
      ]
    },
    {
      id: "customers",
      title: "👥 Managing Customers",
      icon: "👥",
      content: [
        {
          subtitle: "Adding New Customers",
          steps: [
            "Click 'Customers' in the sidebar",
            "Click '+ Add Customer' button",
            "Enter customer information:",
            "  → Name (required)",
            "  → Phone number",
            "  → Email",
            "  → Address",
            "  → Credit limit (if offering credit)",
            "Click 'Add Customer'"
          ],
          tips: "Set appropriate credit limits based on customer trust and purchase history"
        },
        {
          subtitle: "Recording Payments",
          steps: [
            "Go to the Customers page",
            "Find customer with outstanding balance",
            "Click 'View' button",
            "Click '💰 Record Payment'",
            "Enter the amount paid",
            "Or use quick buttons (50% or Full Payment)",
            "Click 'Confirm Payment'"
          ],
          tips: "You can record partial payments - customers can pay over time"
        }
      ]
    },
    {
      id: "suppliers",
      title: "🏭 Managing Suppliers",
      icon: "🏭",
      content: [
        {
          subtitle: "Adding Suppliers",
          steps: [
            "Click 'Suppliers' in the sidebar",
            "Click '+ Add Supplier' button",
            "Enter supplier details:",
            "  → Company name (required)",
            "  → Contact person",
            "  → Phone number",
            "  → Email",
            "  → Address",
            "Click 'Add Supplier'"
          ],
          tips: "Keep supplier information up-to-date for easy ordering"
        }
      ]
    },
    {
      id: "purchase-orders",
      title: "📋 Purchase Orders",
      icon: "📋",
      content: [
        {
          subtitle: "Creating Purchase Orders",
          steps: [
            "Click 'Purchase Orders' in the sidebar",
            "Click '+ Create PO' button",
            "Select a supplier from the dropdown",
            "Add items to the order:",
            "  → Select existing products from inventory",
            "  → Or add new products",
            "  → Enter quantity needed",
            "  → Verify cost price",
            "  → Set selling price (for new products)",
            "Set expected delivery date (optional)",
            "Add notes if needed",
            "Click 'Create Purchase Order'"
          ],
          tips: "The cost price auto-fills from inventory to maintain consistency"
        },
        {
          subtitle: "Managing Orders",
          steps: [
            "Click on any order to view details",
            "For draft orders, click 'Confirm Order'",
            "When goods arrive, click 'Mark as Received'",
            "You can cancel orders if needed"
          ],
          tips: "Received orders automatically update inventory quantities"
        }
      ]
    },
    {
      id: "reports",
      title: "📊 Reports",
      icon: "📊",
      content: [
        {
          subtitle: "Viewing Sales Reports",
          steps: [
            "Click 'Reports' in the sidebar",
            "Select date range using the filters",
            "View sales charts and statistics",
            "Export data if needed"
          ],
          tips: "Regular reports help track business performance"
        }
      ]
    },
    {
      id: "backup",
      title: "💾 Backup & Restore",
      icon: "💾",
      content: [
        {
          subtitle: "Backing Up Your Data",
          steps: [
            "Click 'Backup & Restore' in the sidebar",
            "Click 'Download Backup' button",
            "Save the file to a safe location",
            "Keep regular backups (daily or weekly recommended)"
          ],
          tips: "Store backups in multiple locations (USB, cloud, etc.)"
        },
        {
          subtitle: "Restoring Data",
          steps: [
            "Click 'Backup & Restore' in the sidebar",
            "Click 'Choose File' under Restore section",
            "Select your backup file",
            "Click 'Restore Data'",
            "Confirm the restoration"
          ],
          tips: "IMPORTANT: Restoring will replace all current data!"
        }
      ]
    }
  ]

  // Filter content based on search
  const filteredContent = guideContent.filter(section => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      section.title.toLowerCase().includes(searchLower) ||
      section.content.some(item => 
        item.subtitle.toLowerCase().includes(searchLower) ||
        item.steps.some(step => step.toLowerCase().includes(searchLower))
      )
    )
  })

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId)
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="📖 User Guide"
        subtitle="Step-by-step instructions for using the system"
      />

      <div className="flex-1 overflow-auto bg-background">
        <div className="max-w-7xl mx-auto p-6">
          
          {/* Search Bar */}
          <div className="mb-8 sticky top-0 bg-background z-10 pb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search for help... (e.g., 'how to add product', 'make a sale', 'record payment')"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-4 text-lg border-2 border-primary/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground shadow-lg"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Quick Navigation */}
            <div className="mt-4 flex flex-wrap gap-2">
              {guideContent.map(section => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground shadow-md scale-105'
                      : 'bg-card text-foreground border-2 border-border hover:border-primary hover:shadow'
                  }`}
                >
                  {section.icon} {section.title.replace(/^[^\s]+\s/, '')}
                </button>
              ))}
            </div>
          </div>

          {/* Welcome Message */}
          {!searchTerm && (
            <div className="mb-8 bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-foreground mb-3">👋 Welcome to Whiskey Ballet User Guide!</h2>
              <p className="text-foreground/80 text-lg mb-4">
                This guide will help you learn how to use all features of the system. Each section includes:
              </p>
              <ul className="space-y-2 text-foreground/80">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Step-by-step instructions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Helpful tips and best practices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Visual examples where helpful</span>
                </li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                💡 Tip: Use the search bar above to quickly find what you need!
              </p>
            </div>
          )}

          {/* Guide Sections */}
          <div className="space-y-8">
            {filteredContent.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-muted-foreground">
                  No results found for "{searchTerm}"
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try different keywords or browse all sections above
                </p>
              </div>
            ) : (
              filteredContent.map(section => (
                <div
                  key={section.id}
                  id={section.id}
                  className="bg-card border-2 border-border rounded-xl shadow-lg overflow-hidden"
                >
                  <div className="bg-primary/10 border-b-2 border-border px-6 py-4">
                    <h2 className="text-2xl font-bold text-foreground">
                      {section.title}
                    </h2>
                  </div>

                  <div className="p-6 space-y-6">
                    {section.content.map((item, idx) => (
                      <div key={idx} className="space-y-4">
                        <h3 className="text-xl font-semibold text-primary">
                          {item.subtitle}
                        </h3>

                        <div className="bg-muted/30 rounded-lg p-4">
                          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                            <span className="text-primary">📝</span>
                            Steps:
                          </h4>
                          <ol className="space-y-2">
                            {item.steps.map((step, stepIdx) => (
                              <li
                                key={stepIdx}
                                className="flex items-start gap-3 text-foreground"
                              >
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                  {stepIdx + 1}
                                </span>
                                <span className="flex-1">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {item.tips && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
                            <p className="text-sm flex items-start gap-2">
                              <span className="text-yellow-600 dark:text-yellow-400 font-bold text-lg">💡</span>
                              <span className="text-foreground">
                                <strong>Tip:</strong> {item.tips}
                              </span>
                            </p>
                          </div>
                        )}

                        {idx < section.content.length - 1 && (
                          <div className="border-t border-border/50 my-4"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Need More Help Section */}
          <div className="mt-12 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-8 text-center">
            <h3 className="text-2xl font-bold text-foreground mb-3">
              Need More Help?
            </h3>
            <p className="text-foreground/80 mb-4">
              Can't find what you're looking for? Here are some tips:
            </p>
            <ul className="text-left max-w-2xl mx-auto space-y-2 text-foreground/80 mb-6">
              <li className="flex items-start gap-2">
                <span>✓</span>
                <span>Try different search terms in the search bar above</span>
              </li>
              <li className="flex items-start gap-2">
                <span>✓</span>
                <span>Check all sections using the quick navigation buttons</span>
              </li>
              <li className="flex items-start gap-2">
                <span>✓</span>
                <span>Experiment with the system - it's designed to be user-friendly!</span>
              </li>
              <li className="flex items-start gap-2">
                <span>✓</span>
                <span>Contact your system administrator for additional support</span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}
