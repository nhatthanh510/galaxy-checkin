import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Customer, SmsTemplate } from '../../types'
import { getSupabase } from '../supabase'
import { renderTemplate, templateValues } from '../sms'

export interface SendCampaignInput {
  template: SmsTemplate
  recipients: Customer[]
  reward: string // active birthday reward, for {{reward}} interpolation
}

export interface CampaignResult {
  total: number
  sent: number
  failed: number
}

// Send a marketing SMS to each recipient via the send-notification Edge
// Function (one invoke per recipient; the function renders nothing — we pass the
// fully-rendered message). Recipients must be pre-filtered to consented
// customers by the caller; the function is a safety net, not the gate.
export function useSendCampaign() {
  const qc = useQueryClient()
  return useMutation<CampaignResult, Error, SendCampaignInput>({
    mutationFn: async ({ template, recipients, reward }) => {
      const supabase = getSupabase()
      let sent = 0
      let failed = 0

      // Sequential to stay well within Edge Function rate limits for a salon-
      // sized list; swap to batched Promise.all if lists grow large.
      for (const c of recipients) {
        const message = renderTemplate(template.body, templateValues(c, reward))
        const { data, error } = await supabase.functions.invoke('send-notification', {
          body: {
            customerId: c.id,
            checkinId: null,
            toAddress: c.phone,
            message,
            kind: 'marketing',
            templateId: template.id,
            template: template.name,
          },
        })
        const status = (data as { status?: string } | null)?.status
        if (error || status === 'failed') failed++
        else sent++
      }

      return { total: recipients.length, sent, failed }
    },
    onSuccess: () => {
      // Refresh the notification-derived views if any are cached.
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
