import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Branch, BranchRow } from '../../types'
import { getSupabase } from '../supabase'
import { getDeviceBranchSlug, slugifyBranchName } from '../branch'
import { mapBranch } from './mappers'

export const branchesKey = ['branches'] as const

// List branches. Kiosk sees active only; admin sees all (adminAll=true).
export function useBranches(adminAll = false) {
  return useQuery<Branch[]>({
    queryKey: [...branchesKey, adminAll],
    queryFn: async () => {
      let q = getSupabase().from('branch').select('id, name, slug, active').order('name')
      if (!adminAll) q = q.eq('active', true)
      const { data, error } = await q
      if (error) throw error
      return (data as BranchRow[]).map(mapBranch)
    },
    staleTime: 60 * 1000,
  })
}

// Resolve this tablet's assigned branch (from localStorage slug) to the current
// active Branch, or null when unassigned / the stored slug no longer matches an
// active branch. Reads the active-branch list so a renamed branch still resolves.
export function useDeviceBranch(): { branch: Branch | null; loading: boolean } {
  const { data, isLoading } = useBranches(false)
  const slug = getDeviceBranchSlug()
  const branch = slug ? data?.find((b) => b.slug === slug) ?? null : null
  return { branch, loading: isLoading }
}

function useInvalidateBranches() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: branchesKey })
}

// Admin: create a branch. The admin types only the name; the slug is derived.
export function useCreateBranch() {
  const invalidate = useInvalidateBranches()
  return useMutation<Branch, Error, { name: string }>({
    mutationFn: async ({ name }) => {
      const { data, error } = await getSupabase()
        .from('branch')
        .insert({ name: name.trim(), slug: slugifyBranchName(name), active: true })
        .select('id, name, slug, active')
        .single()
      if (error) throw error
      return mapBranch(data as BranchRow)
    },
    onSuccess: invalidate,
  })
}

// Admin: rename a branch and/or toggle its active flag. The slug is stable (not
// re-derived on rename) so tablets already pointed at it keep resolving.
export function useUpdateBranch() {
  const invalidate = useInvalidateBranches()
  return useMutation<Branch, Error, { id: string; name: string; active: boolean }>({
    mutationFn: async ({ id, name, active }) => {
      const { data, error } = await getSupabase()
        .from('branch')
        .update({ name: name.trim(), active })
        .eq('id', id)
        .select('id, name, slug, active')
        .single()
      if (error) throw error
      return mapBranch(data as BranchRow)
    },
    onSuccess: invalidate,
  })
}
