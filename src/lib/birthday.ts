// Birthday helpers — day/month/year dropdowns and "birthday soon" detection.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

// Parts as used by the three dropdowns. Any part empty => no birthday.
export interface BirthdayParts {
  day: number | null // 1-31
  month: number | null // 1-12
  year: number | null
}

export const emptyBirthday: BirthdayParts = { day: null, month: null, year: null }

// Dropdown option ranges.
export function dayOptions(): number[] {
  return Array.from({ length: 31 }, (_, i) => i + 1)
}
export function monthOptions(): { value: number; label: string }[] {
  return MONTHS.map((label, i) => ({ value: i + 1, label }))
}
// Reasonable adult range: current year back ~100 years. Pass the current year in
// (Date.now is fine in app runtime).
export function yearOptions(currentYear: number): number[] {
  return Array.from({ length: 100 }, (_, i) => currentYear - i)
}

// Convert parts -> "YYYY-MM-DD" for the DB `date` column, or null if incomplete.
export function partsToDateString(p: BirthdayParts): string | null {
  if (p.day == null || p.month == null || p.year == null) return null
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  return `${p.year}-${mm}-${dd}`
}

// Convert a stored "YYYY-MM-DD" (or null) -> parts for the dropdowns.
export function dateStringToParts(s: string | null): BirthdayParts {
  if (!s) return emptyBirthday
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return emptyBirthday
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

// Day-of-year (1-366) for a given month/day, using a fixed non-leap reference
// so comparisons are stable regardless of the actual year.
function dayOfYear(month: number, day: number): number {
  const cumulative = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  return cumulative[month - 1] + day
}

// Is `birthday` within [daysBefore, daysAfter] of `today` (ignoring year)?
// Handles the wrap across Dec 31 / Jan 1. `birthday` is "YYYY-MM-DD" or null.
export function isBirthdaySoon(
  birthday: string | null,
  today: Date,
  daysBefore: number,
  daysAfter: number,
): boolean {
  if (!birthday) return false
  const parts = dateStringToParts(birthday)
  if (parts.month == null || parts.day == null) return false

  const YEAR = 365
  const todayDoy = dayOfYear(today.getMonth() + 1, today.getDate())
  const bdayDoy = dayOfYear(parts.month, parts.day)

  // Smallest circular distance (in days) between the two dates-of-year.
  let diff = bdayDoy - todayDoy
  if (diff > YEAR / 2) diff -= YEAR
  if (diff < -YEAR / 2) diff += YEAR

  // diff > 0 => birthday is upcoming; diff < 0 => it just passed.
  return diff >= -daysAfter && diff <= daysBefore
}

// Should we show the birthday reminder? True when the birthday is within the
// window AND the discount hasn't already been claimed for the current year.
export function shouldRemindBirthday(
  birthday: string | null,
  redeemedYear: number | null,
  today: Date,
  daysBefore: number,
  daysAfter: number,
): boolean {
  if (!isBirthdaySoon(birthday, today, daysBefore, daysAfter)) return false
  return redeemedYear !== today.getFullYear()
}

// Pretty birthday for display, e.g. "15 March 1990" or "15 March" (no year).
export function formatBirthday(birthday: string | null): string {
  if (!birthday) return '—'
  const p = dateStringToParts(birthday)
  if (p.month == null || p.day == null) return '—'
  const monthName = MONTHS[p.month - 1]
  return p.year ? `${p.day} ${monthName} ${p.year}` : `${p.day} ${monthName}`
}
