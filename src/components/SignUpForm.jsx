"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { validateEmail, validatePasswordStrength, PASSWORD_RULES } from "../utils/auth"

export default function SignUpForm({ onSignUp, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "cashier"
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      const { [field]: _, ...rest } = errors
      setErrors(rest)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters"
    }
    
    // Validate email
    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    
    // Validate password
    if (!formData.password) {
      newErrors.password = "Password is required"
    } else {
      const passwordErrors = validatePasswordStrength(formData.password)
      if (passwordErrors.length > 0) {
        newErrors.password = passwordErrors[0]
      }
    }
    
    // Validate confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }
    
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      const result = await onSignUp(
        formData.email,
        formData.password,
        formData.role,
        formData.name
      )
      
      if (!result.success) {
        setErrors({ submit: result.error })
      }
    } catch (error) {
      setErrors({ submit: "Registration failed. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.submit && (
        <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
          <p className="text-sm text-destructive">{errors.submit}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={`w-full px-4 py-2 border ${errors.name ? 'border-destructive' : 'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground`}
          placeholder="John Doe"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-destructive mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`w-full px-4 py-2 border ${errors.email ? 'border-destructive' : 'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground`}
          placeholder="user@example.com"
          disabled={isSubmitting}
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
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            className={`w-full px-4 py-2 pr-12 border ${errors.password ? 'border-destructive' : 'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground`}
            placeholder="••••••••"
            disabled={isSubmitting}
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
        <p className="text-xs text-muted-foreground mt-2">
          Must be at least {PASSWORD_RULES.minLength} characters with uppercase, lowercase, number, and special character
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            className={`w-full px-4 py-2 pr-12 border ${errors.confirmPassword ? 'border-destructive' : 'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground`}
            placeholder="••••••••"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isSubmitting}
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-3">Account Type</label>
        <div className="space-y-2">
          {[
            { id: "admin", label: "Admin", desc: "Full system access" },
            { id: "cashier", label: "Cashier", desc: "POS operations" },
          ].map((role) => (
            <label
              key={role.id}
              className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                formData.role === role.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !isSubmitting && handleChange('role', role.id)}
            >
              <input
                type="radio"
                name="role"
                value={role.id}
                checked={formData.role === role.id}
                onChange={() => handleChange('role', role.id)}
                className="w-4 h-4 text-primary"
                disabled={isSubmitting}
              />
              <div className="ml-3">
                <p className="font-medium text-foreground">{role.label}</p>
                <p className="text-sm text-muted-foreground">{role.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Creating Account..." : "Create Account"}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={onSwitchToLogin}
          disabled={isSubmitting}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          Already have an account? Sign in
        </button>
      </div>
    </form>
  )
}
