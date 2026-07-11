import { useEffect, useRef, useState } from 'react'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

// A styled single-select dropdown — a button + a popover list — replacing the
// native <select> so the open menu matches the app theme across browsers (native
// option lists are OS/browser-styled and can't be themed reliably).
//
// `variant`: 'light' (admin) or 'dark' (kiosk — larger touch targets, dark chrome).
// `placeholder`: shown on the button when the current value has no matching option
// (e.g. an empty "" value used as an unselected state).
export function Select<T extends string>({
  value,
  options,
  onChange,
  className = '',
  variant = 'light',
  placeholder,
  'aria-label': ariaLabel,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  variant?: 'light' | 'dark'
  placeholder?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  const dark = variant === 'dark'

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const buttonClass = dark
    ? 'flex w-full items-center justify-between gap-2 rounded-xl bg-black/40 px-4 py-4 text-xl text-white ring-2 ring-transparent focus:outline-none focus:ring-brand-500'
    : 'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200'

  const listClass = dark
    ? 'scrollbar-slim absolute left-0 z-20 mt-1 max-h-72 min-w-full overflow-auto rounded-xl border border-white/10 bg-[#1a1a24] py-1 shadow-xl'
    : 'absolute left-0 z-20 mt-1 max-h-64 min-w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg'

  const optionClass = (active: boolean) =>
    dark
      ? 'flex w-full items-start gap-2 px-4 py-3 text-left text-lg ' +
        (active ? 'bg-brand-500/30 font-semibold text-white' : 'text-white/80 hover:bg-white/10')
      : 'flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ' +
        (active ? 'font-medium text-brand-700' : 'text-slate-700')

  // Button label: the selected option's label, else the placeholder (muted).
  const showPlaceholder = !selected && placeholder != null

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={buttonClass}
      >
        <span className={'truncate ' + (showPlaceholder ? (dark ? 'text-white/40' : 'text-slate-400') : '')}>
          {selected?.label ?? placeholder ?? ''}
        </span>
        <svg
          width={dark ? 20 : 14}
          height={dark ? 20 : 14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            'shrink-0 transition-transform ' +
            (dark ? 'text-white/50 ' : 'text-slate-400 ') +
            (open ? 'rotate-180' : '')
          }
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul role="listbox" className={listClass}>
          {options.map((o) => {
            const active = o.value === value
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={optionClass(active)}
                >
                  <span className={(dark ? 'w-5' : 'w-4') + ' shrink-0 text-brand-500'}>
                    {active ? '✓' : ''}
                  </span>
                  <span>{o.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
