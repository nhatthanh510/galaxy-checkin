import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RewardType } from '../../types'
import { getSupabase } from '../supabase'
import { customersKey } from './useCustomers'

export interface RedeemResult {
  pointsBalance: number
  redeemedPoints: number
  rewardType: RewardType
  rewardValue: number
}

interface RedeemRpcRow {
  points_balance: number
  redeemed_points: number
  reward_type: RewardType
  reward_value: number
}

export interface RedeemInput {
  customerId: string
  // Which loyalty program to redeem. Omit to redeem the first active one.
  programId?: string | null
}

// Redeem a specific loyalty program's reward for a customer: subtracts that
// program's threshold from the balance and logs the transaction, via the
// redeem_points RPC. Works for the anon kiosk and for admins.
export function useRedeemPoints() {
  const qc = useQueryClient()
  return useMutation<RedeemResult, Error, RedeemInput>({
    mutationFn: async ({ customerId, programId }) => {
      const { data, error } = await getSupabase().rpc('redeem_points', {
        p_customer_id: customerId,
        p_program_id: programId ?? null,
      })
      if (error) throw error
      const rows = (data ?? []) as RedeemRpcRow[]
      if (rows.length === 0) throw new Error('redeem_points returned no row')
      const row = rows[0]
      return {
        pointsBalance: row.points_balance,
        redeemedPoints: row.redeemed_points,
        rewardType: row.reward_type,
        rewardValue: Number(row.reward_value),
      }
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: customersKey })
      qc.invalidateQueries({ queryKey: ['customer', vars.customerId] })
    },
  })
}
