"use client"

import { useState } from "react"
import { X, UserPlus, Eye, EyeOff, CheckCircle } from "lucide-react"
import { registerUser, authenticateUser, validateEmail, validatePasswordStrength } from "../utils/auth"

export default function SignUpModal({ onClose, onSignUpSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "admin" // Only admin role for self-registration
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [autoLoginError, setAutoLoginError] = useState("")

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError("") // Clear error on input change
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Validation
    if (!formData.name.trim()) {
      setError("Name is required")
      setLoading(false)
      return
    }

    if (!formData.email || !validateEmail(formData.email)) {
      setError("Please enter a valid email address")
      setLoading(false)
      return
    }

    // Use the same password rules as the rest of the system (plain English):
    // - This avoids a frustrating situation where the UI says "ok" but backend rejects it.
    const pwErrors = validatePasswordStrength(formData.password)
    if (pwErrors.length > 0) {
      setError(pwErrors[0])
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    try {
      // Register new user
      const result = await registerUser(
        formData.name,
        formData.email,
        formData.password,
        formData.role
      )

      if (result.success) {
        // Auto-login after successful registration
        const loginResult = await authenticateUser(formData.email, formData.password)
        if (loginResult.success) {
          setSuccess(true)
          // Notify parent to redirect to dashboard with user info
          if (onSignUpSuccess) {
            onSignUpSuccess(loginResult.user.role, loginResult.user)
          }
          setTimeout(() => {
            onClose && onClose()
          }, 1200) // Give user a moment to see success
        } else {
          setSuccess(true)
          setAutoLoginError("Account created, but auto-login failed. Please sign in manually.")
        }
      } else {
        setError(result.error || "Failed to create account. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
        <div className="bg-card rounded-xl shadow-2xl max-w-md w-full border border-border p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Account Created!</h3>
            <p className="text-muted-foreground">
              Your account has been successfully created. Logging you in...
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Your Account Details:
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Name:</strong> {formData.name}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Email:</strong> {formData.email}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Role:</strong> {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}
              </p>
            </div>
            {autoLoginError && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-lg p-3">
                <p className="text-sm text-red-900 dark:text-red-100">{autoLoginError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col border border-border my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Create Account</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Create a new account to access the POS system. Your account will be active immediately.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-lg p-3">
              <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
              placeholder="John Doe"
              required
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email Address *
            </label>
            <input
              type="text"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
              placeholder="john@example.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          {/* Role Selection - Hidden, always admin for self-registration */}
          <div className="bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/50 rounded-lg p-4">
            <p className="text-sm text-purple-900 dark:text-purple-100">
              <strong>Creating Administrator Account</strong><br />
              You'll be able to create cashier and manager accounts after logging in.
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className="w-full px-4 py-2 pr-12 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                placeholder="At least 6 characters"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                className="w-full px-4 py-2 pr-12 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                placeholder="Re-enter password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onClose}
              className="text-primary hover:underline font-medium"
            >
              Sign in instead
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
