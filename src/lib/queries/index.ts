// Kiosk (customer-facing) hooks.
export { useServices } from './useServices'
export { useTechnicians } from './useTechnicians'
export { useLoyaltyProgram, loyaltyProgramKey } from './useLoyaltyProgram'
export { useCustomerLookup } from './useCustomerLookup'
export { useCreateCheckin } from './useCreateCheckin'

// Admin hooks.
export { useCustomers, customersKey } from './useCustomers'
export { useCustomer, useUpdateCustomer } from './useCustomer'
export type { CustomerDetail, UpdateCustomerInput } from './useCustomer'
export { useUpsertCustomers } from './useUpsertCustomers'
export type { ImportCustomer } from './useUpsertCustomers'
export { useUpdateLoyaltyProgram } from './useUpdateLoyaltyProgram'
export type { UpdateLoyaltyProgramInput } from './useUpdateLoyaltyProgram'
