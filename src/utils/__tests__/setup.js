/**
 * Jest Configuration and Setup
 */

// Import testing library matchers
import '@testing-library/jest-dom'

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}

// Mock IndexedDB
global.indexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
}

// Console suppression for cleaner test output
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
}
