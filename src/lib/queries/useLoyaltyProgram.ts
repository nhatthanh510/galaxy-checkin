import { useQuery } from '@tanstack/react-query'
import type { LoyaltyProgram, LoyaltyProgramRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapLoyaltyProgram } from './mappers'

export const loyaltyProgramKey = ['loyalty-program'] as const

// Fetch the single active loyalty program (shown on the kiosk phone screen).
export function useLoyaltyProgram() {
  return useQuery<LoyaltyProgram | null>({
    queryKey: loyaltyProgramKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .select('*')
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data ? mapLoyaltyProgram(data as LoyaltyProgramRow) : null
    },
    staleTime: 60 * 1000,
  })
}
