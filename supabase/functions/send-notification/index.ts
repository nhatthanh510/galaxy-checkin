// send-notification — Supabase Edge Function (Deno). Sends SMS via ClickSend.
//
// SMS only (no email). Sends a real text through the ClickSend REST API, records
// the result in the `notification` table (status 'sent' | 'failed'), and returns
// it. If ClickSend credentials aren't configured, it degrades to a logged
// 'stubbed' record so the app never breaks.
//
// Deploy:  supabase functions deploy send-notification
// Secrets: supabase secrets set CLICKSEND_USERNAME=... CLICKSEND_API_KEY=... [CLICKSEND_FROM=...]
// Invoke:  supabase.functions.invoke('send-notification', { body })  (from the app)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the Edge runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NotificationRequest {
  customerId: string | null
  checkinId: string | null
  toAddress: string // recipient phone (E.164 preferred, e.g. +61412345678)
  template: string // e.g. 'checkin_confirmation'
  payload?: Record<string, unknown>
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Build the SMS text from a template + payload. Keep it simple and centralized.
function renderMessage(template: string, payload: Record<string, unknown>): string {
  const name = typeof payload.name === 'string' ? payload.name : 'there'
  switch (template) {
    case 'checkin_confirmation':
      return `Hi ${name}, you're checked in at Galaxy Nails. We'll see you soon!`
    case 'your_turn':
      return `Hi ${name}, your table is ready at Galaxy Nails. Please come through.`
    default:
      return `Galaxy Nails: ${template}`
  }
}

// Normalize an AU local mobile (04XXXXXXXX) to E.164 (+61...) for ClickSend.
function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0')) return '+61' + digits.slice(1)
  return '+' + digits
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as NotificationRequest
    if (!body.toAddress || !body.template) {
      return json({ error: 'toAddress and template are required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const message = renderMessage(body.template, body.payload ?? {})
    const to = toE164(body.toAddress)

    const username = Deno.env.get('CLICKSEND_USERNAME')
    const apiKey = Deno.env.get('CLICKSEND_API_KEY')
    const from = Deno.env.get('CLICKSEND_FROM') ?? 'GalaxyNail'

    let status: 'sent' | 'failed' | 'stubbed' = 'stubbed'
    let providerInfo: unknown = null

    if (username && apiKey) {
      // Send via ClickSend REST: POST /v3/sms/send with Basic auth.
      const auth = 'Basic ' + btoa(`${username}:${apiKey}`)
      const resp = await fetch('https://rest.clicksend.com/v3/sms/send', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ source: 'sdk', from, to, body: message }],
        }),
      })
      providerInfo = await resp.json().catch(() => null)
      status = resp.ok ? 'sent' : 'failed'
      console.log(`[send-notification] ClickSend -> ${to}: ${status}`)
    } else {
      console.log(`[send-notification] no ClickSend creds; stubbed -> ${to}: ${message}`)
    }

    const { data, error } = await supabase
      .from('notification')
      .insert({
        customer_id: body.customerId,
        checkin_id: body.checkinId,
        channel: 'sms',
        to_address: to,
        template: body.template,
        payload: { ...(body.payload ?? {}), message, provider: providerInfo },
        status,
      })
      .select('id')
      .single()

    if (error) return json({ error: error.message }, 500)
    return json({ id: data.id, status }, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unknown error' }, 500)
  }
})

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
