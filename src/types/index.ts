// Shared domain (camelCase) types. These mirror the Supabase schema in
// supabase/migrations/*. The DB uses snake_case; hooks map rows to these shapes
// via src/lib/queries/mappers.ts. DB row types live at the bottom of this file.

export interface Customer {
  id: string
  phone: string // primary lookup key, digits only
  name: string
  visitCount: number
  pointsBalance: number
}

export interface Service {
  id: string
  name: string
  category: string
  price: number // in dollars
  durationMinutes: number
}

export interface Technician {
  id: string
  name: string
  active: boolean
  photoUrl: string | null // kiosk shows an initial avatar when null
}

export type CheckinStatus = 'waiting' | 'in_service' | 'completed' | 'cancelled'

export interface Checkin {
  id: string
  customerId: string
  serviceIds: string[]
  technicianId: string | null
  status: CheckinStatus
  createdAt: string // ISO timestamp
}

export interface LoyaltyProgram {
  id: string
  name: string // e.g. "10 Point"
  description: string // e.g. "10 points get $10 off"
  pointsPerReward: number // redemption threshold, e.g. 10
  rewardAmount: number // dollars off when redeemed, e.g. 10
  active: boolean
}

export interface LoyaltyTransaction {
  id: string
  customerId: string
  checkinId: string | null
  amount: number // signed: positive = earned, negative = redeemed
  reason: string
  createdAt: string // ISO timestamp
}

// Payload the kiosk flow hands to useCreateCheckin. The customer is created
// first when `customerId` is null (a new phone number).
export interface CreateCheckinInput {
  phone: string
  name: string
  customerId: string | null
  serviceIds: string[]
  technicianId: string | null
}

export interface CreateCheckinResult {
  checkin: Checkin
  customer: Customer
}

// ---------------------------------------------------------------------------
// DB row shapes (snake_case, as returned by Supabase). Mapped to the camelCase
// domain types above by src/lib/queries/mappers.ts.
// ---------------------------------------------------------------------------

export interface CustomerRow {
  id: string
  phone: string
  name: string
  visit_count: number
  points_balance: number
  created_at?: string
}

export interface ServiceRow {
  id: string
  name: string
  category: string
  price: number
  duration_minutes: number
  active?: boolean
}

export interface TechnicianRow {
  id: string
  name: string
  active: boolean
  photo_url: string | null
}

export interface LoyaltyProgramRow {
  id: string
  name: string
  description: string
  points_per_reward: number
  reward_amount: number
  active: boolean
}

export interface CheckinRow {
  id: string
  customer_id: string
  technician_id: string | null
  status: CheckinStatus
  created_at: string
}

export interface LoyaltyTransactionRow {
  id: string
  customer_id: string
  checkin_id: string | null
  amount: number
  reason: string
  created_at: string
}

// Result row of the create_checkin RPC.
export interface CreateCheckinRpcRow {
  checkin_id: string
  customer_id: string
  customer_name: string
  points_balance: number
  visit_count: number
}
