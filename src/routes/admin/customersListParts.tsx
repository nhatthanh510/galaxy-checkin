import type { ReactNode } from 'react'

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
