interface PaginationProps {
  page: number // 0-based
  pageCount: number
  canPrev: boolean
  canNext: boolean
  onPage: (page: number) => void
}

// Prev / "Page X of Y" / Next control (light admin theme).
export function Pagination({ page, pageCount, canPrev, canNext, onPage }: PaginationProps) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-4 py-3 text-sm">
      <button
        onClick={() => onPage(page - 1)}
        disabled={!canPrev}
        className="rounded-lg border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        ‹ Prev
      </button>
      <span className="text-slate-500">
        Page {page + 1} of {pageCount}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={!canNext}
        className="rounded-lg border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        Next ›
      </button>
    </div>
  )
}
