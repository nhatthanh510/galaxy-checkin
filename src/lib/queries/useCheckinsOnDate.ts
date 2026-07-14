import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '../supabase'
import { localDayRangeISO } from '../day'

// Admin: the distinct customer IDs that checked in on a given local day —
// optionally scoped to one branch. Used to filter the customer list to "checked
// in on <date>" (and, when a branch is given, "at <branch>"). Branch belongs to
// the visit, so this filter is inherently date-scoped. Returns a Set for O(1)
// membership. Disabled (returns an empty set, no fetch) when `day` is null.
//
// Reads the checkin table directly (admin RLS: "admin manages checkin" covers
// SELECT). Pages through in case a busy day exceeds PostgREST's 1000-row cap.
const PAGE_SIZE = 1000

export function useCheckinCustomerIdsOnDate(day: Date | null, branchId: string | null = null) {
  // Key by the local-day boundary + branch so the query re-runs when either
  // changes but not on every render (a fresh Date with the same day yields the
  // same key).
  const range = day ? localDayRangeISO(day) : null
  return useQuery<Set<string>>({
    queryKey: ['checkins-on-date', range?.start ?? null, branchId],
    enabled: range != null,
    queryFn: async () => {
      const ids = new Set<string>()
      if (!range) return ids
      for (let from = 0; ; from += PAGE_SIZE) {
        let q = getSupabase()
          .from('checkin')
          .select('customer_id')
          .gte('created_at', range.start)
          .lt('created_at', range.end)
        if (branchId) q = q.eq('branch_id', branchId)
        const { data, error } = await q.range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        const page = (data as { customer_id: string }[]) ?? []
        for (const row of page) ids.add(row.customer_id)
        if (page.length < PAGE_SIZE) break
      }
      return ids
    },
    staleTime: 30 * 1000,
  })
}
