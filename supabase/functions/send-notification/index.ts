// send-notification — Supabase Edge Function (Deno).
//
// PLACEHOLDER. Records a notification intent in the `notification` table with
// status 'stubbed' and returns success WITHOUT actually sending anything. Real
// SMS (Twilio) / email delivery is deferred; see the TODO below.
//
// Secrets (Twilio SID/token/from-number, email provider keys) live only in this
// function's env vars — never in client code (see CLAUDE.md conventions).
//
// Deploy:  supabase functions deploy send-notification
// Secrets: supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=...
// Invoke:  supabase.functions.invoke('send-notification', { body })  (from the app)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
// Supabase Edge runtime — no need to set them yourself.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NotificationRequest {
  customerId: string | null
  checkinId: string | null
  channel: 'sms' | 'email'
  toAddress: string
  template: string
  payload?: Record<string, unknown>
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as NotificationRequest

    if (!body.channel || !body.toAddress || !body.template) {
      return json({ error: 'channel, toAddress and template are required' }, 400)
    }

    // Service-role client so the function can write the log regardless of caller.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // TODO(twilio/email): send the real message here.
    //   - sms  -> Twilio Messages API using TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM
    //   - email-> your email provider (Resend/SendGrid/etc.)
    // On success set status 'sent'; on failure 'failed'. For now: 'stubbed'.
    const { data, error } = await supabase
      .from('notification')
      .insert({
        customer_id: body.customerId,
        checkin_id: body.checkinId,
        channel: body.channel,
        to_address: body.toAddress,
        template: body.template,
        payload: body.payload ?? {},
        status: 'stubbed',
      })
      .select('id')
      .single()

    if (error) return json({ error: error.message }, 500)

    console.log(
      `[send-notification] stubbed ${body.channel} to ${body.toAddress} (template=${body.template})`,
    )
    return json({ id: data.id, status: 'stubbed' }, 200)
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
