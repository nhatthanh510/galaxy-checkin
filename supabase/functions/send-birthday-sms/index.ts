// send-birthday-sms — Supabase Edge Function (Deno). Texts today's birthdays.
//
// Invoked once a day by the `daily-birthday-sms` pg_cron job (see migration
// 0004). Finds customers whose birthday (month+day, year ignored) is today, who
// have marketing_consent = true, and who haven't already been texted this year
// (birthday_sms_year), renders the active birthday template — interpolating the
// active birthday loyalty program's reward — sends the SMS, and stamps
// birthday_sms_year so it never double-sends.
//
// Deploy:  supabase functions deploy send-birthday-sms
// Manual:  POST {} to the function URL with the service-role bearer token.

import { json, renderTemplate, sendSms, serviceClient } from '../_shared/sms.ts'

// Birthday discount percent by loyalty tier, derived from lifetime points.
// Mirrors src/lib/tier.ts (New < 5, Regular 5..19, VIP >= 20) so the SMS says
// the same percent the kiosk shows.
function birthdayPercentForTier(
  lifetimePoints: number,
  percents: { newPct: number; regularPct: number; vipPct: number },
): number {
  if (lifetimePoints < 5) return percents.newPct
  if (lifetimePoints < 20) return percents.regularPct
  return percents.vipPct
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  try {
    const supabase = serviceClient()
    const now = new Date()
    const year = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')

    // The active birthday template (kind = 'birthday'); fall back to a default.
    const { data: tpl } = await supabase
      .from('sms_template')
      .select('id, body')
      .eq('kind', 'birthday')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const templateBody =
      tpl?.body ?? 'Happy birthday {{name}}! 🎂 Enjoy {{reward}} at Galaxy Nails.'
    const templateId = tpl?.id ?? null

    // Birthday discount percents by tier — configured on app_settings, applied
    // per-customer based on their lifetime points (so {{reward}} varies by tier).
    const { data: settings } = await supabase
      .from('app_settings')
      .select('birthday_percent_new, birthday_percent_regular, birthday_percent_vip')
      .limit(1)
      .maybeSingle()

    const percents = {
      newPct: Number(settings?.birthday_percent_new ?? 10),
      regularPct: Number(settings?.birthday_percent_regular ?? 15),
      vipPct: Number(settings?.birthday_percent_vip ?? 20),
    }

    // Candidates: consented, have a birthday, month+day = today, not texted this
    // year. Birthday stored as YYYY-MM-DD (sentinel year) so match on MM-DD.
    const { data: customers, error } = await supabase
      .from('customer')
      .select('id, name, phone, birthday, birthday_sms_year, lifetime_points')
      .eq('marketing_consent', true)
      .not('birthday', 'is', null)

    if (error) return json({ error: error.message }, 500)

    const todays = (customers ?? []).filter((c) => {
      if (!c.birthday) return false
      const bday = String(c.birthday) // 'YYYY-MM-DD'
      const matches = bday.slice(5) === `${mm}-${dd}`
      return matches && c.birthday_sms_year !== year
    })

    let sent = 0
    let failed = 0
    for (const c of todays) {
      const pct = birthdayPercentForTier(Number(c.lifetime_points ?? 0), percents)
      const reward = `${pct}% off`
      const message = renderTemplate(templateBody, { name: c.name ?? 'there', reward })
      const { status } = await sendSms({
        supabase,
        toAddress: c.phone,
        message,
        kind: 'birthday',
        template: 'birthday_greeting',
        templateId,
        customerId: c.id,
      })
      if (status === 'failed') {
        failed++
        // Leave birthday_sms_year unset so a later run can retry.
        continue
      }
      // Stamp the year (covers 'sent' and 'stubbed') so we don't double-send.
      await supabase.from('customer').update({ birthday_sms_year: year }).eq('id', c.id)
      sent++
    }

    console.log(`[send-birthday-sms] ${sent} sent, ${failed} failed of ${todays.length} today`)
    return json({ candidates: todays.length, sent, failed }, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unknown error' }, 500)
  }
})
