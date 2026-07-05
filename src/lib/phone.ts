// Phone number helpers for the kiosk keypad.

// Keep only digits, capped at a US 10-digit number.
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10)
}

// Format progressively as the user types: "", "(832", "(832) 968-66…".
export function formatPhone(digits: string): string {
  const d = normalizePhone(digits)
  if (d.length === 0) return ''
  if (d.length <= 3) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

export function isCompletePhone(digits: string): boolean {
  return normalizePhone(digits).length === 10
}
