/**
 * Tests for centralized permissions module
 */

import { 
  FEATURES, 
  getEffectivePermissions, 
  can, 
  canWithBranchCheck,
  getAccessiblePages 
} from '../permissions'

describe('Permissions Module', () => {
  describe('Admin Role', () => {
    const adminUser = {
      id: 'admin-1',
      role: 'admin',
      name: 'Test Admin',
      email: 'admin@test.com'
    }

    test('should have monitoring permissions', () => {
      const permissions = getEffectivePermissions(adminUser)
      expect(permissions[FEATURES.VIEW_DASHBOARD]).toBe(true)
      expect(permissions[FEATURES.VIEW_REPORTS]).toBe(true)
      expect(permissions[FEATURES.VIEW_EXPENSES]).toBe(true)
      expect(permissions[FEATURES.VIEW_TRANSACTIONS]).toBe(true)
      expect(permissions[FEATURES.ADMIN_SETTINGS]).toBe(true)
      expect(permissions[FEATURES.BRANCH_MANAGEMENT]).toBe(true)
    })

    test('should NOT have operational permissions', () => {
      const permissions = getEffectivePermissions(adminUser)
      expect(permissions[FEATURES.POS]).toBe(false)
      expect(permissions[FEATURES.INVENTORY_MANAGE]).toBe(false)
      expect(permissions[FEATURES.MANAGE_USERS_BRANCH]).toBe(false)
      expect(permissions[FEATURES.MANAGE_CUSTOMERS]).toBe(false)
      expect(permissions[FEATURES.MANAGE_SUPPLIERS]).toBe(false)
      expect(permissions[FEATURES.PROCESS_SALES]).toBe(false)
    })

    test('should have correct accessible pages', () => {
      const pages = getAccessiblePages(adminUser)
      expect(pages).toContain('admin-dashboard')
      expect(pages).toContain('reports')
      expect(pages).toContain('expenses')
      expect(pages).toContain('transactions-history')
      expect(pages).toContain('admin-settings')
      expect(pages).toContain('branch-management')
      expect(pages).not.toContain('pos')
      expect(pages).not.toContain('inventory')
    })
  })

  describe('Manager Role', () => {
    const managerUser = {
      id: 'manager-1',
      role: 'manager',
      name: 'Test Manager',
      email: 'manager@test.com',
      branchId: 'branch-A'
    }

    test('should have operational permissions', () => {
      const permissions = getEffectivePermissions(managerUser)
      expect(permissions[FEATURES.INVENTORY_VIEW]).toBe(true)
      expect(permissions[FEATURES.INVENTORY_MANAGE]).toBe(true)
      expect(permissions[FEATURES.MANAGE_USERS_BRANCH]).toBe(true)
      expect(permissions[FEATURES.MANAGE_CUSTOMERS]).toBe(true)
      expect(permissions[FEATURES.MANAGE_SUPPLIERS]).toBe(true)
      expect(permissions[FEATURES.MANAGE_PURCHASE_ORDERS]).toBe(true)
      expect(permissions[FEATURES.MANAGE_EXPENSES]).toBe(true)
    })

    test('should NOT have POS permission by default', () => {
      const permissions = getEffectivePermissions(managerUser)
      expect(permissions[FEATURES.POS]).toBe(false)
      expect(permissions[FEATURES.PROCESS_SALES]).toBe(false)
    })

    test('should NOT have admin-only permissions', () => {
      const permissions = getEffectivePermissions(managerUser)
      expect(permissions[FEATURES.ADMIN_SETTINGS]).toBe(false)
      expect(permissions[FEATURES.BRANCH_MANAGEMENT]).toBe(false)
    })

    test('should have correct accessible pages', () => {
      const pages = getAccessiblePages(managerUser)
      expect(pages).toContain('manager-dashboard')
      expect(pages).toContain('inventory')
      expect(pages).toContain('suppliers')
      expect(pages).toContain('purchase-orders')
      expect(pages).toContain('branch-staff')
      expect(pages).not.toContain('admin-settings')
      expect(pages).not.toContain('branch-management')
    })

    test('should block operations without branchId', () => {
      const managerWithoutBranch = { ...managerUser, branchId: null }
      const result = canWithBranchCheck(managerWithoutBranch, FEATURES.INVENTORY_MANAGE)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('branch')
    })
  })

  describe('Cashier Role', () => {
    const cashierUser = {
      id: 'cashier-1',
      role: 'cashier',
      name: 'Test Cashier',
      email: 'cashier@test.com',
      branchId: 'branch-A'
    }

    test('should have POS permissions', () => {
      const permissions = getEffectivePermissions(cashierUser)
      expect(permissions[FEATURES.POS]).toBe(true)
      expect(permissions[FEATURES.PROCESS_SALES]).toBe(true)
      expect(permissions[FEATURES.INVENTORY_VIEW]).toBe(true)
    })

    test('should NOT have management permissions', () => {
      const permissions = getEffectivePermissions(cashierUser)
      expect(permissions[FEATURES.INVENTORY_MANAGE]).toBe(false)
      expect(permissions[FEATURES.MANAGE_USERS_BRANCH]).toBe(false)
      expect(permissions[FEATURES.MANAGE_SUPPLIERS]).toBe(false)
      expect(permissions[FEATURES.MANAGE_PURCHASE_ORDERS]).toBe(false)
    })

    test('should have correct accessible pages', () => {
      const pages = getAccessiblePages(cashierUser)
      expect(pages).toContain('pos')
      expect(pages).toContain('cashier-dashboard')
      expect(pages).toContain('inventory')
      expect(pages).toContain('customers')
      expect(pages).not.toContain('branch-staff')
      expect(pages).not.toContain('admin-settings')
    })

    test('should support permission overrides', () => {
      const cashierWithReports = {
        ...cashierUser,
        permissions: {
          view_branch_reports: true
        }
      }
      const permissions = getEffectivePermissions(cashierWithReports)
      expect(permissions[FEATURES.VIEW_BRANCH_REPORTS]).toBe(true)
      
      const pages = getAccessiblePages(cashierWithReports)
      expect(pages).toContain('reports')
      expect(pages).toContain('transactions-history')
    })

    test('should block operations without branchId', () => {
      const cashierWithoutBranch = { ...cashierUser, branchId: null }
      const result = canWithBranchCheck(cashierWithoutBranch, FEATURES.POS)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('branch')
    })
  })

  describe('can() helper', () => {
    test('should correctly check permissions', () => {
      const adminUser = { role: 'admin' }
      const managerUser = { role: 'manager' }
      const cashierUser = { role: 'cashier' }

      expect(can(adminUser, FEATURES.VIEW_DASHBOARD)).toBe(true)
      expect(can(adminUser, FEATURES.POS)).toBe(false)

      expect(can(managerUser, FEATURES.INVENTORY_MANAGE)).toBe(true)
      expect(can(managerUser, FEATURES.ADMIN_SETTINGS)).toBe(false)

      expect(can(cashierUser, FEATURES.POS)).toBe(true)
      expect(can(cashierUser, FEATURES.INVENTORY_MANAGE)).toBe(false)
    })

    test('should deny all permissions for invalid user', () => {
      expect(can(null, FEATURES.VIEW_DASHBOARD)).toBe(false)
      expect(can({}, FEATURES.VIEW_DASHBOARD)).toBe(false)
      expect(can({ role: 'invalid' }, FEATURES.VIEW_DASHBOARD)).toBe(false)
    })
  })
})
