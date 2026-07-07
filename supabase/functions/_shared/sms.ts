// Shared SMS helpers for the Edge Functions (Deno). One place that talks to
// ClickSend and records a `notification` row, so send-notification and
// send-birthday-sms behave identically.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// A service-role client (bypasses RLS). Both functions run server-side only.
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

// Normalize an AU local mobile (04XXXXXXXX) to E.164 (+61...) for ClickSend.
export function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0')) return '+61' + digits.slice(1)
  return '+' + digits
}

// Replace {{key}} placeholders in a template body from a values map.
export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    key in values ? values[key] : '',
  )
}

export type SmsStatus = 'sent' | 'failed' | 'stubbed'

export interface SendSmsInput {
  supabase: SupabaseClient
  toAddress: string
  message: string
  kind: 'checkin' | 'marketing' | 'birthday'
  template: string // human label stored on the row (e.g. 'checkin_confirmation')
  templateId?: string | null
  customerId?: string | null
  checkinId?: string | null
  payload?: Record<string, unknown>
}

// Send one SMS via ClickSend (or stub if creds are absent) and log a
// notification row. Returns the row id + delivery status. Never throws on a
// provider error — it records 'failed' and returns.
export async function sendSms(
  input: SendSmsInput,
): Promise<{ id: string | null; status: SmsStatus }> {
  const to = toE164(input.toAddress)
  const username = Deno.env.get('CLICKSEND_USERNAME')
  const apiKey = Deno.env.get('CLICKSEND_API_KEY')
  const from = Deno.env.get('CLICKSEND_FROM') ?? 'GalaxyNail'

  let status: SmsStatus = 'stubbed'
  let providerInfo: unknown = null

  if (username && apiKey) {
    try {
      const auth = 'Basic ' + btoa(`${username}:${apiKey}`)
      const resp = await fetch('https://rest.clicksend.com/v3/sms/send', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ source: 'sdk', from, to, body: input.message }] }),
      })
      providerInfo = await resp.json().catch(() => null)
      status = resp.ok ? 'sent' : 'failed'
      console.log(`[sms] ClickSend -> ${to}: ${status}`)
    } catch (err) {
      status = 'failed'
      providerInfo = { error: err instanceof Error ? err.message : String(err) }
      console.error(`[sms] ClickSend error -> ${to}:`, err)
    }
  } else {
    console.log(`[sms] no ClickSend creds; stubbed -> ${to}: ${input.message}`)
  }

  const { data, error } = await input.supabase
    .from('notification')
    .insert({
      customer_id: input.customerId ?? null,
      checkin_id: input.checkinId ?? null,
      channel: 'sms',
      kind: input.kind,
      template: input.template,
      template_id: input.templateId ?? null,
      to_address: to,
      payload: { ...(input.payload ?? {}), message: input.message, provider: providerInfo },
      status,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[sms] notification insert failed:', error.message)
    return { id: null, status }
  }
  return { id: data.id, status }
}
