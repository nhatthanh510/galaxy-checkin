// Kiosk (customer-facing) hooks.
export { useServices } from './useServices'
export { useTechnicians } from './useTechnicians'
export { useLoyaltyProgram, loyaltyProgramKey } from './useLoyaltyProgram'
export { useCustomerLookup } from './useCustomerLookup'
export { useCreateCheckin } from './useCreateCheckin'
export { useRedeemPoints } from './useRedeemPoints'
export type { RedeemResult } from './useRedeemPoints'

// Admin hooks.
export { useCustomers, customersKey } from './useCustomers'
export { useCustomer, useUpdateCustomer } from './useCustomer'
export type { CustomerDetail, UpdateCustomerInput } from './useCustomer'
export { useUpsertCustomers } from './useUpsertCustomers'
export type { ImportCustomer } from './useUpsertCustomers'

// Loyalty program CRUD (admin).
export {
  useLoyaltyPrograms,
  useCreateLoyaltyProgram,
  useUpdateLoyaltyProgramCrud,
  useDeleteLoyaltyProgram,
  loyaltyProgramsKey,
} from './useLoyaltyPrograms'
export type { LoyaltyProgramInput } from './useLoyaltyPrograms'

// Service CRUD (admin).
export {
  useServicesAdmin,
  useCreateService,
  useUpdateService,
  useDeleteService,
  servicesAdminKey,
} from './useServicesAdmin'
export type { ServiceInput } from './useServicesAdmin'

// Technician CRUD (admin).
export {
  useTechniciansAdmin,
  useCreateTechnician,
  useUpdateTechnician,
  useDeleteTechnician,
  techniciansAdminKey,
} from './useTechniciansAdmin'
export type { TechnicianInput } from './useTechniciansAdmin'
