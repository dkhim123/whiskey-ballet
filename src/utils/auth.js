/**
 * Authentication utility for secure user management
 * Works in both online and offline modes
 */

import bcrypt from 'bcryptjs'
import { writeUserToRealtimeDB, readEntityFromRealtimeDB } from './firebaseRealtime'
import { auth, isFirebaseConfigured } from '../config/firebase'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'

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
        // Fetch user profile from Firebase Realtime DB (users/{uid})
        const user = userCredential.user
        let userProfile = null
        try {
          userProfile = await readEntityFromRealtimeDB('users', user.uid)
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
        return {
          success: true,
          user: {
            id: userProfile?.id || user.uid,
            email: user.email,
            role: userProfile?.role || 'cashier',
            name: userProfile?.name || user.displayName || '',
            createdBy: userProfile?.createdBy || null,
            branchId: userProfile?.branchId || null
          },
          firebaseAuth: true
        }
      } catch (firebaseError) {
        // Firebase Auth failed, try offline fallback
        console.log('Firebase Auth failed, trying offline authentication')
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
    const newUser = {
      id: newUserId,
      email: sanitizedEmail,
      passwordHash,
      role: sanitizedRole,
      name: sanitizedName,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: createdBy,
      branchId: branchId || null
    }
    users.push(newUser)
    await saveUsersToStorage(users)

    // Also write user to Firebase Realtime Database if configured
    if (firebaseConfigured) {
      try {
        await writeUserToRealtimeDB(newUser)
      } catch (dbError) {
        console.warn('Error writing user to Realtime DB (continuing in offline mode):', dbError)
        // Don't fail the registration if Firebase DB write fails - user is already saved locally
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
    
    await saveUsersToStorage(users)
    
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
    
    // Update the branch assignment
    users[userIndex].branchId = branchId
    users[userIndex].updatedAt = new Date().toISOString()
    
    const saved = await saveUsersToStorage(users)
    console.log('💾 Save result:', saved)
    
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
