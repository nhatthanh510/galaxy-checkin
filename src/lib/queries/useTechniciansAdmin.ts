import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Technician, TechnicianRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapTechnician } from './mappers'

export const techniciansAdminKey = ['technicians-admin'] as const

// Admin: list ALL technicians (active and inactive).
export function useTechniciansAdmin() {
  return useQuery<Technician[]>({
    queryKey: techniciansAdminKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('technician')
        .select('*')
        .order('name')
      if (error) throw error
      return (data as TechnicianRow[]).map(mapTechnician)
    },
  })
}

export interface TechnicianInput {
  name: string
  active: boolean
}

function toRow(input: TechnicianInput) {
  return { name: input.name, active: input.active }
}

// Invalidate both the admin list and the kiosk's active-only query.
function useInvalidateTechnicians() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: techniciansAdminKey })
    qc.invalidateQueries({ queryKey: ['technicians'] })
  }
}

export function useCreateTechnician() {
  const invalidate = useInvalidateTechnicians()
  return useMutation<Technician, Error, TechnicianInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase()
        .from('technician')
        .insert(toRow(input))
        .select('*')
        .single()
      if (error) throw error
      return mapTechnician(data as TechnicianRow)
    },
    onSuccess: invalidate,
  })
}

export function useUpdateTechnician() {
  const invalidate = useInvalidateTechnicians()
  return useMutation<Technician, Error, { id: string } & TechnicianInput>({
    mutationFn: async ({ id, ...input }) => {
      const { data, error } = await getSupabase()
        .from('technician')
        .update(toRow(input))
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return mapTechnician(data as TechnicianRow)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteTechnician() {
  const invalidate = useInvalidateTechnicians()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await getSupabase().from('technician').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
