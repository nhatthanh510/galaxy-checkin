import { useMutation } from '@tanstack/react-query'
import type { Customer, CustomerRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapCustomer } from './mappers'

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
