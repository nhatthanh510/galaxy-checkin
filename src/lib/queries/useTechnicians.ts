import { useQuery } from '@tanstack/react-query'
import type { Technician, TechnicianRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapTechnician } from './mappers'

// Fetch active technicians for the kiosk.
export function useTechnicians() {
  return useQuery<Technician[]>({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('technician')
        .select('*')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return (data as TechnicianRow[]).map(mapTechnician)
    },
    staleTime: 5 * 60 * 1000,
  })
}
