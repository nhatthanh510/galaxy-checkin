import { useQuery } from '@tanstack/react-query'
import type { Service, ServiceRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapService } from './mappers'

// Fetch the active service catalog for the kiosk.
export function useServices() {
  return useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('service')
        .select('*')
        .eq('active', true)
        .order('category')
      if (error) throw error
      return (data as ServiceRow[]).map(mapService)
    },
    staleTime: 5 * 60 * 1000,
  })
}
