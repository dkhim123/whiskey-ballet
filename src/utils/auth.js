/**
 * Authentication utility for secure user management
 * Works in both online and offline modes
 */

import bcrypt from 'bcryptjs'
import { writeUserToRealtimeDB, readEntityFromRealtimeDB } from './firebaseRealtime'
import { auth, db, isFirebaseConfigured } from '../config/firebase'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const USERS_STORAGE_KEY = 'pos-users-db'
const SALT_ROUNDS = 10
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 2 * 60 * 1000 // 2 minutes
const LOGIN_ATTEMPTS_KEY = 'pos-login-attempts'

/**
 * Password validation rules
 */
export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,
  specialChars: "!@#$%^&*()_+-=[]{}|;:'\",.<>?/",
  // Pre-computed set for efficient validation
  specialCharsSet: new Set("!@#$%^&*()_+-=[]{}|;:'\",.<>?/".split(''))
}

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password) => {
  const errors = []
  
  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`)
  }
  
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }
  
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }
  
  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }
  
  return errors
}

/**
 * Validate email format (accepts any email format)
 */
export const validateEmail = (email) => {
  // Accept any email format - just check basic structure
  if (!email || typeof email !== 'string') return false
  // Lenient regex - requires @ with at least one character before and after, and a dot in the domain
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS)
    const hash = await bcrypt.hash(password, salt)
    return hash
  } catch (error) {
    console.error('Error hashing password:', error)
    throw new Error('Failed to hash password')
  }
}

/**
 * Verify password against hash
 */
export const verifyPassword = async (password, hash) => {
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    console.error('Error verifying password:', error)
    return false
  }
}

/**
 * Check if running in Electron
 */
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron
}

/**
 * Get all users from storage (works in both web and desktop)
 */
const getUsersFromStorage = async () => {
  try {
    if (isElectron()) {
      // Desktop mode: read from file system
      const users = await window.electronAPI.readUsers()
      return users || []
    } else {
      // Web mode: read from localStorage
      const stored = localStorage.getItem(USERS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    }
  } catch (error) {
    console.error('Error reading users from storage:', error)
    return []
  }
}

/**
 * Save users to storage (works in both web and desktop)
 */
const saveUsersToStorage = async (users) => {
  try {
    if (isElectron()) {
      // Desktop mode: write to file system
      const result = await window.electronAPI.writeUsers(users)
      return result.success
    } else {
      // Web mode: write to localStorage
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
      return true
    }
  } catch (error) {
    console.error('Error saving users to storage:', error)
    return false
  }
}

/**
 * Initialize default admin account if no users exist
 * NOTE: Changed to NOT create default users - users must self-register as admin
 */
export const initializeDefaultUsers = async () => {
  try {
    const users = await getUsersFromStorage()
    
    // No longer creating default users - system starts empty
    // Users must create their own admin account via sign-up
    if (users.length === 0) {
      console.log('📝 No users found. New users can create admin accounts via sign-up.')
    }
    
    return users
  } catch (error) {
    console.error('Error initializing users:', error)
    return []
  }
}

/**
 * Get login attempts tracker
 */
const getLoginAttempts = () => {
  try {
    const stored = localStorage.getItem(LOGIN_ATTEMPTS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    return {}
  }
}

/**
 * Save login attempts tracker
 */
const saveLoginAttempts = (attempts) => {
  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts))
  } catch (error) {
    console.error('Error saving login attempts:', error)
  }
}

/**
 * Check if account is locked out
 */
export const isAccountLockedOut = (email) => {
  const attempts = getLoginAttempts()
  const userAttempts = attempts[email]
  
  if (!userAttempts || userAttempts.count < MAX_LOGIN_ATTEMPTS) {
    return { locked: false, remainingTime: 0 }
  }
  
  const timeSinceLockout = Date.now() - userAttempts.lastAttempt
  
  if (timeSinceLockout < LOCKOUT_DURATION_MS) {
    const remainingTime = Math.ceil((LOCKOUT_DURATION_MS - timeSinceLockout) / 1000 / 60)
    return { locked: true, remainingTime }
  }
  
  // Lockout period has expired, reset attempts
  delete attempts[email]
  saveLoginAttempts(attempts)
  return { locked: false, remainingTime: 0 }
}

/**
 * Record failed login attempt
 */
const recordFailedAttempt = (email) => {
  const attempts = getLoginAttempts()
  
  if (!attempts[email]) {
    attempts[email] = { count: 1, lastAttempt: Date.now() }
  } else {
    attempts[email].count += 1
    attempts[email].lastAttempt = Date.now()
  }
  
  saveLoginAttempts(attempts)
  
  return {
    attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - attempts[email].count),
    isLockedOut: attempts[email].count >= MAX_LOGIN_ATTEMPTS
  }
}

/**
 * Reset login attempts on successful login
 */
const resetLoginAttempts = (email) => {
  const attempts = getLoginAttempts()
  delete attempts[email]
  saveLoginAttempts(attempts)
}

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (email, password) => {
  try {
    // Validate inputs
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' }
    }
    const sanitizedEmail = email.trim().toLowerCase()
    if (!validateEmail(sanitizedEmail)) {
      return { success: false, error: 'Invalid email format' }
    }
    
    // Check if Firebase is configured
    const firebaseConfigured = isFirebaseConfigured()
    
    // Try Firebase Auth first if configured
    if (firebaseConfigured && auth) {
      let userCredential
      try {
        userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, password)
        const user = userCredential.user

        // Firebase-first user profile lookup:
        // We require a provisioned profile so admins can monitor cashiers by branch/org.
        // (No more "random Firebase Auth user defaults to cashier".)
        let userProfile = null

        // 1) Firestore mapping/profile (preferred)
        if (db) {
          try {
            const profileSnap = await Promise.race([
              getDoc(doc(db, 'userProfiles', user.uid)),
              new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
            ])
            if (profileSnap && profileSnap.exists && profileSnap.exists()) {
              userProfile = profileSnap.data()
            }
          } catch (e) {
            // ignore and fall back
          }
        }

        // 2) Legacy Realtime DB (users/{uid})
        try {
          // Guard against RTDB hangs (misconfigured databaseURL, permissions, regional routing, etc.)
          if (!userProfile) {
            userProfile = await Promise.race([
              readEntityFromRealtimeDB('users', user.uid),
              new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
            ])
          }
        } catch (e) {
          // ignore
        }
        // Fallback to localStorage if not found in DB (legacy)
        if (!userProfile) {
          try {
            const usersRaw = localStorage.getItem('pos-users-db')
            if (usersRaw) {
              const users = JSON.parse(usersRaw)
              userProfile = users.find(u => u.email.toLowerCase() === sanitizedEmail)
            }
          } catch (e) {
            // ignore
          }
        }

        // If user authenticated with Firebase but has no profile, block login.
        // This prevents "self-registered cashier" accounts that admins cannot monitor/isolate.
        if (!userProfile) {
          return {
            success: false,
            error:
              'This account is not provisioned for POS access yet. Ask your administrator to create/assign your account and branch.',
          }
        }

        return {
          success: true,
          user: {
            // Use Firebase UID as the canonical id for cloud-backed accounts
            id: userProfile?.uid || user.uid,
            email: user.email,
            role: userProfile?.role,
            name: userProfile?.name || user.displayName || '',
            createdBy: userProfile?.createdBy || null,
            branchId: userProfile?.branchId || null,
            adminId: userProfile?.adminId || null
          },
          firebaseAuth: true
        }
      } catch (firebaseError) {
        // Firebase Auth failed, try offline fallback
        console.log('Firebase Auth failed, trying offline authentication', firebaseError?.code || firebaseError)

        // Give a clearer message for the most common misconfiguration:
        // Email/Password provider disabled or API key restrictions.
        if (firebaseError?.code === 'auth/operation-not-allowed') {
          return {
            success: false,
            error: 'Firebase email/password sign-in is disabled. Enable "Email/Password" in Firebase Auth providers.',
          }
        }
        if (firebaseError?.code === 'auth/api-key-not-valid' || firebaseError?.code === 'auth/invalid-api-key') {
          return {
            success: false,
            error: 'Firebase API key is being rejected. Check API key restrictions and that this key matches the project.',
          }
        }
      }
    }
    
    // Offline authentication using localStorage
    const users = await getUsersFromStorage()
    const user = users.find(u => u.email === sanitizedEmail)
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' }
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash)
    
    if (!isValidPassword) {
      return { success: false, error: 'Invalid email or password' }
    }
    
    // Check if user is active
    if (!user.isActive) {
      return { success: false, error: 'Account is disabled' }
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        createdBy: user.createdBy,
        branchId: user.branchId || null
      },
      firebaseAuth: false
    }
  } catch (error) {
    console.error('Error authenticating user:', error)
    return { success: false, error: 'Authentication failed. Please try again.' }
  }
}

/**
 * Register new user
 * @param {string} name - User's full name
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} role - User's role (admin, manager, cashier)
 * @param {number} createdBy - ID of the admin who created this user (optional, for user hierarchy)
 */
export const registerUser = async (name, email, password, role, createdBy = null, branchId = null) => {
  try {
    // Sanitize and validate inputs
    const sanitizedName = name?.trim()
    const sanitizedEmail = email?.trim().toLowerCase()
    const sanitizedRole = role?.toLowerCase()

    if (!sanitizedName || !sanitizedEmail || !password || !sanitizedRole) {
      return { success: false, error: 'All fields are required' }
    }

    if (!validateEmail(sanitizedEmail)) {
      return { success: false, error: 'Please enter a valid email address' }
    }

    // Validate password strength
    const passwordErrors = validatePasswordStrength(password)
    if (passwordErrors.length > 0) {
      return { success: false, error: passwordErrors[0] }
    }

    // Validate role (case-insensitive)
    if (!['admin', 'cashier', 'manager'].includes(sanitizedRole)) {
      return { success: false, error: 'Invalid role' }
    }

    // Security: Prevent cashier/manager self-registration
    // Cashier and manager accounts can only be created by admins
    // Admin accounts can self-register (no createdBy means self-registration)
    const users = await getUsersFromStorage()
    if ((sanitizedRole === 'cashier' || sanitizedRole === 'manager') && !createdBy) {
      return { success: false, error: 'Cashier and manager accounts can only be created by administrators' }
    }

    // Check if user already exists
    if (users.find(u => u.email === sanitizedEmail)) {
      return { success: false, error: 'User with this email already exists' }
    }

    // Create user in Firebase Auth (only if Firebase is configured)
    let authUser = null
    const firebaseConfigured = isFirebaseConfigured()
    
    if (firebaseConfigured && auth) {
      try {
        authUser = await createUserWithEmailAndPassword(auth, sanitizedEmail, password)
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          return { success: false, error: 'User with this email already exists in Firebase Auth' }
        }
        console.warn('Firebase Auth failed, falling back to offline mode:', authError)
        // Continue with offline mode instead of failing
      }
    } else {
      console.log('Firebase not configured, creating user in offline mode')
    }

    // Optionally, add user to local storage for offline reference (not for login)
    const passwordHash = await hashPassword(password)
    const newUserId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1
    const firebaseUid = authUser?.user?.uid || null
    const newUser = {
      id: newUserId,
      firebaseUid,
      email: sanitizedEmail,
      passwordHash,
      role: sanitizedRole,
      name: sanitizedName,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: createdBy,
      branchId: branchId || null
    }
    
    // Save user to storage (don't block registration if this fails, but also don't add to in-memory array)
    try {
      users.push(newUser)
      await saveUsersToStorage(users)
    } catch (storageError) {
      // Remove from in-memory array since save failed to prevent inconsistent state
      users.pop()
      console.warn('Error saving user to local storage (user will exist in Firebase Auth only):', storageError)
      // Don't fail the registration if storage write fails - user can still use Firebase Auth
    }

    // Write user profile to Firestore (preferred) so admin can monitor in real-time.
    // Also keep legacy RTDB write for backward compatibility.
    if (firebaseConfigured && firebaseUid && db) {
      try {
        // Determine the org/adminId for cloud storage
        const adminIdForCloud = sanitizedRole === 'admin' ? firebaseUid : createdBy
        const profile = {
          uid: firebaseUid,
          adminId: adminIdForCloud,
          email: sanitizedEmail,
          role: sanitizedRole,
          name: sanitizedName,
          isActive: true,
          createdBy: createdBy,
          branchId: branchId || null,
          createdAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        }

        // Global profile/mapping (lets the user locate their org/adminId)
        await setDoc(doc(db, 'userProfiles', firebaseUid), profile, { merge: true })

        // Org-scoped users collection (used by admin dashboard realtime listeners)
        if (adminIdForCloud) {
          await setDoc(doc(db, 'organizations', adminIdForCloud, 'users', firebaseUid), profile, { merge: true })
        }
      } catch (firestoreError) {
        console.warn('Error writing user profile to Firestore (continuing):', firestoreError)
      }
    }

    // Legacy: write to Firebase Realtime Database if configured
    if (firebaseConfigured) {
      try {
        await writeUserToRealtimeDB(newUser)
      } catch (dbError) {
        console.warn('Error writing user to Realtime DB (continuing in offline mode):', dbError)
      }
    }

    return {
      success: true,
      user: {
        id: newUserId,
        email: sanitizedEmail,
        role: sanitizedRole,
        name: sanitizedName,
        createdBy: createdBy,
        branchId: branchId || null
      },
      firebaseAuth: !!authUser
    }
  } catch (error) {
    console.error('Error registering user:', error)
    return { success: false, error: 'Registration failed. Please try again.' }
  }
}

/**
 * Get user by email
 */
export const getUserByEmail = async (email) => {
  const users = await getUsersFromStorage()
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  
  if (!user) return null
  
  // Return without password hash
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt,
    createdBy: user.createdBy
  }
}

/**
 * Get the admin ID for data storage
 * - For admins: returns their own ID
 * - For managers/cashiers: returns their creator's ID (the admin who created them)
 * - For self-registered users (createdBy: null): returns their own ID
 * @param {object} user - The user object with id, role, and createdBy fields
 * @returns {number} The admin ID to use for data storage
 */
export const getAdminIdForStorage = (user) => {
  if (!user || !user.id) {
    console.warn('getAdminIdForStorage: No valid user provided')
    return null
  }
  
  // If user is an admin, use their own ID
  if (user.role === 'admin') {
    console.log(`🔑 getAdminIdForStorage: Admin "${user.name}" using own ID: ${user.id}`)
    return user.id
  }
  
  // For managers/cashiers, use their creator's ID (if they were created by an admin)
  // If createdBy is null (self-registered), use their own ID for backwards compatibility
  const adminId = user.createdBy || user.id
  console.log(`🔑 getAdminIdForStorage: ${user.role} "${user.name}" (ID: ${user.id}) using adminId: ${adminId}${user.createdBy ? ' (from creator)' : ' (self-registered)'}`)
  return adminId
}

/**
 * Get all users (admin only)
 * @param {number} adminId - Optional admin ID to filter users created by this admin
 * @returns {Promise<Array>} List of users (filtered if adminId provided)
 */
export const getAllUsers = async (adminId = null) => {
  const users = await getUsersFromStorage()
  
  // If adminId is provided, filter to show only users created by this admin
  // and the admin themselves
  let filteredUsers = users
  if (adminId !== null) {
    filteredUsers = users.filter(user => 
      user.id === adminId || // Include the admin themselves
      user.createdBy === adminId // Include only users created by this admin
    )
  }
  
  return filteredUsers.map(user => ({
    id: user.id,
    firebaseUid: user.firebaseUid || null,
    email: user.email,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt,
    createdBy: user.createdBy,
    branchId: user.branchId // CRITICAL: Include branch assignment
  }))
}

/**
 * Update user password
 * If oldPassword is empty string, skip verification (admin override)
 */
export const updateUserPassword = async (email, oldPassword, newPassword) => {
  try {
    const users = await getUsersFromStorage()
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase())
    
    if (userIndex === -1) {
      return { success: false, error: 'User not found' }
    }
    
    // Verify old password only if provided (allows admin to reset without old password)
    if (oldPassword) {
      const isOldPasswordValid = await verifyPassword(oldPassword, users[userIndex].passwordHash)
      if (!isOldPasswordValid) {
        return { success: false, error: 'Current password is incorrect' }
      }
    }
    
    // Validate new password
    const passwordErrors = validatePasswordStrength(newPassword)
    if (passwordErrors.length > 0) {
      return { success: false, error: passwordErrors[0] }
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)
    users[userIndex].passwordHash = newPasswordHash
    users[userIndex].updatedAt = new Date().toISOString()
    
    await saveUsersToStorage(users)

    // IMPORTANT (plain English):
    // - We can update the offline/local password hash here (used for offline login on THIS device).
    // - We CANNOT securely reset another user's Firebase Auth password from a browser-only app.
    //   That requires a trusted backend (Firebase Admin SDK / Cloud Function) or the Firebase Console.
    //
    // Still, we *do* write a "passwordUpdatedAt" marker to Firestore so admins can audit changes.
    // If you truly want the hashed password stored in Firebase too, we store ONLY the bcrypt hash
    // (never the plain password).
    try {
      const firebaseConfigured = isFirebaseConfigured()
      const targetFirebaseUid = users[userIndex].firebaseUid
      const currentSessionUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const adminIdForCloud = currentSessionUser?.adminId || currentSessionUser?.id || null

      if (firebaseConfigured && db && targetFirebaseUid && adminIdForCloud) {
        const patch = {
          passwordUpdatedAt: serverTimestamp(),
          // Store hash (not plain password) so the "main DB" reflects the change.
          // NOTE: This is still sensitive data—protect with strict Firestore rules.
          passwordHash: newPasswordHash,
        }
        await setDoc(doc(db, 'userProfiles', targetFirebaseUid), patch, { merge: true })
        await setDoc(doc(db, 'organizations', adminIdForCloud, 'users', targetFirebaseUid), patch, { merge: true })
      }
    } catch (firestoreError) {
      console.warn('Password updated locally but failed to update Firestore profile:', firestoreError)
    }
    
    return { success: true, message: 'Password updated successfully' }
  } catch (error) {
    console.error('Error updating password:', error)
    return { success: false, error: 'Failed to update password' }
  }
}

/**
 * Admin resets any user's password (admin only)
 */
export const adminResetPassword = async (targetEmail, newPassword, adminEmail) => {
  try {
    const users = await getUsersFromStorage()
    const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase())
    
    if (!admin || admin.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }
    
    return await updateUserPassword(targetEmail, '', newPassword)
  } catch (error) {
    console.error('Error resetting password:', error)
    return { success: false, error: 'Failed to reset password' }
  }
}

/**
 * Update user branch assignment (admin only)
 */
export const updateUserBranch = async (userId, branchId, adminEmail) => {
  try {
    console.log('🔧 updateUserBranch called with:', { userId, branchId, adminEmail })
    
    const users = await getUsersFromStorage()
    console.log('👥 Loaded users:', users.length)
    
    const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase())
    console.log('🔐 Admin check:', admin ? `Found: ${admin.email}` : 'Not found')
    
    if (!admin || admin.role !== 'admin') {
      console.error('❌ Unauthorized - not admin')
      return { success: false, error: 'Unauthorized' }
    }
    
    const userIndex = users.findIndex(u => u.id === userId)
    console.log('🔍 User index:', userIndex, 'User ID to update:', userId)
    
    if (userIndex === -1) {
      console.error('❌ User not found with ID:', userId)
      return { success: false, error: 'User not found' }
    }
    
    console.log('📝 Updating user:', users[userIndex].name, 'with branchId:', branchId)
    
    // Update the branch assignment (local/offline)
    users[userIndex].branchId = branchId
    users[userIndex].updatedAt = new Date().toISOString()
    
    const saved = await saveUsersToStorage(users)
    console.log('💾 Save result:', saved)

    // Also update Firestore profile if this user has a Firebase UID (real-time admin monitoring)
    try {
      const firebaseConfigured = isFirebaseConfigured()
      const currentSessionUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const adminIdForCloud = currentSessionUser?.adminId || currentSessionUser?.id || null
      const targetFirebaseUid = users[userIndex].firebaseUid

      if (firebaseConfigured && db && adminIdForCloud && targetFirebaseUid) {
        const patch = {
          branchId,
          updatedAt: serverTimestamp(),
        }
        await setDoc(doc(db, 'userProfiles', targetFirebaseUid), patch, { merge: true })
        await setDoc(doc(db, 'organizations', adminIdForCloud, 'users', targetFirebaseUid), patch, { merge: true })
      }
    } catch (firestoreError) {
      console.warn('Failed to update user branch in Firestore (local update still applied):', firestoreError)
    }
    
    return { success: true, message: 'Branch assigned successfully', user: users[userIndex] }
  } catch (error) {
    console.error('💥 Error updating user branch:', error)
    return { success: false, error: 'Failed to update branch assignment' }
  }
}

/**
 * Deactivate user account (admin only)
 * This completely removes the user from the system
 */
export const deactivateUser = async (userId, adminEmail) => {
  try {
    const users = await getUsersFromStorage()
    const admin = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase())
    
    if (!admin || admin.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }
    
    const userIndex = users.findIndex(u => u.id === userId)
    
    if (userIndex === -1) {
      return { success: false, error: 'User not found' }
    }
    
    if (users[userIndex].email.toLowerCase() === adminEmail.toLowerCase()) {
      return { success: false, error: 'Cannot delete your own account' }
    }
    
    // Completely remove the user from the array instead of just marking as inactive
    users.splice(userIndex, 1)
    await saveUsersToStorage(users)
    
    return { success: true, message: 'User deleted successfully' }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}
