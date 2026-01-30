/**
 * Branch Fixer Utility
 * Fixes corrupted branch data by clearing and resetting storage
 */

import { getDB, STORES } from './indexedDBStorage';
import { getAllUsers } from './auth';


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
      results.errors.push(`❌ Error clearing IndexedDB: ${error.message}`);
      results.success = false;
    }

    // Step 3: Reset user branch assignments
    console.log('3️⃣ Resetting user branch assignments...');
    try {
      const users = await getAllUsers();
      // Reset branchId for all users by updating localStorage directly
      const usersDb = JSON.parse(localStorage.getItem('pos-users-db') || '[]');
      const updatedUsers = usersDb.map(user => ({ ...user, branchId: null }));
      localStorage.setItem('pos-users-db', JSON.stringify(updatedUsers));
      results.steps.push('✅ Reset user branch assignments');
    } catch (error) {
      results.errors.push(`❌ Error resetting user branch assignments: ${error.message}`);
      results.success = false;
    }

    return results;
  } catch (error) {
    console.error('Error fixing corrupted branches:', error);
    return { success: false, steps: results.steps, errors: [...results.errors, error.message] };
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
