import { useQuery } from '@tanstack/react-query'
import type { LoyaltyProgram } from '../../types'
import { mockLoyaltyProgram } from '../mock/data'
import { mockDelay } from './mockDelay'

// Fetch the single active loyalty program. Mock-backed for now.
// Supabase swap: `getSupabase().from('loyalty_program').select().eq('active', true).single()`.
export function useLoyaltyProgram() {
  return useQuery<LoyaltyProgram>({
    queryKey: ['loyalty-program'],
    queryFn: () => mockDelay(mockLoyaltyProgram),
    staleTime: Infinity,
  })
}
