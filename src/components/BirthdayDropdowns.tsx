import { dayOptions, monthOptions, type BirthdayParts } from '../lib/birthday'
import { Select } from './ui/Select'

interface BirthdayDropdownsProps {
  value: BirthdayParts
  onChange: (parts: BirthdayParts) => void
  // 'dark' for the kiosk, 'light' for the admin.
  variant?: 'dark' | 'light'
}

// Two dropdowns (Day / Month) for entering a birthday — day + month only, no
// year. All-or-nothing: partsToDateString returns null unless both are set.
// Uses the styled Select so the open menu matches the theme (dark on the kiosk).
export function BirthdayDropdowns({ value, onChange, variant = 'dark' }: BirthdayDropdownsProps) {
  const num = (s: string): number | null => (s === '' ? null : Number(s))

  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        variant={variant}
        placeholder="Day"
        aria-label="Birthday day"
        value={value.day == null ? '' : String(value.day)}
        onChange={(s) => onChange({ ...value, day: num(s) })}
        options={dayOptions().map((d) => ({ value: String(d), label: String(d) }))}
      />
      <Select
        variant={variant}
        placeholder="Month"
        aria-label="Birthday month"
        value={value.month == null ? '' : String(value.month)}
        onChange={(s) => onChange({ ...value, month: num(s) })}
        options={monthOptions().map((m) => ({ value: String(m.value), label: m.label }))}
      />
    </div>
  )
}
