// Birthday helpers — day/month/year dropdowns and "birthday soon" detection.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

// Parts as used by the three dropdowns. Any part empty => no birthday.
// We only capture day + month (birthdays are used for greetings/perks, not age).
// A sentinel year is stored so the DB `date` column stays valid; the year is
// never shown or used (all comparisons ignore it).
const SENTINEL_YEAR = 2000 // leap year -> Feb 29 is valid

export interface BirthdayParts {
  day: number | null // 1-31
  month: number | null // 1-12
}

export const emptyBirthday: BirthdayParts = { day: null, month: null }

// Dropdown option ranges.
export function dayOptions(): number[] {
  return Array.from({ length: 31 }, (_, i) => i + 1)
}
export function monthOptions(): { value: number; label: string }[] {
  return MONTHS.map((label, i) => ({ value: i + 1, label }))
}

// Convert parts -> "YYYY-MM-DD" (sentinel year) for the DB, or null if incomplete.
export function partsToDateString(p: BirthdayParts): string | null {
  if (p.day == null || p.month == null) return null
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  return `${SENTINEL_YEAR}-${mm}-${dd}`
}

// Convert a stored "YYYY-MM-DD" (or null) -> day/month parts for the dropdowns.
export function dateStringToParts(s: string | null): BirthdayParts {
  if (!s) return emptyBirthday
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return emptyBirthday
  return { month: Number(m[2]), day: Number(m[3]) }
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

// --- Generic date-window trigger -------------------------------------------
// A "date_window" promotion is claimable when today is within [daysBefore,
// daysAfter] of some customer date-anchor (birthday today; anniversary later),
// once per calendar year. These helpers are anchor-agnostic — pass whichever
// stored "YYYY-MM-DD" anchor date applies. The birthday-named wrappers below
// delegate here so existing birthday callers keep working.

// Is `anchorDate` within [daysBefore, daysAfter] of `today` (ignoring year)?
export function isDateInWindow(
  anchorDate: string | null,
  today: Date,
  daysBefore: number,
  daysAfter: number,
): boolean {
  const diff = birthdayDayDiff(anchorDate, today)
  if (diff == null) return false
  return diff >= -daysAfter && diff <= daysBefore
}

// Claimable now? In-window AND not already claimed this calendar year.
export function shouldClaimDateWindow(
  anchorDate: string | null,
  claimedYear: number | null,
  today: Date,
  daysBefore: number,
  daysAfter: number,
): boolean {
  if (!isDateInWindow(anchorDate, today, daysBefore, daysAfter)) return false
  return claimedYear !== today.getFullYear()
}

// --- Birthday wrappers (thin aliases over the generic helpers) --------------

// Is `birthday` within [daysBefore, daysAfter] of `today` (ignoring year)?
export function isBirthdaySoon(
  birthday: string | null,
  today: Date,
  daysBefore: number,
  daysAfter: number,
): boolean {
  return isDateInWindow(birthday, today, daysBefore, daysAfter)
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
  return shouldClaimDateWindow(birthday, redeemedYear, today, daysBefore, daysAfter)
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

// Pretty birthday for display, e.g. "15 March" (day + month only).
export function formatBirthday(birthday: string | null): string {
  if (!birthday) return '—'
  const p = dateStringToParts(birthday)
  if (p.month == null || p.day == null) return '—'
  return `${p.day} ${MONTHS[p.month - 1]}`
}
