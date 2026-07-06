import { useQuery } from '@tanstack/react-query'
import type { LoyaltyProgram, LoyaltyProgramRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapLoyaltyProgram } from './mappers'

export const loyaltyProgramKey = ['loyalty-program'] as const
export const activeLoyaltyProgramsKey = ['loyalty-programs-active'] as const

// Fetch the single active loyalty program used for the redeem threshold.
// (When several programs are active, this returns the first by name.)
export function useLoyaltyProgram() {
  return useQuery<LoyaltyProgram | null>({
    queryKey: loyaltyProgramKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .select('*')
        .eq('active', true)
        .order('name')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data ? mapLoyaltyProgram(data as LoyaltyProgramRow) : null
    },
    staleTime: 60 * 1000,
  })
}

// Fetch ALL active loyalty programs — the kiosk carousel cycles through these.
export function useActiveLoyaltyPrograms() {
  return useQuery<LoyaltyProgram[]>({
    queryKey: activeLoyaltyProgramsKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .select('*')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return (data as LoyaltyProgramRow[]).map(mapLoyaltyProgram)
    },
    staleTime: 60 * 1000,
  })
}
