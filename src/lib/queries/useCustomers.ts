import { useQuery } from '@tanstack/react-query'
import type { Customer, CustomerRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapCustomer } from './mappers'

export const customersKey = ['customers'] as const

// PostgREST caps a single select at 1000 rows, so page through with .range()
// until a short page comes back. Needed because the salon has >1000 customers.
const PAGE_SIZE = 1000

// Admin: list all customers. Requires an authenticated admin session (RLS).
export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: customersKey,
    queryFn: async () => {
      const rows: CustomerRow[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await getSupabase()
          .from('customer')
          // Join the last-visit branch name so the list can show where they last
          // went. `*` keeps every scalar column; the alias adds the nested branch.
          .select('*, last_visit_branch:last_visit_branch_id(name)')
          // Most recently-visited first; never-visited (null) sort last. Name is
          // a stable tiebreaker so paging through .range() is deterministic.
          .order('last_visit_at', { ascending: false, nullsFirst: false })
          .order('name')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        const page = (data as CustomerRow[]) ?? []
        rows.push(...page)
        if (page.length < PAGE_SIZE) break
      }
      return rows.map(mapCustomer)
    },
  })
}
