import { useContext } from 'react'
import { FlowContext, type FlowContextValue } from './kioskFlowContext'

export function useKioskFlow(): FlowContextValue {
  const ctx = useContext(FlowContext)
  if (!ctx) {
    throw new Error('useKioskFlow must be used within a KioskFlowProvider')
  }
  return ctx
}
