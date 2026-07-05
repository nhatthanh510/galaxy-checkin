import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoyaltyProgram, LoyaltyProgramRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapLoyaltyProgram } from './mappers'
import { loyaltyProgramKey } from './useLoyaltyProgram'

export interface UpdateLoyaltyProgramInput {
  id: string
  name: string
  description: string
  pointsPerReward: number
  rewardAmount: number
}

// Admin: update the loyalty program config. The kiosk card reads this live.
export function useUpdateLoyaltyProgram() {
  const qc = useQueryClient()
  return useMutation<LoyaltyProgram, Error, UpdateLoyaltyProgramInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .update({
          name: input.name,
          description: input.description,
          points_per_reward: input.pointsPerReward,
          reward_amount: input.rewardAmount,
        })
        .eq('id', input.id)
        .select('*')
        .single()
      if (error) throw error
      return mapLoyaltyProgram(data as LoyaltyProgramRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loyaltyProgramKey })
    },
  })
}
