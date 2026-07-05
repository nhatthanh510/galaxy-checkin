import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { KioskFlowProvider } from './routes/kiosk/FlowContext'
import { PhoneEntry } from './routes/kiosk/PhoneEntry'
import { NameEntry } from './routes/kiosk/NameEntry'
import { ServiceSelection } from './routes/kiosk/ServiceSelection'
import { TechnicianSelection } from './routes/kiosk/TechnicianSelection'
import { Success } from './routes/kiosk/Success'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Flow state spans the kiosk steps; reset on start-over / success. */}
        <KioskFlowProvider>
          <Routes>
            {/* Kiosk (customer-facing) flow. */}
            <Route path="/" element={<PhoneEntry />} />
            <Route path="/kiosk/name" element={<NameEntry />} />
            <Route path="/kiosk/services" element={<ServiceSelection />} />
            <Route path="/kiosk/technician" element={<TechnicianSelection />} />
            <Route path="/kiosk/success" element={<Success />} />

            {/* Staff dashboard — placeholder for a later pass. */}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </KioskFlowProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
