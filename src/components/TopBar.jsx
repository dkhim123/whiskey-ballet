import OnlineStatus from "./OnlineStatus"

export default function TopBar({ title, subtitle, actions }) {
  return (
    <div className="bg-gradient-to-r from-[#F5F1E8] via-[#F5F5DC] to-[#F5F1E8] dark:from-[#1a0f0a] dark:via-[#2C1810] dark:to-[#1a0f0a] border-b-2 border-[#D4AF37]/30 shadow-md backdrop-blur-sm">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#6B0F1A] to-[#8B1E2A] bg-clip-text text-transparent dark:from-[#D4AF37] dark:to-[#F4D03F] tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[#6B0F1A] dark:text-[#D4AF37] mt-1 text-sm sm:text-base font-medium flex items-center gap-2 truncate">
              <span className="inline-block w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse shadow-lg"></span>
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
