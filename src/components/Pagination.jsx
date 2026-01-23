"use client"

export default function Pagination({ 
  currentPage, 
  totalItems, 
  itemsPerPage, 
  onPageChange, 
  onItemsPerPageChange 
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 7
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  if (totalItems === 0) {
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 bg-card border-t border-border">
      {/* Items per page selector */}
      <div className="flex items-center gap-2 text-sm">
        <label className="text-muted-foreground font-medium">Show:</label>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="px-3 py-1.5 border border-border rounded-lg bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <span className="text-muted-foreground">per page</span>
      </div>

      {/* Page info */}
      <div className="text-sm text-muted-foreground font-medium">
        Showing <span className="text-foreground font-semibold">{startItem}</span> to{' '}
        <span className="text-foreground font-semibold">{endItem}</span> of{' '}
        <span className="text-foreground font-semibold">{totalItems.toLocaleString()}</span> items
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          title="First page"
        >
          ⏮️
        </button>

        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          title="Previous page"
        >
          ◀️
        </button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((page, idx) => (
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`min-w-[2.5rem] px-3 py-1.5 rounded-lg border transition-all font-semibold text-sm ${
                  currentPage === page
                    ? 'bg-primary text-primary-foreground border-primary shadow-md scale-110'
                    : 'border-border hover:bg-accent hover:scale-105'
                }`}
              >
                {page}
              </button>
            )
          ))}
        </div>

        {/* Mobile: Current page indicator */}
        <div className="sm:hidden px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm">
          {currentPage} / {totalPages}
        </div>

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          title="Next page"
        >
          ▶️
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          title="Last page"
        >
          ⏭️
        </button>
      </div>
    </div>
  )
}
