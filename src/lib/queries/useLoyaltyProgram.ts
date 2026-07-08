import { useQuery } from '@tanstack/react-query'
import type { LoyaltyProgram, LoyaltyProgramRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapLoyaltyProgram } from './mappers'

export const loyaltyProgramKey = ['loyalty-program'] as const
export const activeLoyaltyProgramsKey = ['loyalty-programs-active'] as const

// Fetch the active points program that defines the redeem threshold.
//
// "Redeemable" is only meaningful for *points* programs (date_window/always
// programs have points_per_reward = 0). When several points programs are active,
// a customer can redeem as soon as they clear the *lowest* threshold, so we
// return the active points program with the smallest positive points_per_reward.
// Programs with a 0 threshold are ignored — a 0 would make everyone "redeemable".
export function useLoyaltyProgram() {
  return useQuery<LoyaltyProgram | null>({
    queryKey: loyaltyProgramKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .select('*')
        .eq('active', true)
        .eq('trigger_type', 'points')
        .gt('points_per_reward', 0)
        .order('points_per_reward', { ascending: true })
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
