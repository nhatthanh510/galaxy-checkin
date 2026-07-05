import { useQuery } from '@tanstack/react-query'
import type { Technician } from '../../types'
import { mockTechnicians } from '../mock/data'
import { mockDelay } from './mockDelay'

// Fetch active technicians for the kiosk. Mock-backed for now.
// Supabase swap: `getSupabase().from('technician').select().eq('active', true)`.
export function useTechnicians() {
  return useQuery<Technician[]>({
    queryKey: ['technicians'],
    queryFn: () => mockDelay(mockTechnicians.filter((t) => t.active)),
    staleTime: Infinity,
  })
}
