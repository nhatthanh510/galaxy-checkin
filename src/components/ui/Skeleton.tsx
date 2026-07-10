// Shimmer placeholders shown while data loads, so screens keep their shape
// instead of flashing a bare "Loading…" line. `animate-pulse` is the shimmer.

// A single grey bar. Width/height/extra styling via className.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
}

// A table-shaped placeholder: a header strip + shimmer rows inside the standard
// card border. Pass `className` to match the real screen's wrapper (e.g. its
// `max-w-*` width and, for full-height lists, `flex h-full min-w-0 flex-col`).
// `fill` makes the card grow to the available height and pad enough rows to
// cover it — for lists whose real table fills the viewport (e.g. Customers).
export function TableSkeleton({
  rows = 8,
  cols = 3,
  className = '',
  fill = false,
}: {
  rows?: number
  cols?: number
  className?: string
  fill?: boolean
}) {
  // Enough rows to look full when stretching to viewport height.
  const rowCount = fill ? Math.max(rows, 16) : rows
  return (
    <div className={className}>
      <div
        className={
          'flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ' +
          (fill ? 'min-h-0 flex-1' : '')
        }
      >
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className={'divide-y divide-slate-100 ' + (fill ? 'min-h-0 flex-1 overflow-hidden' : '')}>
          {Array.from({ length: rowCount }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-4 py-3">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={
                    'h-4 ' + (c === 0 ? 'flex-1' : 'w-20') + (c === cols - 1 ? ' ml-auto' : '')
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// A form/detail-shaped placeholder: a title + a card of stacked field rows.
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="max-w-xl">
      <Skeleton className="h-7 w-40" />
      <div className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}
