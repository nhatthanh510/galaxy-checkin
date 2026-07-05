import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../supabase'
import { customersKey } from './useCustomers'

// A row to import: phone is the dedupe key.
export interface ImportCustomer {
  phone: string
  name: string
  pointsBalance: number
  visitCount: number
}

// Admin: bulk upsert customers by phone (import). Existing phones are updated,
// new ones inserted, in a single call.
export function useUpsertCustomers() {
  const qc = useQueryClient()
  return useMutation<number, Error, ImportCustomer[]>({
    mutationFn: async (rows) => {
      if (rows.length === 0) return 0
      const payload = rows.map((r) => ({
        phone: r.phone,
        name: r.name,
        points_balance: r.pointsBalance,
        visit_count: r.visitCount,
      }))
      const { error, count } = await getSupabase()
        .from('customer')
        .upsert(payload, { onConflict: 'phone', count: 'exact' })
      if (error) throw error
      return count ?? rows.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customersKey })
    },
  })
}
