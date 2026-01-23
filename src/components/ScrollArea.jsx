"use client"

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'

/**
 * Custom ScrollArea component for consistent scrolling across the app
 * Provides a clean, theme-aware scrollbar that works in both light and dark modes
 */
export default function ScrollArea({ children, className = "", orientation = "vertical" }) {
  return (
    <ScrollAreaPrimitive.Root className={`relative ${className}`}>
      <ScrollAreaPrimitive.Viewport className="w-full h-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation={orientation}
        className={`flex touch-none select-none transition-colors p-0.5 ${
          orientation === 'vertical' 
            ? 'h-full w-2.5 border-l border-l-transparent' 
            : 'h-2.5 flex-col border-t border-t-transparent'
        }`}
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border hover:bg-muted-foreground/50 transition-colors" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}
