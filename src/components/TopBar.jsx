import OnlineStatus from "./OnlineStatus"

export default function TopBar({ title, subtitle, actions }) {
  return (
    <div className="bg-gradient-to-r from-[#F5F1E8] via-[#F5F5DC] to-[#F5F1E8] dark:from-[#1a0f0a] dark:via-[#2C1810] dark:to-[#1a0f0a] border-b-2 border-[#D4AF37]/30 shadow-xl backdrop-blur-sm">
      <div className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[#2C1810] dark:bg-[#1a0f0a] flex items-center justify-center shadow-xl ring-4 ring-[#D4AF37] hover:ring-[#F4D03F] transition-all p-1">
            <img 
              src="/placeholder-logo.svg" 
              alt="Whiskey Ballet" 
              className="h-full w-full object-contain brightness-125 contrast-125"
            />
          </div>
          <div className="h-12 w-1 bg-gradient-to-b from-[#6B0F1A] to-[#D4AF37] rounded-full shadow-lg"></div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#6B0F1A] to-[#8B1E2A] bg-clip-text text-transparent dark:from-[#D4AF37] dark:to-[#F4D03F] tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-[#6B0F1A] dark:text-[#D4AF37] mt-1 text-base font-medium flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse shadow-lg"></span>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-4 items-center">
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
