import { useMemo, useState } from 'react'

// Client-side pagination helper: slices `items` into pages and tracks the page.
// Clamps to the last page if the current page ends up out of range.
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const pageItems = useMemo(
    () => items.slice(current * pageSize, current * pageSize + pageSize),
    [items, current, pageSize],
  )
  return {
    page: current,
    pageCount,
    pageItems,
    setPage,
    canPrev: current > 0,
    canNext: current < pageCount - 1,
    total: items.length,
  }
}
