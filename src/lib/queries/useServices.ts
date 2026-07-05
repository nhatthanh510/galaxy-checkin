import { useQuery } from '@tanstack/react-query'
import type { Service } from '../../types'
import { mockServices } from '../mock/data'
import { mockDelay } from './mockDelay'

// Fetch the service catalog for the kiosk. Mock-backed for now.
// Supabase swap: `getSupabase().from('service').select().eq('active', true)`.
export function useServices() {
  return useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => mockDelay(mockServices),
    staleTime: Infinity,
  })
}
