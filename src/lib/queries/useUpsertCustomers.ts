import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../supabase'
import { customersKey } from './useCustomers'

// A row to import: phone is the dedupe key. The trailing fields are optional —
// undefined means "don't write this column" so a partial CSV leaves an existing
// customer's birthday/consent untouched on update.
export interface ImportCustomer {
  phone: string
  name: string
  pointsBalance: number
  visitCount: number
  lifetimePoints?: number
  birthday?: string | null
  marketingConsent?: boolean
  // ISO timestamp of the customer's most recent visit. When set, the import
  // records a synthetic "completed" checkin at this time so it appears in the
  // customer's Visit History.
  lastVisited?: string | null
  notes?: string // staff-only freeform notes
}

// Send at most this many rows per RPC call so the JSON payload stays manageable.
const CHUNK = 500

// Admin: bulk import customers by phone via the import_customers RPC, which
// upserts each customer AND records a synthetic completed checkin at last_visited
// (so legacy visits show up in Visit History). Returns the number of rows sent.
export function useUpsertCustomers() {
  const qc = useQueryClient()
  return useMutation<number, Error, ImportCustomer[]>({
    mutationFn: async (rows) => {
      if (rows.length === 0) return 0
      let total = 0
      for (let i = 0; i < rows.length; i += CHUNK) {
        const payload = rows.slice(i, i + CHUNK).map((r) => ({
          phone: r.phone,
          name: r.name,
          points_balance: r.pointsBalance,
          visit_count: r.visitCount,
          lifetime_points: r.lifetimePoints ?? 0,
          birthday: r.birthday ?? null,
          marketing_consent: r.marketingConsent ?? false,
          last_visited: r.lastVisited ?? null,
          // Omit when unset so the RPC leaves existing notes untouched.
          notes: r.notes ?? '',
        }))
        const { data, error } = await getSupabase().rpc('import_customers', { p_rows: payload })
        if (error) throw error
        total += typeof data === 'number' ? data : payload.length
      }
      return total
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customersKey })
    },
  })
}
