import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Service, ServiceRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapService } from './mappers'

export const servicesAdminKey = ['services-admin'] as const

// Admin: list ALL services (active and inactive).
export function useServicesAdmin() {
  return useQuery<Service[]>({
    queryKey: servicesAdminKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('service')
        .select('*')
        .order('category')
        .order('name')
      if (error) throw error
      return (data as ServiceRow[]).map(mapService)
    },
  })
}

export interface ServiceInput {
  name: string
  category: string
  groupId: string | null
  active: boolean
}

function toRow(input: ServiceInput) {
  return {
    name: input.name,
    category: input.category,
    group_id: input.groupId,
    active: input.active,
  }
}

// Invalidate both the admin list and the kiosk's active-only query.
function useInvalidateServices() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: servicesAdminKey })
    qc.invalidateQueries({ queryKey: ['services'] })
  }
}

export function useCreateService() {
  const invalidate = useInvalidateServices()
  return useMutation<Service, Error, ServiceInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase()
        .from('service')
        .insert(toRow(input))
        .select('*')
        .single()
      if (error) throw error
      return mapService(data as ServiceRow)
    },
    onSuccess: invalidate,
  })
}

export function useUpdateService() {
  const invalidate = useInvalidateServices()
  return useMutation<Service, Error, { id: string } & ServiceInput>({
    mutationFn: async ({ id, ...input }) => {
      const { data, error } = await getSupabase()
        .from('service')
        .update(toRow(input))
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return mapService(data as ServiceRow)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteService() {
  const invalidate = useInvalidateServices()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await getSupabase().from('service').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
