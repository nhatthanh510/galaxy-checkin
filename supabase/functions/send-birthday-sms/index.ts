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

// Format a loyalty reward the same way the client does (see src/lib/reward.ts).
function formatReward(rewardType: string | null, rewardValue: number | null): string {
  const v = rewardValue ?? 0
  if (rewardType === 'percent') return `${v}% off`
  return `$${v} off`
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

    // The active birthday loyalty program's reward, for {{reward}}.
    const { data: prog } = await supabase
      .from('loyalty_program')
      .select('reward_type, reward_value')
      .eq('active', true)
      .eq('trigger_type', 'date_window')
      .eq('date_anchor', 'birthday')
      .order('name')
      .limit(1)
      .maybeSingle()

    const reward = prog ? formatReward(prog.reward_type, Number(prog.reward_value)) : 'a treat'

    // Candidates: consented, have a birthday, month+day = today, not texted this
    // year. Birthday stored as YYYY-MM-DD (sentinel year) so match on MM-DD.
    const { data: customers, error } = await supabase
      .from('customer')
      .select('id, name, phone, birthday, birthday_sms_year')
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
