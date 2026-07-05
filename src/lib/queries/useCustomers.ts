import { useQuery } from '@tanstack/react-query'
import type { Customer, CustomerRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapCustomer } from './mappers'

export const customersKey = ['customers'] as const

// Admin: list all customers. Requires an authenticated admin session (RLS).
export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: customersKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('customer')
        .select('*')
        .order('name')
      if (error) throw error
      return (data as CustomerRow[]).map(mapCustomer)
    },
  })
}
