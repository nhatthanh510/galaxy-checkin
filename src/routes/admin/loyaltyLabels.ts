import type { LoyaltyProgram, PromotionTrigger } from '../../types'
import { formatReward } from '../../lib/reward'

// Shared loyalty-program display strings, in their own (non-component) module so
// the component files can each export only components (keeps React Fast Refresh
// working). Used by the list, view, and form.

// Human labels for each trigger.
export const TRIGGER_LABELS: Record<PromotionTrigger, string> = {
  points: 'Points reward',
  date_window: '🎂 Birthday reward',
  always: 'Standing promo',
}

// Short "how it's earned → reward" summary for the list row.
export function earnSummary(p: LoyaltyProgram): string {
  const reward = formatReward(p.rewardType, p.rewardValue)
  switch (p.triggerType) {
    case 'date_window':
      return '🎂 Birthday → % off by tier'
    case 'always':
      return `Any visit → ${reward}`
    default:
      return `${p.pointsPerReward} pts → ${reward}`
  }
}
