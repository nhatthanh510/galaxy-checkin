import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Small presentational pieces for CustomersList, split out so the parent file
// stays focused on the stateful filter/table logic.

// Trash/delete glyph for the per-row delete action.
export function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

// A customer note with an expand/collapse affordance. The note is small + italic
// and clamped to two lines by default. A chevron toggle appears ONLY when the
// text is actually truncated — measured (not guessed) via scrollHeight vs.
// clientHeight, so a note that already fits shows no chevron. `prefix` prepends
// an icon (e.g. "📝 ") in the stacked mobile view.
export function NoteCell({
  notes,
  expanded,
  onToggle,
  prefix = '',
  className = '',
}: {
  notes: string
  expanded: boolean
  onToggle: () => void
  prefix?: string
  className?: string
}) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)

  // Whether the CLAMPED text overflows (scrollHeight beats the visible
  // clientHeight). Measured via a ResizeObserver so it's correct on the initial
  // layout AND re-checks on reflow (viewport resize, tablet rotate, a column
  // showing/hiding at a breakpoint) — a one-shot measure misses those and left
  // the chevron hidden on mobile. Only meaningful while collapsed; the button
  // stays visible when expanded via `|| expanded` below.
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || expanded) return
    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [notes, expanded])

  return (
    <div className={`text-xs italic ${className}`}>
      {/* `line-clamp-2` sets display:-webkit-box; do NOT add `block` — it would
          override that display and defeat the clamp. */}
      <span ref={textRef} className={expanded ? 'block' : 'line-clamp-2'}>
        {prefix}
        {notes}
      </span>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Show less' : 'Show full note'}
          className="mt-1 inline-flex items-center gap-0.5 not-italic text-brand-600 hover:text-brand-700"
        >
          <span>{expanded ? 'Less' : 'More'}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={'transition-transform ' + (expanded ? 'rotate-180' : '')}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  )
}

// One segment of the "Checked in" date filter. `bordered` draws the left
// divider between adjacent chips in the segmented group.
export function DateChip({
  active,
  onClick,
  bordered = false,
  children,
}: {
  active: boolean
  onClick: () => void
  bordered?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'px-3 py-1.5 text-sm font-medium transition-colors ' +
        (bordered ? 'border-l border-slate-300 ' : '') +
        (active ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50')
      }
    >
      {children}
    </button>
  )
}
