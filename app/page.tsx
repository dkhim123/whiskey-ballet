"use client"

import App from "@/src/App"
import AppErrorBoundary from "@/src/components/AppErrorBoundary"

export default function Page() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  )
}
