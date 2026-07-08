// Map Supabase DB rows (snake_case) to camelCase domain types.
import type {
  Customer,
  CustomerRow,
  LoyaltyProgram,
  LoyaltyProgramRow,
  LoyaltyTransaction,
  LoyaltyTransactionRow,
  Service,
  ServiceGroup,
  ServiceGroupRow,
  ServiceRow,
  SmsTemplate,
  SmsTemplateRow,
} from '../../types'

export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    visitCount: row.visit_count,
    pointsBalance: row.points_balance,
    lifetimePoints: row.lifetime_points ?? 0,
    lastVisitAt: row.last_visit_at ?? null,
    birthday: row.birthday ?? null,
    birthdayRedeemedYear: row.birthday_redeemed_year ?? null,
    marketingConsent: row.marketing_consent ?? false,
  }
}

export function mapSmsTemplate(row: SmsTemplateRow): SmsTemplate {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    kind: row.kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    groupId: row.group_id ?? null,
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    active: row.active ?? true,
  }
}

export function mapServiceGroup(row: ServiceGroupRow): ServiceGroup {
  return { id: row.id, name: row.name, active: row.active }
}

export function mapLoyaltyProgram(row: LoyaltyProgramRow): LoyaltyProgram {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type ?? 'points',
    dateAnchor: row.date_anchor ?? null,
    windowBeforeDays: row.window_before_days ?? 7,
    windowAfterDays: row.window_after_days ?? 7,
    pointsPerReward: row.points_per_reward,
    rewardType: row.reward_type ?? 'fixed',
    rewardValue: Number(row.reward_value ?? row.reward_amount ?? 0),
    active: row.active,
  }
}

export function mapLoyaltyTransaction(row: LoyaltyTransactionRow): LoyaltyTransaction {
  return {
    id: row.id,
    customerId: row.customer_id,
    checkinId: row.checkin_id,
    amount: row.amount,
    reason: row.reason,
    createdAt: row.created_at,
  }
}
