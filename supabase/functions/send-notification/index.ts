// send-notification — Supabase Edge Function (Deno). Sends one SMS via ClickSend.
//
// SMS only (no email). Sends a real text through the ClickSend REST API, records
// the result in the `notification` table (status 'sent' | 'failed'), and returns
// it. If ClickSend credentials aren't configured, it degrades to a logged
// 'stubbed' record so the app never breaks.
//
// Two modes:
//   * built-in template — pass `template` ('checkin_confirmation' | 'your_turn')
//     and `payload.name`; renderMessage builds the text. (Check-in path.)
//   * verbatim message  — pass a fully-rendered `message` (marketing/campaign
//     path); it's sent as-is and `template`/`templateId`/`kind` are stored for
//     traceability.
//
// Deploy:  supabase functions deploy send-notification
// Secrets: supabase secrets set CLICKSEND_USERNAME=... CLICKSEND_API_KEY=... [CLICKSEND_FROM=...]

import { corsHeaders, json, sendSms, serviceClient } from '../_shared/sms.ts'

interface NotificationRequest {
  customerId?: string | null
  checkinId?: string | null
  toAddress: string // recipient phone (E.164 preferred, e.g. +61412345678)
  template?: string // built-in template label; used when `message` is absent
  payload?: Record<string, unknown>
  message?: string // fully-rendered text; overrides the built-in template
  kind?: 'checkin' | 'marketing' | 'birthday'
  templateId?: string | null
}

// Built-in check-in templates. Marketing/birthday text comes pre-rendered via
// `message`, so this only covers the fixed operational messages.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as NotificationRequest
    if (!body.toAddress || (!body.template && !body.message)) {
      return json({ error: 'toAddress and (template or message) are required' }, 400)
    }

    const message = body.message ?? renderMessage(body.template ?? '', body.payload ?? {})

    const { id, status } = await sendSms({
      supabase: serviceClient(),
      toAddress: body.toAddress,
      message,
      kind: body.kind ?? 'checkin',
      template: body.template ?? 'custom',
      templateId: body.templateId ?? null,
      customerId: body.customerId ?? null,
      checkinId: body.checkinId ?? null,
      payload: body.payload,
    })

    return json({ id, status }, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unknown error' }, 500)
  }
})
