// Start of the current LOCAL day as a UTC instant (ISO string).
//
// The kiosk tablet's clock is set to the salon's own timezone, so "local
// midnight" is the correct boundary for the one-check-in-per-day rule. We compute
// it here on the client and pass it to the DB, so no timezone is hardcoded
// server-side — the DB just compares `checkin.created_at >= this instant`
// (both sides are UTC instants, an apples-to-apples comparison).
export function startOfLocalDayISO(now: Date = new Date()): string {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

// The [start, end) UTC instants bounding a given local calendar day. `end` is
// the next local midnight, so a half-open [start, end) range captures exactly
// that day's timestamps. Used to filter check-ins to a specific date.
export function localDayRangeISO(day: Date): { start: string; end: string } {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Parse a "YYYY-MM-DD" (from a <input type="date">) as a LOCAL date. `new
// Date("YYYY-MM-DD")` parses as UTC midnight, which shifts the day in negative
// offsets — so build it from parts instead.
export function localDateFromInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Format a local Date as "YYYY-MM-DD" for a <input type="date"> value.
export function toDateInputValue(day: Date): string {
  const yyyy = day.getFullYear()
  const mm = String(day.getMonth() + 1).padStart(2, '0')
  const dd = String(day.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
