import type { RewardType } from '../types'

// Human-readable reward, e.g. "$10 off" or "20% off".
export function formatReward(type: RewardType, value: number): string {
  return type === 'percent' ? `${value}% off` : `$${value} off`
}
