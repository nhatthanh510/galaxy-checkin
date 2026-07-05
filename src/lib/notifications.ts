import { getSupabase } from './supabase'

export type NotificationChannel = 'sms' | 'email'

export interface QueueNotificationInput {
  customerId: string | null
  checkinId: string | null
  channel: NotificationChannel
  toAddress: string
  template: string
  payload?: Record<string, unknown>
}

// Record a notification intent. PLACEHOLDER — nothing is actually sent yet.
//
// We call the `queue_notification` RPC (works for the anon kiosk role and writes
// a `notification` row with status 'stubbed'). When real delivery is wired, this
// can instead invoke the `send-notification` Edge Function
// (`supabase.functions.invoke('send-notification', { body })`), which is where
// Twilio/email creds live. Kept non-throwing so a notification failure never
// breaks the check-in.
export async function queueNotification(input: QueueNotificationInput): Promise<void> {
  try {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('queue_notification', {
      p_customer_id: input.customerId,
      p_checkin_id: input.checkinId,
      p_channel: input.channel,
      p_to_address: input.toAddress,
      p_template: input.template,
      p_payload: input.payload ?? {},
    })
    if (error) console.warn('[queueNotification] failed:', error.message)
  } catch (err) {
    console.warn('[queueNotification] error:', err)
  }
}
