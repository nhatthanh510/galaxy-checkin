import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Checkin,
  CheckinRow,
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
  checkins: Checkin[]
  transactions: LoyaltyTransaction[]
}

// Admin: fetch a customer with their visit history + loyalty transactions.
export function useCustomer(id: string | undefined) {
  return useQuery<CustomerDetail>({
    queryKey: ['customer', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const supabase = getSupabase()
      const [{ data: cust, error: e1 }, { data: chk, error: e2 }, { data: tx, error: e3 }] =
        await Promise.all([
          supabase.from('customer').select('*').eq('id', id).single(),
          supabase
            .from('checkin')
            .select('*')
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

      return {
        customer: mapCustomer(cust as CustomerRow),
        checkins: (chk as CheckinRow[]).map((r) => ({
          id: r.id,
          customerId: r.customer_id,
          serviceIds: [],
          technicianId: r.technician_id,
          status: r.status,
          createdAt: r.created_at,
        })),
        transactions: (tx as LoyaltyTransactionRow[]).map(mapLoyaltyTransaction),
      }
    },
  })
}

export interface UpdateCustomerInput {
  id: string
  name: string
  pointsBalance: number
}

// Admin: update a customer's editable fields.
export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation<Customer, Error, UpdateCustomerInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase()
        .from('customer')
        .update({ name: input.name, points_balance: input.pointsBalance })
        .eq('id', input.id)
        .select('*')
        .single()
      if (error) throw error
      return mapCustomer(data as CustomerRow)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['customer', vars.id] })
      qc.invalidateQueries({ queryKey: customersKey })
    },
  })
}
