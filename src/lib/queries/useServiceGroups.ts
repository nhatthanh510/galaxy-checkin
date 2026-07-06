import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ServiceGroup, ServiceGroupRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapServiceGroup } from './mappers'

export const serviceGroupsKey = ['service-groups'] as const

// List service groups. Kiosk sees active only; admin sees all (adminAll=true).
export function useServiceGroups(adminAll = false) {
  return useQuery<ServiceGroup[]>({
    queryKey: [...serviceGroupsKey, adminAll],
    queryFn: async () => {
      let q = getSupabase().from('service_group').select('*').order('name')
      if (!adminAll) q = q.eq('active', true)
      const { data, error } = await q
      if (error) throw error
      return (data as ServiceGroupRow[]).map(mapServiceGroup)
    },
    staleTime: 60 * 1000,
  })
}

export interface ServiceGroupInput {
  name: string
  active: boolean
}

function useInvalidateGroups() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: serviceGroupsKey })
    qc.invalidateQueries({ queryKey: ['services'] })
    qc.invalidateQueries({ queryKey: ['services-admin'] })
  }
}

export function useCreateServiceGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation<ServiceGroup, Error, ServiceGroupInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase()
        .from('service_group')
        .insert({ name: input.name, active: input.active })
        .select('*')
        .single()
      if (error) throw error
      return mapServiceGroup(data as ServiceGroupRow)
    },
    onSuccess: invalidate,
  })
}

export function useUpdateServiceGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation<ServiceGroup, Error, { id: string } & ServiceGroupInput>({
    mutationFn: async ({ id, ...input }) => {
      const { data, error } = await getSupabase()
        .from('service_group')
        .update({ name: input.name, active: input.active })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return mapServiceGroup(data as ServiceGroupRow)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteServiceGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      // Services in this group have group_id set null (FK on delete set null).
      const { error } = await getSupabase().from('service_group').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
