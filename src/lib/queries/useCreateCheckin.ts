import { useMutation } from '@tanstack/react-query'
import type {
  CreateCheckinInput,
  CreateCheckinResult,
  CreateCheckinRpcRow,
} from '../../types'
import { getSupabase } from '../supabase'
import { queueNotification } from '../notifications'
import { startOfLocalDayISO } from '../day'

// Raised when create_checkin rejects a second visit on the same salon-local day.
// The Success screen catches this to show a friendly "already checked in" state
// instead of a generic error (retrying would just fail again).
export class AlreadyCheckedInTodayError extends Error {
  constructor() {
    super('already_checked_in_today')
    this.name = 'AlreadyCheckedInTodayError'
  }
}

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
        p_technician_id: null, // preferred-staff feature removed
        p_birthday: input.birthday,
        p_consent: input.consent,
        // Skip the +1 when a points reward was redeemed this visit.
        p_award_point: input.awardPoint ?? true,
        // Local day boundary (tablet timezone) for the once-per-day guard.
        p_day_start: startOfLocalDayISO(),
      })
      if (error) {
        // The RPC raises this when the customer already checked in today.
        if (error.message.includes('already_checked_in_today')) {
          throw new AlreadyCheckedInTodayError()
        }
        throw error
      }

      const rows = (data ?? []) as CreateCheckinRpcRow[]
      if (rows.length === 0) throw new Error('create_checkin returned no row')
      const row = rows[0]

      const result: CreateCheckinResult = {
        checkin: {
          id: row.checkin_id,
          customerId: row.customer_id,
          serviceIds: input.serviceIds,
          status: 'waiting',
          createdAt: new Date().toISOString(),
        },
        customer: {
          id: row.customer_id,
          phone: input.phone,
          name: row.customer_name,
          visitCount: row.visit_count,
          pointsBalance: row.points_balance,
          // create_checkin doesn't return lifetime_points; not used on this path.
          lifetimePoints: 0,
          lastVisitAt: null,
          birthday: input.birthday,
          birthdayRedeemedYear: null,
          marketingConsent: input.consent,
        },
      }

      // Fire the check-in confirmation SMS via ClickSend (non-blocking /
      // non-throwing; degrades to a logged 'stubbed' record without creds).
      await queueNotification({
        customerId: row.customer_id,
        checkinId: row.checkin_id,
        toAddress: input.phone,
        template: 'checkin_confirmation',
        payload: { name: row.customer_name },
      })

      return result
    },
  })
}
