// Client-side SMS helpers shared by the admin marketing UI.
import type { Customer } from '../types'

// Replace {{key}} placeholders from a values map (mirrors the Edge Function's
// renderTemplate). Unknown placeholders render empty.
export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    key in values ? values[key] : '',
  )
}

// Per-recipient interpolation values. {{reward}} is the active birthday reward
// (passed in) so marketing copy can reference it too.
export function templateValues(customer: Customer, reward: string): Record<string, string> {
  return { name: customer.name || 'there', reward }
}

// GSM-7 SMS segment count for a rough "how many texts" estimate in the preview.
export function smsSegments(text: string): number {
  const len = text.length
  if (len === 0) return 0
  return len <= 160 ? 1 : Math.ceil(len / 153)
}
