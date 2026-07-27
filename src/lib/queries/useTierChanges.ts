import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TierChange, TierChangeRow, TierReviewPreviewItem } from '../../types'
import { getSupabase } from '../supabase'

// Snake-case row shape returned by admin_preview_tier_review.
interface PreviewRpcRow {
  customer_id: string
  name: string
  phone: string
  from_tier: TierReviewPreviewItem['fromTier']
  to_tier: TierReviewPreviewItem['toTier']
  visits_in_window: number | null
  last_visit_at: string | null
}

export const tierChangesKey = ['tier-changes'] as const

const PAGE_SIZE = 1000

// Admin: the tier change audit log, newest first, with each change's customer
// resolved. A decay ('review') or an upgrade/recovery ('checkin'). Admin RLS
// gates the read. Pages through in case the log exceeds PostgREST's 1000-row cap.
export function useTierChanges() {
  return useQuery<TierChange[]>({
    queryKey: tierChangesKey,
    queryFn: async () => {
      const rows: TierChange[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await getSupabase()
          .from('tier_change')
          .select(
            'id, customer_id, from_tier, to_tier, source, visits_in_window, created_at, customer:customer_id(name, phone)',
          )
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        const page = (data as unknown as TierChangeRow[]) ?? []
        for (const r of page) {
          rows.push({
            id: r.id,
            customerId: r.customer_id,
            customerName: r.customer?.name ?? 'Unknown',
            customerPhone: r.customer?.phone ?? '',
            fromTier: r.from_tier,
            toTier: r.to_tier,
            source: r.source,
            visitsInWindow: r.visits_in_window,
            createdAt: r.created_at,
          })
        }
        if (page.length < PAGE_SIZE) break
      }
      return rows
    },
    staleTime: 30 * 1000,
  })
}

// Admin: DRY RUN — the changes a review would make right now (read-only), so
// the admin can review and unselect before applying. Locked customers excluded.
export function useTierReviewPreview() {
  return useMutation<TierReviewPreviewItem[], Error, void>({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc('admin_preview_tier_review')
      if (error) throw error
      return ((data as PreviewRpcRow[]) ?? []).map((r) => ({
        customerId: r.customer_id,
        name: r.name,
        phone: r.phone,
        fromTier: r.from_tier,
        toTier: r.to_tier,
        visitsInWindow: r.visits_in_window,
        lastVisitAt: r.last_visit_at,
      }))
    },
  })
}

// Admin: apply the review to ONLY the selected customer ids. Returns how many
// changed. Refreshes the log + customer list so the UI reflects the new tiers.
export function useApplyTierReview() {
  const qc = useQueryClient()
  return useMutation<number, Error, string[]>({
    mutationFn: async (ids) => {
      const { data, error } = await getSupabase().rpc('admin_apply_tier_review', { p_ids: ids })
      if (error) throw error
      return (data as number) ?? 0
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tierChangesKey })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
