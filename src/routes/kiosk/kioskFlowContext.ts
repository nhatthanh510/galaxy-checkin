import { createContext } from 'react'
import type { Customer } from '../../types'

// Shared state for the multi-step kiosk flow. Held in context so steps compose
// without prop-drilling. Reset on start-over / when the flow ends so the kiosk
// is clean for the next person (no leaking of the previous customer's data).
// In its own (non-component) module so FlowContext.tsx exports only a component
// — required for React Fast Refresh.
export interface FlowState {
  phone: string // digits only
  name: string
  birthday: string | null // "YYYY-MM-DD" or null (new customers only)
  consent: boolean // marketing-contact consent
  customer: Customer | null // matched known customer, else null
  selectedServiceIds: string[]
  // True once the customer redeemed a POINTS reward on the reward step. When set,
  // the check-in must NOT award its +1 point (a redeemed visit doesn't earn).
  // Non-points claims (birthday) don't set this.
  pointsRedeemed: boolean
}

export interface FlowContextValue extends FlowState {
  setPhone: (phone: string) => void
  setName: (name: string) => void
  setBirthday: (birthday: string | null) => void
  setConsent: (consent: boolean) => void
  setCustomer: (customer: Customer | null) => void
  toggleService: (serviceId: string) => void
  setPointsRedeemed: (redeemed: boolean) => void
  reset: () => void
}

export const FlowContext = createContext<FlowContextValue | null>(null)
