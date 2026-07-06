import { getSupabase } from './supabase'

export interface QueueNotificationInput {
  customerId: string | null
  checkinId: string | null
  toAddress: string // recipient phone
  template: string
  payload?: Record<string, unknown>
}

// Send an SMS via the `send-notification` Edge Function (ClickSend). The function
// records the result in the `notification` table. Kept non-throwing so a
// notification failure never breaks the check-in. SMS only — no email.
export async function queueNotification(input: QueueNotificationInput): Promise<void> {
  try {
    const supabase = getSupabase()
    const { error } = await supabase.functions.invoke('send-notification', {
      body: {
        customerId: input.customerId,
        checkinId: input.checkinId,
        toAddress: input.toAddress,
        template: input.template,
        payload: input.payload ?? {},
      },
    })
    if (error) console.warn('[queueNotification] failed:', error.message)
  } catch (err) {
    console.warn('[queueNotification] error:', err)
  }
}
