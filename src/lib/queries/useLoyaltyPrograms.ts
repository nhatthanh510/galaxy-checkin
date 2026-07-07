import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  LoyaltyProgram,
  LoyaltyProgramRow,
  PromotionDateAnchor,
  PromotionTrigger,
  RewardType,
} from '../../types'
import { getSupabase } from '../supabase'
import { mapLoyaltyProgram } from './mappers'
import { activeLoyaltyProgramsKey, loyaltyProgramKey } from './useLoyaltyProgram'

export const loyaltyProgramsKey = ['loyalty-programs'] as const

// Admin: list ALL loyalty programs (active and inactive).
export function useLoyaltyPrograms() {
  return useQuery<LoyaltyProgram[]>({
    queryKey: loyaltyProgramsKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .select('*')
        .order('name')
      if (error) throw error
      return (data as LoyaltyProgramRow[]).map(mapLoyaltyProgram)
    },
  })
}

export interface LoyaltyProgramInput {
  name: string
  description: string
  triggerType: PromotionTrigger
  dateAnchor: PromotionDateAnchor | null
  windowBeforeDays: number
  windowAfterDays: number
  pointsPerReward: number
  rewardType: RewardType
  rewardValue: number
  active: boolean
}

function toRow(input: LoyaltyProgramInput) {
  const isPoints = input.triggerType === 'points'
  const isDateWindow = input.triggerType === 'date_window'
  return {
    name: input.name,
    description: input.description,
    trigger_type: input.triggerType,
    // Anchor only applies to date-window triggers.
    date_anchor: isDateWindow ? (input.dateAnchor ?? 'birthday') : null,
    window_before_days: input.windowBeforeDays,
    window_after_days: input.windowAfterDays,
    // Only points triggers spend points.
    points_per_reward: isPoints ? input.pointsPerReward : 0,
    reward_type: input.rewardType,
    reward_value: input.rewardValue,
    // Keep the legacy $ column in sync for fixed rewards (0 for percent).
    reward_amount: input.rewardType === 'fixed' ? input.rewardValue : 0,
    active: input.active,
  }
}

// Invalidate the admin list AND both kiosk reads (single-active + all-active
// carousel) so edits appear on the kiosk immediately.
function useInvalidateLoyalty() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: loyaltyProgramsKey })
    qc.invalidateQueries({ queryKey: loyaltyProgramKey })
    qc.invalidateQueries({ queryKey: activeLoyaltyProgramsKey })
  }
}

// Admin: create a program.
export function useCreateLoyaltyProgram() {
  const invalidate = useInvalidateLoyalty()
  return useMutation<LoyaltyProgram, Error, LoyaltyProgramInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .insert(toRow(input))
        .select('*')
        .single()
      if (error) throw error
      return mapLoyaltyProgram(data as LoyaltyProgramRow)
    },
    onSuccess: invalidate,
  })
}

// Admin: update a program.
export function useUpdateLoyaltyProgramCrud() {
  const invalidate = useInvalidateLoyalty()
  return useMutation<LoyaltyProgram, Error, { id: string } & LoyaltyProgramInput>({
    mutationFn: async ({ id, ...input }) => {
      const { data, error } = await getSupabase()
        .from('loyalty_program')
        .update(toRow(input))
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return mapLoyaltyProgram(data as LoyaltyProgramRow)
    },
    onSuccess: invalidate,
  })
}

// Admin: delete a program.
export function useDeleteLoyaltyProgram() {
  const invalidate = useInvalidateLoyalty()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await getSupabase().from('loyalty_program').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
