export default function DashboardCard({ title, value, icon, variant = "default", subtitle, onClick }) {
  // Consistent color variants that work in both light and dark modes
  const variantClasses = {
    default: 'bg-card border-border',
    primary: 'bg-primary/10 dark:bg-primary/20 border-primary/50',
    success: 'bg-success/10 dark:bg-success/20 border-success/50',
    warning: 'bg-warning/10 dark:bg-warning/20 border-warning/50',
    destructive: 'bg-destructive/10 dark:bg-destructive/20 border-destructive/50',
    secondary: 'bg-secondary/10 dark:bg-secondary/20 border-secondary/50',
    accent: 'bg-accent/10 dark:bg-accent/20 border-accent/50',
  }
  
  // Enhanced base classes with consistent styling
  const shadowClasses = 'shadow-lg hover:shadow-xl dark:shadow-2xl'
  const borderClasses = 'border-2'
  const baseClasses = `${variantClasses[variant]} rounded-xl p-4 sm:p-6 hover:scale-[1.02] transition-all duration-300 touch-manipulation backdrop-blur-sm ${shadowClasses} ${borderClasses}`
  const interactiveClasses = onClick ? 'cursor-pointer active:scale-[0.98]' : ''
  
  // Determine font size based on value length for better responsive display
  const getValueFontSize = (val) => {
    if (!val && val !== 0) return 'text-2xl sm:text-3xl'
    const valStr = String(val)
    const parts = valStr.split(' ')
    const numericPart = parts.length > 1 ? parts.slice(1).join(' ') : valStr // Get the number part after 'KES' or the whole value
    const length = numericPart.length
    
    // Adjust font size based on number length
    if (length > 10) return 'text-xl sm:text-2xl' // Very large numbers (100,000+)
    if (length > 7) return 'text-2xl sm:text-3xl' // Large numbers (10,000+)
    return 'text-3xl sm:text-4xl' // Normal numbers
  }
  
  return (
    <div 
      className={`${baseClasses} ${interactiveClasses}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <h3 className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</h3>
        <span className="text-3xl sm:text-4xl opacity-90 hover:opacity-100 transition-all duration-200 hover:scale-110">{icon}</span>
      </div>
      <div className="mb-2 min-h-[3.5rem] sm:min-h-[4rem]">
        {(() => {
          if (!value && value !== 0) return null
          const valueStr = String(value)
          const parts = valueStr.split(' ')
          if (parts.length >= 2) {
            const valueFontSize = getValueFontSize(valueStr)
            return (
              <>
                <p className="text-xs sm:text-sm text-muted-foreground/80 mb-1 font-medium">{parts[0]}</p>
                <p className={`${valueFontSize} font-black text-foreground break-words leading-tight tracking-tight`}>
                  {parts.slice(1).join(' ')}
                </p>
              </>
            )
          } else {
            const valueFontSize = getValueFontSize(valueStr)
            return <p className={`${valueFontSize} font-black text-foreground break-words leading-tight tracking-tight`}>{valueStr}</p>
          }
        })()}
      </div>
      {subtitle && (
        <p className="text-xs sm:text-sm text-muted-foreground mt-2 flex items-center gap-2 font-medium">
          <span className="inline-block w-2 h-2 bg-primary/60 rounded-full animate-pulse"></span>
          {subtitle}
        </p>
      )}
    </div>
  )
}
