// In-memory mock data backing the kiosk flow. This is the ONLY place mock data
// lives — components never import it directly; they go through the query hooks
// in src/lib/queries, which currently read/write this module. Swapping a hook to
// Supabase later means editing the hook, not this file or any component.

import type {
  Customer,
  LoyaltyProgram,
  Service,
  Technician,
} from '../../types'

export const mockLoyaltyProgram: LoyaltyProgram = {
  id: 'lp-1',
  name: '10 Point',
  description: '10 points get $10 off',
  pointsPerReward: 10,
  rewardAmount: 10,
  active: true,
}

export const mockServices: Service[] = [
  { id: 'svc-1', name: 'Regular Manicure', category: 'Manicure Fastboy', price: 20, durationMinutes: 30 },
  { id: 'svc-2', name: 'Gel Manicure', category: 'Manicure Fastboy', price: 35, durationMinutes: 45 },
  { id: 'svc-3', name: 'Regular Pedicure', category: 'Pedicure Fastboy', price: 30, durationMinutes: 40 },
  { id: 'svc-4', name: 'Deluxe Pedicure', category: 'Pedicure Fastboy', price: 45, durationMinutes: 60 },
  { id: 'svc-5', name: 'Full Set Acrylic', category: 'Nail Enhancements', price: 50, durationMinutes: 75 },
  { id: 'svc-6', name: 'Dip Powder', category: 'Nail Enhancements', price: 45, durationMinutes: 60 },
]

export const mockTechnicians: Technician[] = [
  { id: 'tech-1', name: 'Anna', active: true, photoUrl: null },
  { id: 'tech-2', name: 'Bao', active: true, photoUrl: null },
  { id: 'tech-3', name: 'Christine', active: true, photoUrl: null },
  { id: 'tech-4', name: 'David', active: true, photoUrl: null },
  { id: 'tech-5', name: 'Emily', active: true, photoUrl: null },
]

// Mutable in-memory customer store. Known phone numbers to demo the branches:
//   8329686600 -> Linh Nguyen, 20 pts (>= threshold, shows redeem reminder)
//   8325551234 -> Sam Carter, 4 pts  (known, below threshold)
// Any other number is treated as a new customer.
export const mockCustomers: Customer[] = [
  { id: 'cust-1', phone: '8329686600', name: 'Linh Nguyen', visitCount: 12, pointsBalance: 20 },
  { id: 'cust-2', phone: '8325551234', name: 'Sam Carter', visitCount: 3, pointsBalance: 4 },
]

// A monotonically increasing counter so mock ids are unique within a session.
// (Date.now()/Math.random() are avoided to keep behavior deterministic.)
let seq = 100
export function nextMockId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}
