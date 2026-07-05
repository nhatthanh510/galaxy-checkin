import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Customer } from '../../types'

// Shared state for the multi-step kiosk flow. Held in context so steps compose
// without prop-drilling. Reset on start-over / when the flow ends so the kiosk
// is clean for the next person (no leaking of the previous customer's data).
interface FlowState {
  phone: string // digits only
  name: string
  customer: Customer | null // matched known customer, else null
  selectedServiceIds: string[]
  technicianId: string | null
}

const emptyState: FlowState = {
  phone: '',
  name: '',
  customer: null,
  selectedServiceIds: [],
  technicianId: null,
}

interface FlowContextValue extends FlowState {
  setPhone: (phone: string) => void
  setName: (name: string) => void
  setCustomer: (customer: Customer | null) => void
  toggleService: (serviceId: string) => void
  setTechnician: (technicianId: string | null) => void
  reset: () => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

export function KioskFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(emptyState)

  const setPhone = useCallback((phone: string) => setState((s) => ({ ...s, phone })), [])
  const setName = useCallback((name: string) => setState((s) => ({ ...s, name })), [])
  const setCustomer = useCallback(
    (customer: Customer | null) => setState((s) => ({ ...s, customer })),
    [],
  )
  const toggleService = useCallback(
    (serviceId: string) =>
      setState((s) => ({
        ...s,
        selectedServiceIds: s.selectedServiceIds.includes(serviceId)
          ? s.selectedServiceIds.filter((id) => id !== serviceId)
          : [...s.selectedServiceIds, serviceId],
      })),
    [],
  )
  const setTechnician = useCallback(
    (technicianId: string | null) => setState((s) => ({ ...s, technicianId })),
    [],
  )
  const reset = useCallback(() => setState(emptyState), [])

  const value = useMemo<FlowContextValue>(
    () => ({
      ...state,
      setPhone,
      setName,
      setCustomer,
      toggleService,
      setTechnician,
      reset,
    }),
    [state, setPhone, setName, setCustomer, toggleService, setTechnician, reset],
  )

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}

export function useKioskFlow(): FlowContextValue {
  const ctx = useContext(FlowContext)
  if (!ctx) {
    throw new Error('useKioskFlow must be used within a KioskFlowProvider')
  }
  return ctx
}
