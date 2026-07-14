import { useQuery } from '@tanstack/react-query'
import type { CheckinStatus } from '../../types'
import { getSupabase } from '../supabase'
import { localDayRangeISO } from '../day'

// The [start, end) UTC instants spanning an inclusive local-date range: from the
// start of `from`'s local day to the start of the day AFTER `to`. Handles the two
// dates in either order.
function localRangeISO(from: Date, to: Date): { start: string; end: string } {
  const lo = from <= to ? from : to
  const hi = from <= to ? to : from
  return { start: localDayRangeISO(lo).start, end: localDayRangeISO(hi).end }
}

// One row of the daily check-ins report: a single visit with its customer and
// branch resolved. `branchName` is null for a branchless (unassigned) check-in.
export interface CheckinReportRow {
  id: string
  createdAt: string
  status: CheckinStatus
  customerId: string | null
  customerName: string
  customerPhone: string
  // Lifetime points, so the row can show the customer's tier badge (New/Regular/VIP).
  customerLifetimePoints: number
  branchId: string | null
  branchName: string | null
}

// Shape Supabase returns for the joined select. Embedded relations come back as
// a nested object (or null when the FK is null / no match).
interface RawRow {
  id: string
  created_at: string
  status: CheckinStatus
  customer_id: string | null
  customer: { name: string; phone: string; lifetime_points: number } | null
  branch: { id: string; name: string } | null
}

const PAGE_SIZE = 1000

// Admin: check-ins joined to customer + branch, newest first. A customer with
// several visits appears once per visit. Reads the checkin table directly (admin
// RLS covers SELECT); pages through in case the result exceeds PostgREST's
// 1000-row cap.
//
// When `from` AND `to` are given, returns that inclusive local-date range. When
// BOTH are null, returns ALL check-ins (no date filter) — the "All" mode.
export function useCheckinsReport(from: Date | null, to: Date | null) {
  const range = from && to ? localRangeISO(from, to) : null
  return useQuery<CheckinReportRow[]>({
    queryKey: ['checkins-report', range?.start ?? 'all', range?.end ?? 'all'],
    queryFn: async () => {
      const rows: CheckinReportRow[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        let q = getSupabase()
          .from('checkin')
          .select(
            'id, created_at, status, customer_id, customer:customer_id(name, phone, lifetime_points), branch:branch_id(id, name)',
          )
        // Range mode: bound by [start, end). All mode: no date filter.
        if (range) q = q.gte('created_at', range.start).lt('created_at', range.end)
        const { data, error } = await q
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        const page = (data as unknown as RawRow[]) ?? []
        for (const r of page) {
          rows.push({
            id: r.id,
            createdAt: r.created_at,
            status: r.status,
            customerId: r.customer_id,
            customerName: r.customer?.name ?? 'Unknown',
            customerPhone: r.customer?.phone ?? '',
            customerLifetimePoints: r.customer?.lifetime_points ?? 0,
            branchId: r.branch?.id ?? null,
            branchName: r.branch?.name ?? null,
          })
        }
        if (page.length < PAGE_SIZE) break
      }
      return rows
    },
    staleTime: 30 * 1000,
  })
}
