import { useMutation } from '@tanstack/react-query'
import type {
  CreateCheckinInput,
  CreateCheckinResult,
  CreateCheckinRpcRow,
} from '../../types'
import { getSupabase } from '../supabase'
import { queueNotification } from '../notifications'

// Create a checkin (status `waiting`) via the create_checkin RPC, which upserts
// the customer by phone and links services atomically. Then fires the (stubbed)
// confirmation notification. Loyalty points are NOT awarded here — that happens
// when a checkin is marked `completed` (a later staff-side pass).
export function useCreateCheckin() {
  return useMutation<CreateCheckinResult, Error, CreateCheckinInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase().rpc('create_checkin', {
        p_phone: input.phone,
        p_name: input.name,
        p_service_ids: input.serviceIds,
        p_technician_id: input.technicianId,
      })
      if (error) throw error

      const rows = (data ?? []) as CreateCheckinRpcRow[]
      if (rows.length === 0) throw new Error('create_checkin returned no row')
      const row = rows[0]

      const result: CreateCheckinResult = {
        checkin: {
          id: row.checkin_id,
          customerId: row.customer_id,
          serviceIds: input.serviceIds,
          technicianId: input.technicianId,
          status: 'waiting',
          createdAt: new Date().toISOString(),
        },
        customer: {
          id: row.customer_id,
          phone: input.phone,
          name: row.customer_name,
          visitCount: row.visit_count,
          pointsBalance: row.points_balance,
        },
      }

      // Fire the check-in confirmation. PLACEHOLDER — records intent only, no
      // real SMS/email until Twilio/email is wired. Non-blocking / non-throwing.
      await queueNotification({
        customerId: row.customer_id,
        checkinId: row.checkin_id,
        channel: 'sms',
        toAddress: input.phone,
        template: 'checkin_confirmation',
        payload: { name: row.customer_name },
      })

      return result
    },
  })
}
