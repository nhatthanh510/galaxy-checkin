import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../supabase'
import { customersKey } from './useCustomers'

export interface RedeemResult {
  pointsBalance: number
  redeemedPoints: number
  rewardAmount: number
}

interface RedeemRpcRow {
  points_balance: number
  redeemed_points: number
  reward_amount: number
}

// Redeem the active reward for a customer: subtracts the program threshold from
// the balance (keeping surplus) and logs the transaction, via the redeem_points
// RPC. Works for the anon kiosk and for admins.
export function useRedeemPoints() {
  const qc = useQueryClient()
  return useMutation<RedeemResult, Error, string>({
    mutationFn: async (customerId: string) => {
      const { data, error } = await getSupabase().rpc('redeem_points', {
        p_customer_id: customerId,
      })
      if (error) throw error
      const rows = (data ?? []) as RedeemRpcRow[]
      if (rows.length === 0) throw new Error('redeem_points returned no row')
      const row = rows[0]
      return {
        pointsBalance: row.points_balance,
        redeemedPoints: row.redeemed_points,
        rewardAmount: Number(row.reward_amount),
      }
    },
    onSuccess: (_res, customerId) => {
      qc.invalidateQueries({ queryKey: customersKey })
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
    },
  })
}
