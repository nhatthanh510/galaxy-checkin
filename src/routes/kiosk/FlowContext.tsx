import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Customer } from '../../types'
import { FlowContext, type FlowContextValue, type FlowState } from './kioskFlowContext'

const emptyState: FlowState = {
  phone: '',
  name: '',
  birthday: null,
  consent: false,
  customer: null,
  selectedServiceIds: [],
  technicianId: null,
}

export function KioskFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(emptyState)

  const setPhone = useCallback((phone: string) => setState((s) => ({ ...s, phone })), [])
  const setName = useCallback((name: string) => setState((s) => ({ ...s, name })), [])
  const setBirthday = useCallback(
    (birthday: string | null) => setState((s) => ({ ...s, birthday })),
    [],
  )
  const setConsent = useCallback(
    (consent: boolean) => setState((s) => ({ ...s, consent })),
    [],
  )
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
      setBirthday,
      setConsent,
      setCustomer,
      toggleService,
      setTechnician,
      reset,
    }),
    [state, setPhone, setName, setBirthday, setConsent, setCustomer, toggleService, setTechnician, reset],
  )

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}
