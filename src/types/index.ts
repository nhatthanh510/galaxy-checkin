// Shared domain types. These mirror the Supabase schema in
// supabase/migrations/0001_init.sql and are the contract satisfied by both the
// mock data layer (src/lib/mock) and the future Supabase-backed hooks.

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
