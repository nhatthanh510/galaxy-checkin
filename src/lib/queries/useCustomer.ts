import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CheckinHistoryItem,
  CheckinStatus,
  Customer,
  CustomerRow,
  LoyaltyTransaction,
  LoyaltyTransactionRow,
} from '../../types'
import { getSupabase } from '../supabase'
import { mapCustomer, mapLoyaltyTransaction } from './mappers'
import { customersKey } from './useCustomers'

export interface CustomerDetail {
  customer: Customer
  checkins: CheckinHistoryItem[]
  transactions: LoyaltyTransaction[]
}

// Shape returned by the joined checkin select below.
interface CheckinJoinRow {
  id: string
  status: CheckinStatus
  created_at: string
  checkin_service: { service: { name: string } | null }[]
}

// Admin: fetch a customer with their visit history (services resolved) and
// loyalty transactions.
export function useCustomer(id: string | undefined) {
  return useQuery<CustomerDetail>({
    queryKey: ['customer', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const supabase = getSupabase()
      const [{ data: cust, error: e1 }, { data: chk, error: e2 }, { data: tx, error: e3 }] =
        await Promise.all([
          supabase.from('customer').select('*').eq('id', id).single(),
          // Join service names via the checkin_service link.
          supabase
            .from('checkin')
            .select(
              'id, status, created_at, checkin_service(service:service_id(name))',
            )
            .eq('customer_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('loyalty_transaction')
            .select('*')
            .eq('customer_id', id)
            .order('created_at', { ascending: false }),
        ])
      if (e1) throw e1
      if (e2) throw e2
      if (e3) throw e3

      const checkins: CheckinHistoryItem[] = (chk as unknown as CheckinJoinRow[]).map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        serviceNames: (r.checkin_service ?? [])
          .map((cs) => cs.service?.name)
          .filter((n): n is string => Boolean(n)),
      }))

      return {
        customer: mapCustomer(cust as CustomerRow),
        checkins,
        transactions: (tx as LoyaltyTransactionRow[]).map(mapLoyaltyTransaction),
      }
    },
  })
}

export interface UpdateCustomerInput {
  id: string
  name: string
  pointsBalance: number
  birthday: string | null
  lifetimePoints: number
  notes: string
}

// Admin: update a customer's editable fields via the admin_update_customer RPC,
// which writes a loyalty_transaction adjustment when points change (so the
// balance and the ledger stay consistent).
export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation<Customer, Error, UpdateCustomerInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase().rpc('admin_update_customer', {
        p_customer_id: input.id,
        p_name: input.name,
        p_points_balance: input.pointsBalance,
        p_birthday: input.birthday,
        p_lifetime_points: input.lifetimePoints,
        p_notes: input.notes,
      })
      if (error) throw error
      return mapCustomer(data as CustomerRow)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['customer', vars.id] })
      qc.invalidateQueries({ queryKey: customersKey })
    },
  })
}

// Admin: permanently delete a customer. RLS ("admin manages customer", FOR ALL)
// already authorizes this for admins. The DB cascades remove the customer's
// check-ins and loyalty transactions, and null out notification references
// (see the FK definitions in 0001_init.sql) — the confirm dialog warns about it.
export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await getSupabase().from('customer').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: customersKey })
    },
  })
}
