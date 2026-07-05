import { useMutation } from '@tanstack/react-query'
import type { Customer } from '../../types'
import { mockCustomers } from '../mock/data'
import { mockDelay } from './mockDelay'

// Look up a customer by phone number (digits only). Returns the customer or null
// if the number is unknown. Implemented as a mutation because it runs on demand
// when the user presses NEXT on the phone-entry screen, not as a standing query.
//
// Supabase swap: call a SECURITY DEFINER RPC that returns only the single
// matching row (anon must NOT have a blanket SELECT on customer — see RLS notes
// in supabase/migrations/0001_init.sql).
export function useCustomerLookup() {
  return useMutation<Customer | null, Error, string>({
    mutationFn: (phone: string) => {
      const found = mockCustomers.find((c) => c.phone === phone) ?? null
      return mockDelay(found)
    },
  })
}
