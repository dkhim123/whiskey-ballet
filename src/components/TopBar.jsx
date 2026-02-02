import OnlineStatus from "./OnlineStatus"

export default function TopBar({ title, subtitle, actions }) {
  return (
    <div className="bg-gradient-to-r from-[#F5F1E8] via-[#F5F5DC] to-[#F5F1E8] dark:from-[#1a0f0a] dark:via-[#24130d] dark:to-[#1a0f0a] border-b border-[#D4AF37]/20 shadow-sm backdrop-blur-sm">
      {/* On small screens we add extra left padding so the fixed hamburger button doesn't overlap the title */}
      <div className="py-4 pr-6 pl-20 sm:pl-24 lg:px-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate text-[#2C1810] dark:text-[#F5F5DC]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm sm:text-base font-medium flex items-center gap-2 truncate text-[#6B0F1A]/80 dark:text-[#F5F5DC]/70">
              <span className="inline-block w-2 h-2 bg-[#D4AF37]/70 rounded-full shadow-sm"></span>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex gap-3 items-center shrink-0">
          <OnlineStatus />
          {actions && (
            <div className="flex gap-3 items-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
