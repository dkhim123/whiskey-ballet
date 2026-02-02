import OnlineStatus from "./OnlineStatus"

export default function TopBar({ title, subtitle, actions }) {
  return (
    <div className="bg-gradient-to-r from-[#F5F1E8] via-[#F5F5DC] to-[#F5F1E8] dark:from-[#1a0f0a] dark:via-[#24130d] dark:to-[#1a0f0a] border-b border-[#D4AF37]/20 shadow-sm backdrop-blur-sm">
      {/* On small screens we add extra left padding so the fixed hamburger button doesn't overlap the title */}
      <div className="py-5 pr-6 pl-20 sm:pl-24 lg:px-8 flex items-center justify-between gap-6 min-h-[84px]">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-4xl font-semibold tracking-tight truncate text-[#2C1810] dark:text-[#F5F5DC] leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm sm:text-[15px] font-medium flex items-center gap-2 truncate text-[#6B0F1A]/65 dark:text-[#F5F5DC]/55">
              <span className="inline-block w-2 h-2 bg-[#D4AF37]/55 rounded-full shadow-sm"></span>
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
