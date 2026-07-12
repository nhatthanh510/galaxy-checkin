import type { ReactNode } from 'react'
import { dayOptions, monthOptions, type BirthdayParts } from '../lib/birthday'

interface BirthdayDropdownsProps {
  value: BirthdayParts
  onChange: (parts: BirthdayParts) => void
  // 'dark' for the kiosk, 'light' for the admin.
  variant?: 'dark' | 'light'
}

// A native <select> whose CLOSED control is styled to match the themed <Select>
// button (same border, radius, padding, colours, chevron). The chevron is a real
// SVG overlay (not a CSS bg — robust across Tailwind's JIT). The OPEN option list
// is the native browser/OS dropdown; its option background is themed where the
// browser honours it (hover/selected colours are browser-controlled).
function NativeSelect({
  dark,
  ariaLabel,
  value,
  onChange,
  children,
}: {
  dark: boolean
  ariaLabel: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  // NOTE: no `[color-scheme:dark]` here — combined with appearance-none it makes
  // iOS Safari repaint (flash) when the native picker opens.
  const selectClass = dark
    ? 'w-full appearance-none rounded-xl bg-black/40 px-4 py-4 pr-12 text-xl text-white outline-none ring-2 ring-transparent focus:ring-brand-500'
    : 'w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 pr-9 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-200'

  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
        // Prevent the iOS tap-highlight flash when the native picker opens.
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {children}
      </select>
      {/* Chevron overlay — mirrors the themed Select's arrow. pointer-events-none
          so clicks fall through to the native select. */}
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
          'pointer-events-none absolute top-1/2 -translate-y-1/2 ' +
          (dark ? 'right-4 text-white/50' : 'right-3 text-slate-400')
        }
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}

// Two dropdowns (Day / Month) for entering a birthday — day + month only, no year.
// All-or-nothing: partsToDateString returns null unless both are set. Native
// <select> on every device so day/month picking uses the familiar browser/OS
// dropdown, with the closed control themed to match the rest of the UI.
export function BirthdayDropdowns({ value, onChange, variant = 'dark' }: BirthdayDropdownsProps) {
  const dark = variant === 'dark'
  const num = (s: string): number | null => (s === '' ? null : Number(s))
  // NOTE: <option>s are intentionally NOT styled. iOS Safari can't theme native
  // option rows and repaints (flashes) when reconciling custom option colours as
  // the picker opens — the native picker renders its own list regardless.

  return (
    <div className="grid grid-cols-2 gap-3">
      <NativeSelect
        dark={dark}
        ariaLabel="Birthday day"
        value={value.day == null ? '' : String(value.day)}
        onChange={(s) => onChange({ ...value, day: num(s) })}
      >
        <option value="">Day</option>
        {dayOptions().map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        dark={dark}
        ariaLabel="Birthday month"
        value={value.month == null ? '' : String(value.month)}
        onChange={(s) => onChange({ ...value, month: num(s) })}
      >
        <option value="">Month</option>
        {monthOptions().map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
