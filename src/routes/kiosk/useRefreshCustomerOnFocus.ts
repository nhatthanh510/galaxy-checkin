import { useEffect } from 'react'
import { getSupabase } from '../../lib/supabase'
import type { CustomerRow } from '../../types'
import { mapCustomer } from '../../lib/queries/mappers'
import { useKioskFlow } from './useKioskFlow'

// The kiosk holds the matched customer in flow state (from a mutation lookup,
// not a TanStack query), so refetch-on-focus doesn't cover it. This re-looks-up
// the active customer by phone when the tab regains focus / becomes visible, so
// an external redeem (e.g. staff redeeming on the admin side) is reflected on
// the kiosk without a manual refresh.
export function useRefreshCustomerOnFocus() {
  const flow = useKioskFlow()
  const { customer, setCustomer } = flow

  useEffect(() => {
    if (!customer) return
    const phone = customer.phone

    const refresh = async () => {
      try {
        const { data, error } = await getSupabase().rpc('lookup_customer_by_phone', {
          p_phone: phone,
        })
        if (error) return
        const rows = (data ?? []) as CustomerRow[]
        if (rows.length > 0) setCustomer(mapCustomer(rows[0]))
      } catch {
        // Non-critical; leave the current snapshot if the refresh fails.
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [customer, setCustomer])
}
