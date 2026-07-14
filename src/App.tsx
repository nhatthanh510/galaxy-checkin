import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth/AuthProvider'
import { RequireAuth } from './components/RequireAuth'
import { RequireAdmin } from './components/RequireAdmin'
import { KioskFlowProvider } from './routes/kiosk/FlowContext'
import { PhoneEntry } from './routes/kiosk/PhoneEntry'
import { NameEntry } from './routes/kiosk/NameEntry'
import { ServiceSelection } from './routes/kiosk/ServiceSelection'
import { Success } from './routes/kiosk/Success'
import { BranchSetup } from './routes/kiosk/BranchSetup'
import { Login } from './routes/Login'
import { AdminLayout } from './routes/admin/AdminLayout'
import { CustomersList } from './routes/admin/CustomersList'
import { CustomerDetail } from './routes/admin/CustomerDetail'
import { CustomerImport } from './routes/admin/CustomerImport'
import { LoyaltySettings } from './routes/admin/LoyaltySettings'
import { ServicesManage } from './routes/admin/ServicesManage'
import { GroupsManage } from './routes/admin/GroupsManage'
import { SmsTemplates } from './routes/admin/SmsTemplates'
import { Marketing } from './routes/admin/Marketing'
import { Settings } from './routes/admin/Settings'
import { BranchesManage } from './routes/admin/BranchesManage'
import { DailyCheckins } from './routes/admin/DailyCheckins'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      // Keep screens fresh across tabs/devices: when staff switch back to a tab
      // (or a component remounts), refetch data that's older than staleTime. This
      // is how an admin sees a redeem that happened on another screen.
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 10_000, // 10s: fresh enough to avoid a refetch storm, stale enough to update on focus
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Shared login — everyone must sign in. */}
            <Route path="/login" element={<Login />} />

            {/* Kiosk flow — any logged-in user (staff or admin). */}
            <Route
              element={
                <RequireAuth>
                  <KioskFlowProvider>
                    <Outlet />
                  </KioskFlowProvider>
                </RequireAuth>
              }
            >
              <Route path="/" element={<PhoneEntry />} />
              {/* Assigning this tablet's branch is admin-only; staff view it
                  read-only in the kiosk header. Wrapped in RequireAdmin so a
                  staff account is bounced with "not authorized". */}
              <Route
                path="/kiosk/setup"
                element={
                  <RequireAdmin>
                    <BranchSetup />
                  </RequireAdmin>
                }
              />
              <Route path="/kiosk/name" element={<NameEntry />} />
              <Route path="/kiosk/services" element={<ServiceSelection />} />
              <Route path="/kiosk/success" element={<Success />} />
            </Route>

            {/* Admin — admins only. */}
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
              <Route path="checkins" element={<DailyCheckins />} />
              <Route path="services" element={<ServicesManage />} />
              <Route path="groups" element={<GroupsManage />} />
              <Route path="branches" element={<BranchesManage />} />
              <Route path="loyalty" element={<LoyaltySettings />} />
              <Route path="sms-templates" element={<SmsTemplates />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
