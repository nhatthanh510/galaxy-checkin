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

// Signed day distance from today to the birthday (ignoring year), or null if no
// birthday. > 0 => upcoming; 0 => today; < 0 => just passed. Wraps at Dec/Jan.
export function birthdayDayDiff(birthday: string | null, today: Date): number | null {
  if (!birthday) return null
  const parts = dateStringToParts(birthday)
  if (parts.month == null || parts.day == null) return null

  const YEAR = 365
  const todayDoy = dayOfYear(today.getMonth() + 1, today.getDate())
  const bdayDoy = dayOfYear(parts.month, parts.day)
  let diff = bdayDoy - todayDoy
  if (diff > YEAR / 2) diff -= YEAR
  if (diff < -YEAR / 2) diff += YEAR
  return diff
}

// Is `birthday` within [daysBefore, daysAfter] of `today` (ignoring year)?
export function isBirthdaySoon(
  birthday: string | null,
  today: Date,
  daysBefore: number,
  daysAfter: number,
): boolean {
  const diff = birthdayDayDiff(birthday, today)
  if (diff == null) return false
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

export type BirthdayStatus = 'today' | 'upcoming' | 'recent' | 'claimed' | 'none'

// A display-friendly birthday status for the admin:
//   'today'    — it's the actual day (in window, unclaimed)
//   'upcoming' — in window, birthday is still ahead (unclaimed)
//   'recent'   — in window, birthday just passed (unclaimed)
//   'claimed'  — in window but the discount was already used this year
//   'none'     — outside the window / no birthday
export function birthdayStatus(
  birthday: string | null,
  redeemedYear: number | null,
  today: Date,
  daysBefore: number,
  daysAfter: number,
): BirthdayStatus {
  if (!isBirthdaySoon(birthday, today, daysBefore, daysAfter)) return 'none'
  if (redeemedYear === today.getFullYear()) return 'claimed'
  const diff = birthdayDayDiff(birthday, today)
  if (diff === 0) return 'today'
  return diff != null && diff > 0 ? 'upcoming' : 'recent'
}

// Label + tailwind color classes for a birthday status (admin badges).
export function birthdayStatusBadge(
  status: BirthdayStatus,
): { label: string; className: string } | null {
  switch (status) {
    case 'today':
      return { label: '🎂 Birthday today', className: 'bg-pink-100 text-pink-700' }
    case 'upcoming':
      return { label: '🎂 Birthday soon', className: 'bg-pink-100 text-pink-700' }
    case 'recent':
      return { label: '🎂 Recent birthday', className: 'bg-pink-100 text-pink-700' }
    case 'claimed':
      return { label: '✓ Claimed', className: 'bg-slate-100 text-slate-500' }
    default:
      return null
  }
}

// Pretty birthday for display, e.g. "15 March 1990" or "15 March" (no year).
export function formatBirthday(birthday: string | null): string {
  if (!birthday) return '—'
  const p = dateStringToParts(birthday)
  if (p.month == null || p.day == null) return '—'
  const monthName = MONTHS[p.month - 1]
  return p.year ? `${p.day} ${monthName} ${p.year}` : `${p.day} ${monthName}`
}
