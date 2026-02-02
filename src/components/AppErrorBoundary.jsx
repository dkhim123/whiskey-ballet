"use client"

import { Component } from "react"

/**
 * Error boundary that shows a clear message and clickable "Show details"
 * to expand the full error and stack trace, plus support for multiple issues.
 * Use this so users can click to see details and more bugs instead of
 * relying only on the Next.js overlay.
 */
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      error: null,
      errorInfo: null,
      detailsOpen: false,
      moreOpen: false,
      errors: [], // Keep last few errors for "more bugs"
    }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState((prev) => {
      const entry = {
        message: error?.message || String(error),
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        name: error?.name,
      }
      const errors = [entry, ...(prev.errors || [])].slice(0, 5)
      return { errorInfo, errors }
    })
  }

  handleShowDetails = () => {
    this.setState((s) => ({ detailsOpen: !s.detailsOpen }))
  }

  handleShowMore = () => {
    this.setState((s) => ({ moreOpen: !s.moreOpen }))
  }

  handleRetry = () => {
    this.setState({
      error: null,
      errorInfo: null,
      detailsOpen: false,
      moreOpen: false,
    })
  }

  handleCopy = () => {
    const { error, errorInfo, errors } = this.state
    const text = [
      error?.message || "",
      error?.stack || "",
      errorInfo?.componentStack || "",
      "--- Other recent errors ---",
      ...errors.map((e, i) => `[${i + 1}] ${e.message}\n${e.stack || ""}\n${e.componentStack || ""}`),
    ].join("\n\n")
    navigator.clipboard?.writeText(text).then(() => {
      if (this.props.onCopy) this.props.onCopy()
    })
  }

  render() {
    const { error, errorInfo, detailsOpen, moreOpen, errors } = this.state
    const { children } = this.props

    if (!error) {
      return children
    }

    const isChunkError =
      error?.message?.includes("ChunkLoadError") ||
      error?.message?.includes("Failed to load chunk") ||
      error?.message?.includes("Loading chunk")

    return (
      <div className="min-h-[280px] flex flex-col bg-background border-2 border-destructive rounded-xl p-6 shadow-lg max-w-2xl mx-auto mt-8">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl" role="img" aria-hidden>
            ⚠️
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground mb-1">Something went wrong</h2>
            <p className="text-muted-foreground text-sm mb-2">{error?.message || String(error)}</p>
            {isChunkError && (
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 mt-2">
                <strong>Chunk load error:</strong> Try a hard refresh (Ctrl+Shift+R), clear the browser cache, or run{" "}
                <code className="bg-muted px-1 rounded">npm run dev</code> again after deleting the{" "}
                <code className="bg-muted px-1 rounded">.next</code> folder.
              </p>
            )}
          </div>
        </div>

        {/* Clickable "Show details" – expands to full stack */}
        <div className="mb-3">
          <button
            type="button"
            onClick={this.handleShowDetails}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium text-sm transition-colors"
            aria-expanded={detailsOpen}
          >
            <span className="select-none">{detailsOpen ? "▼" : "▶"}</span>
            {detailsOpen ? "Hide details" : "Show details"}
          </button>
          {detailsOpen && (
            <div className="mt-2 p-4 rounded-lg bg-muted/50 border border-border overflow-auto max-h-64">
              <div className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
                {error?.stack || "No stack trace"}
              </div>
              {errorInfo?.componentStack && (
                <>
                  <div className="text-xs font-semibold text-muted-foreground mt-3 mb-1">Component stack:</div>
                  <div className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                    {errorInfo.componentStack}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Clickable "Show more bugs" – other recent errors */}
        {errors.length > 1 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={this.handleShowMore}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium text-sm transition-colors"
              aria-expanded={moreOpen}
            >
              <span className="select-none">{moreOpen ? "▼" : "▶"}</span>
              Show more issues ({errors.length} recorded)
            </button>
            {moreOpen && (
              <ul className="mt-2 space-y-2 list-none pl-0">
                {errors.slice(1).map((e, i) => (
                  <li
                    key={i}
                    className="p-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">{e.message}</span>
                    {e.stack && (
                      <pre className="mt-2 text-xs font-mono whitespace-pre-wrap break-words opacity-80">
                        {e.stack}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-border">
          <button
            type="button"
            onClick={this.handleCopy}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90"
          >
            Copy error
          </button>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg bg-muted text-foreground font-medium text-sm hover:bg-muted/80"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}

export default AppErrorBoundary
