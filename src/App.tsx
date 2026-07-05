import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth/AuthProvider'
import { RequireAdmin } from './components/RequireAdmin'
import { KioskFlowProvider } from './routes/kiosk/FlowContext'
import { PhoneEntry } from './routes/kiosk/PhoneEntry'
import { NameEntry } from './routes/kiosk/NameEntry'
import { ServiceSelection } from './routes/kiosk/ServiceSelection'
import { TechnicianSelection } from './routes/kiosk/TechnicianSelection'
import { Success } from './routes/kiosk/Success'
import { Login } from './routes/admin/Login'
import { AdminLayout } from './routes/admin/AdminLayout'
import { CustomersList } from './routes/admin/CustomersList'
import { CustomerDetail } from './routes/admin/CustomerDetail'
import { CustomerImport } from './routes/admin/CustomerImport'
import { LoyaltySettings } from './routes/admin/LoyaltySettings'
import { ServicesManage } from './routes/admin/ServicesManage'
import { StaffManage } from './routes/admin/StaffManage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Kiosk (customer-facing) flow — public, dark theme. */}
            <Route
              element={
                <KioskFlowProvider>
                  <Outlet />
                </KioskFlowProvider>
              }
            >
              <Route path="/" element={<PhoneEntry />} />
              <Route path="/kiosk/name" element={<NameEntry />} />
              <Route path="/kiosk/services" element={<ServiceSelection />} />
              <Route path="/kiosk/technician" element={<TechnicianSelection />} />
              <Route path="/kiosk/success" element={<Success />} />
            </Route>

            {/* Admin — login-gated. */}
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route index element={<Navigate to="customers" replace />} />
              <Route path="customers" element={<CustomersList />} />
              <Route path="customers/import" element={<CustomerImport />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="services" element={<ServicesManage />} />
              <Route path="staff" element={<StaffManage />} />
              <Route path="loyalty" element={<LoyaltySettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
