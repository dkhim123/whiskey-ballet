"use client"

import { useState } from "react"
import { clearLocalDataIfSafe } from "../utils/clearLocalData"
import { Eye, EyeOff } from "lucide-react"
import { authenticateUser, validateEmail } from "../utils/auth"
import SignUpModal from "./SignUpModal"

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [selectedRole, setSelectedRole] = useState("cashier")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)

  const getRoleDisplayName = (role) => {
    if (role === 'admin') return 'Administrator'
    if (role === 'manager') return 'Manager'
    return 'Cashier'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}
    
    // Basic validation
    if (!email) {
      newErrors.email = "Email is required"
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address"
    }
    
    if (!password) {
      newErrors.password = "Password is required"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      // Authenticate user with credentials
      const result = await authenticateUser(email, password)
      
      if (result.success) {
        // Verify the user has the selected role
        if (result.user.role !== selectedRole) {
          newErrors.submit = `This account is registered as ${getRoleDisplayName(result.user.role)}. Please select the correct role.`
          setErrors(newErrors)
          setIsSubmitting(false)
          return
        }

        // Clear local branch data to prevent old data from showing for new accounts
        try {
          await clearLocalDataIfSafe()
        } catch (e) {
          console.warn('Error clearing local branch data:', e);
        }

        // Show role confirmation message
        alert(`✓ Logging in as ${getRoleDisplayName(result.user.role)}`)
        // Pass user data to parent component
        onLogin(result.user.role, result.user)
      } else {
        // Handle authentication errors
        if (result.isLockedOut) {
          newErrors.submit = result.error
        } else if (result.attemptsRemaining !== undefined) {
          newErrors.submit = `${result.error}. ${result.attemptsRemaining} attempts remaining.`
        } else {
          newErrors.submit = result.error
        }
        setErrors(newErrors)
      }
    } catch (error) {
      setErrors({ submit: "Login failed. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.submit && (
          <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-sm text-destructive">{errors.submit}</p>
          </div>
        )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Select Role</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSelectedRole("cashier")}
            disabled={isSubmitting}
            className={`px-3 py-3 rounded-lg border-2 transition-all font-medium text-sm ${
              selectedRole === "cashier"
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-foreground hover:border-primary/50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Cashier
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("manager")}
            disabled={isSubmitting}
            className={`px-3 py-3 rounded-lg border-2 transition-all font-medium text-sm ${
              selectedRole === "manager"
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-foreground hover:border-primary/50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Manager
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("admin")}
            disabled={isSubmitting}
            className={`px-3 py-3 rounded-lg border-2 transition-all font-medium text-sm ${
              selectedRole === "admin"
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-foreground hover:border-primary/50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Admin
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
        <input
          type="text"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (errors.email) {
              const {email, ...rest} = errors
              setErrors(rest)
            }
          }}
          className={`w-full px-4 py-2 border ${errors.email ? 'border-destructive' : 'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground`}
          placeholder="admin@whiskeyballet.ke"
          disabled={isSubmitting}
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-sm text-destructive mt-1">{errors.email}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) {
                const {password, ...rest} = errors
                setErrors(rest)
              }
            }}
            className={`w-full px-4 py-2 pr-12 border ${errors.password ? 'border-destructive' : 'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground`}
            placeholder="••••••••"
            disabled={isSubmitting}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isSubmitting}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive mt-1">{errors.password}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            Signing in...
          </>
        ) : "Sign In"}
      </button>

      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground/70">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => setShowSignUp(true)}
            className="text-primary hover:underline font-medium"
            disabled={isSubmitting}
            aria-disabled={isSubmitting}
          >
            Create admin account
          </button>
        </p>
      </div>
      </form>
      
      {/* Sign Up Modal */}
      {showSignUp && (
        <SignUpModal 
          onClose={() => setShowSignUp(false)}
          onSignUpSuccess={(role, user) => {
            setShowSignUp(false)
            // Immediately log in and redirect
            onLogin(role, user)
          }}
        />
      )}
    </>
  )
}
