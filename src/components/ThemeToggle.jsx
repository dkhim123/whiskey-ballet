"use client"

import { useTheme } from "./ThemeProvider"
import SunIcon from "./icons/SunIcon"
import MoonIcon from "./icons/MoonIcon"

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`p-2.5 rounded-lg transition-all hover:bg-sidebar-primary/20 ${className}`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <SunIcon className="w-5 h-5 text-yellow-400" />
      ) : (
        <MoonIcon className="w-5 h-5 text-sidebar-foreground/70" />
      )}
    </button>
  )
}
