import { useMutation } from '@tanstack/react-query'
import type { Customer, CustomerRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapCustomer } from './mappers'
import { startOfLocalDayISO } from '../day'

// Look up a customer by phone (digits only) via the lookup_customer_by_phone
// RPC. Returns the customer or null if unknown. The RPC is SECURITY DEFINER and
// returns only the single matching row — anon has no blanket SELECT on customer.
export function useCustomerLookup() {
  return useMutation<Customer | null, Error, string>({
    mutationFn: async (phone: string) => {
      const { data, error } = await getSupabase().rpc('lookup_customer_by_phone', {
        p_phone: phone,
      })
      if (error) throw error
      const rows = (data ?? []) as CustomerRow[]
      return rows.length > 0 ? mapCustomer(rows[0]) : null
    },
  })
}

// Kiosk pre-flight: has this customer already checked in today? Called after a
// known-customer lookup so the phone screen can stop a repeat visit before the
// reward step (where redeeming would spend points on a visit that create_checkin
// then rejects). Backed by the customer_checked_in_today SECURITY DEFINER RPC.
export function useCheckedInToday() {
  return useMutation<boolean, Error, string>({
    mutationFn: async (customerId: string) => {
      const { data, error } = await getSupabase().rpc('customer_checked_in_today', {
        p_customer_id: customerId,
        // Local day boundary (tablet timezone), matching the check-in guard.
        p_day_start: startOfLocalDayISO(),
      })
      if (error) throw error
      return Boolean(data)
    },
  })
}
