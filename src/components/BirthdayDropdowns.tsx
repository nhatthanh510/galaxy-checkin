import { dayOptions, monthOptions, type BirthdayParts } from '../lib/birthday'

interface BirthdayDropdownsProps {
  value: BirthdayParts
  onChange: (parts: BirthdayParts) => void
  // 'dark' for the kiosk, 'light' for the admin.
  variant?: 'dark' | 'light'
}

// Two dropdowns (Day / Month) for entering a birthday — day + month only, no
// year. All-or-nothing: partsToDateString returns null unless both are set.
export function BirthdayDropdowns({
  value,
  onChange,
  variant = 'dark',
}: BirthdayDropdownsProps) {
  const selectClass =
    variant === 'dark'
      ? 'rounded-xl bg-black/40 px-4 py-4 text-xl text-white outline-none ring-2 ring-transparent focus:ring-brand-500'
      : 'rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'

  const num = (s: string): number | null => (s === '' ? null : Number(s))

  return (
    <div className="grid grid-cols-2 gap-3">
      <select
        value={value.day ?? ''}
        onChange={(e) => onChange({ ...value, day: num(e.target.value) })}
        className={selectClass}
      >
        <option value="">Day</option>
        {dayOptions().map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        value={value.month ?? ''}
        onChange={(e) => onChange({ ...value, month: num(e.target.value) })}
        className={selectClass}
      >
        <option value="">Month</option>
        {monthOptions().map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}
