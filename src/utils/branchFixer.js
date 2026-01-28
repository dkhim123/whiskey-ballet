/**
 * Branch Fixer Utility
 * Fixes corrupted branch data by clearing and resetting storage
 */

import { getDB, STORES } from './indexedDBStorage';

/**
 * Fix corrupted branch data
 * Clears all branch data from localStorage, IndexedDB, and user assignments
 * @returns {Promise<Object>} Result with status and message
 */
export async function fixCorruptedBranches() {
  const results = {
    success: true,
    steps: [],
    errors: []
  };

  try {
    // Step 1: Clear localStorage branches
    console.log('1️⃣ Clearing localStorage branches...');
    try {
      localStorage.removeItem('pos-branches');
      results.steps.push('✅ Cleared localStorage branches');
    } catch (error) {
      results.errors.push(`❌ Error clearing localStorage: ${error.message}`);
      results.success = false;
    }

    // Step 2: Clear IndexedDB branches
    console.log('2️⃣ Clearing IndexedDB branches...');
    try {
      const db = await getDB();
      const tx = db.transaction(STORES.BRANCHES, 'readwrite');
      const store = tx.objectStore(STORES.BRANCHES);
      await store.clear();
      await tx.done;
      results.steps.push('✅ Cleared IndexedDB branches');
    } catch (error) {
      console.warn('IndexedDB clear warning:', error);
      results.steps.push('⚠️ IndexedDB branches cleared (or didn\'t exist)');
      // Don't fail if IndexedDB doesn't exist yet
    }

    // Step 3: Clear user branch assignments
    console.log('3️⃣ Clearing user branch assignments...');
    try {
      const users = JSON.parse(localStorage.getItem('pos-users-db') || '[]');
      let clearedCount = 0;
      
      users.forEach(user => {
        if (user.branchId) {
          user.branchId = null;
          clearedCount++;
        }
      });
      
      if (clearedCount > 0) {
        localStorage.setItem('pos-users-db', JSON.stringify(users));
        results.steps.push(`✅ Cleared branch assignments from ${clearedCount} user(s)`);
      } else {
        results.steps.push('ℹ️ No users had branch assignments');
      }
    } catch (error) {
      results.errors.push(`❌ Error clearing user assignments: ${error.message}`);
      results.success = false;
    }

    console.log('✅ Branch data reset complete!');
    return results;

  } catch (error) {
    console.error('Branch fixer error:', error);
    results.success = false;
    results.errors.push(`Unexpected error: ${error.message}`);
    return results;
  }
}

/**
 * Validate branch structure
 * Checks if a branch object has all required fields
 * @param {Object} branch - Branch object to validate
 * @returns {Object} Validation result with isValid and missing fields
 */
export function validateBranchStructure(branch) {
  const requiredFields = ['id', 'adminId', 'name', 'createdAt'];
  const missingFields = [];

  requiredFields.forEach(field => {
    if (!branch[field]) {
      missingFields.push(field);
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Check if branches need fixing
 * @returns {Promise<Object>} Status with needsFix and issues found
 */
export async function checkBranchHealth() {
  const issues = [];
  
  try {
    // Check localStorage branches
    const storedBranches = JSON.parse(localStorage.getItem('pos-branches') || '[]');
    
    storedBranches.forEach((branch, index) => {
      const validation = validateBranchStructure(branch);
      if (!validation.isValid) {
        issues.push({
          location: 'localStorage',
          branch: branch.name || `Branch ${index + 1}`,
          missingFields: validation.missingFields
        });
      }
    });

    return {
      needsFix: issues.length > 0,
      issues,
      totalBranches: storedBranches.length
    };
  } catch (error) {
    return {
      needsFix: true,
      issues: [{ error: error.message }],
      totalBranches: 0
    };
  }
}
