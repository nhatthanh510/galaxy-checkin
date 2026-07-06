import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../supabase'
import { customersKey } from './useCustomers'

// Mark a customer's birthday discount as used for the current year via the
// claim_birthday RPC. Returns the year recorded. Hides the birthday warning
// until next year.
export function useClaimBirthday() {
  const qc = useQueryClient()
  return useMutation<number, Error, string>({
    mutationFn: async (customerId: string) => {
      const { data, error } = await getSupabase().rpc('claim_birthday', {
        p_customer_id: customerId,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: (_year, customerId) => {
      qc.invalidateQueries({ queryKey: customersKey })
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
    },
  })
}
