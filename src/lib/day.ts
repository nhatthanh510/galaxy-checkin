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
