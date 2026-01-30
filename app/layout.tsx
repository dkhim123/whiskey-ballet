import type React from "react"
import type { Metadata, Viewport } from "next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Whiskey Ballet - Wines & Spirits POS",
  description: "Professional POS and Inventory Management System - Works Offline",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Whiskey Ballet POS",
  },
  icons: {
    icon: [
      {
        url: "./icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "./icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "./icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "./apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

// Force no loading UI during static export
export const dynamic = 'force-static'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        {children}
        <Toaster />
        {/* Analytics removed: Vercel not used */}
      </body>
    </html>
  )
}
