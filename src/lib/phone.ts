// Phone number helpers for the kiosk keypad — Australian mobile numbers.
//
// We accept AU mobiles entered locally: 10 digits starting with "04". Display
// follows the Australian Government Style Manual grouping (4-3-3, spaces):
//   04XX XXX XXX   e.g. 0412 345 678
// Validation is mobile-only (SMS goes to mobiles); an invalid number can still
// be force-processed from the UI ("Continue anyway").

const AU_MOBILE_LENGTH = 10

// Keep only digits, capped at the AU mobile length.
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, AU_MOBILE_LENGTH)
}

// Format progressively as the user types, grouping 4-3-3 with spaces:
//   "0412", "0412 345", "0412 345 678".
export function formatPhone(digits: string): string {
  const d = normalizePhone(digits)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
}

// A complete AU mobile: 10 digits starting with 04.
export function isValidAuMobile(digits: string): boolean {
  const d = normalizePhone(digits)
  return d.length === AU_MOBILE_LENGTH && d.startsWith('04')
}

// Enough digits entered to attempt a lookup/submit (10 digits), regardless of
// whether they form a valid AU mobile — validity is a separate check so we can
// warn but still allow a forced submit.
export function isComplete(digits: string): boolean {
  return normalizePhone(digits).length === AU_MOBILE_LENGTH
}
