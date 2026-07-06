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
  Technician,
  TechnicianRow,
} from '../../types'

export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    visitCount: row.visit_count,
    pointsBalance: row.points_balance,
    birthday: row.birthday ?? null,
    birthdayRedeemedYear: row.birthday_redeemed_year ?? null,
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

export function mapTechnician(row: TechnicianRow): Technician {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    photoUrl: row.photo_url,
  }
}

export function mapLoyaltyProgram(row: LoyaltyProgramRow): LoyaltyProgram {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pointsPerReward: row.points_per_reward,
    rewardAmount: Number(row.reward_amount),
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
