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
  customer: Customer | null // matched known customer, else null
  selectedServiceIds: string[]
  technicianId: string | null
}

export interface FlowContextValue extends FlowState {
  setPhone: (phone: string) => void
  setName: (name: string) => void
  setBirthday: (birthday: string | null) => void
  setCustomer: (customer: Customer | null) => void
  toggleService: (serviceId: string) => void
  setTechnician: (technicianId: string | null) => void
  reset: () => void
}

export const FlowContext = createContext<FlowContextValue | null>(null)
