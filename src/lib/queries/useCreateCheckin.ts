import { useMutation } from '@tanstack/react-query'
import type {
  Checkin,
  CreateCheckinInput,
  CreateCheckinResult,
} from '../../types'
import { mockCustomers, nextMockId } from '../mock/data'

// In-memory checkin store (mock). In the Supabase pass this becomes rows in the
// `checkin` + `checkin_service` tables.
export const mockCheckins: Checkin[] = []

// Create a checkin with status `waiting`, creating the customer first when the
// phone number is new. Mock-backed for now.
//
// Supabase swap: upsert customer by phone, insert checkin + checkin_service
// rows. Loyalty points are NOT awarded here — that happens when a checkin is
// marked `completed` (a later staff-side pass).
export function useCreateCheckin() {
  return useMutation<CreateCheckinResult, Error, CreateCheckinInput>({
    mutationFn: (input) => {
      let customer = input.customerId
        ? mockCustomers.find((c) => c.id === input.customerId) ?? null
        : mockCustomers.find((c) => c.phone === input.phone) ?? null

      if (!customer) {
        customer = {
          id: nextMockId('cust'),
          phone: input.phone,
          name: input.name || 'Guest',
          visitCount: 0,
          pointsBalance: 0,
        }
        mockCustomers.push(customer)
      }

      const checkin: Checkin = {
        id: nextMockId('chk'),
        customerId: customer.id,
        serviceIds: input.serviceIds,
        technicianId: input.technicianId,
        status: 'waiting',
        createdAt: new Date().toISOString(),
      }
      mockCheckins.push(checkin)

      // Count this visit.
      customer.visitCount += 1

      // TODO(sms): invoke the send-sms edge function here to fire the check-in
      // confirmation text. Deferred — no Twilio in this pass. This is the single
      // integration point; wire it once the function + creds exist.

      const result: CreateCheckinResult = { checkin, customer: { ...customer } }
      return Promise.resolve(result)
    },
  })
}
