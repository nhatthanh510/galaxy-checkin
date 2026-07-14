// Kiosk (customer-facing) hooks.
export { useServices } from './useServices'
export {
  useLoyaltyProgram,
  useActiveLoyaltyPrograms,
  loyaltyProgramKey,
  activeLoyaltyProgramsKey,
} from './useLoyaltyProgram'
export { useCustomerLookup, useCheckedInToday } from './useCustomerLookup'
export { useCreateCheckin, AlreadyCheckedInTodayError } from './useCreateCheckin'
export { useRedeemPoints } from './useRedeemPoints'
export type { RedeemResult, RedeemInput } from './useRedeemPoints'

// Admin hooks.
export { useCustomers, customersKey } from './useCustomers'
export { useCheckinCustomerIdsOnDate } from './useCheckinsOnDate'
export { useCustomer, useUpdateCustomer, useDeleteCustomer } from './useCustomer'
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


// App settings (birthday window).
export { useSettings, useUpdateSettings, settingsKey } from './useSettings'

// Branches (admin CRUD; kiosk read + device-branch resolution).
export {
  useBranches,
  useDeviceBranch,
  useCreateBranch,
  useUpdateBranch,
  branchesKey,
} from './useBranches'

// Daily check-ins report (admin).
export { useCheckinsReport } from './useCheckinsReport'
export type { CheckinReportRow } from './useCheckinsReport'

// Service groups (admin CRUD; kiosk read).
export {
  useServiceGroups,
  useCreateServiceGroup,
  useUpdateServiceGroup,
  useDeleteServiceGroup,
  serviceGroupsKey,
} from './useServiceGroups'
export type { ServiceGroupInput } from './useServiceGroups'

// Birthday benefit claim.
export { useClaimBirthday } from './useClaimBirthday'

// SMS templates (admin CRUD) + marketing campaign send.
export {
  useSmsTemplates,
  useCreateSmsTemplate,
  useUpdateSmsTemplate,
  useDeleteSmsTemplate,
  smsTemplatesKey,
} from './useSmsTemplates'
export type { SmsTemplateInput } from './useSmsTemplates'
export { useSendCampaign } from './useSendCampaign'
export type { SendCampaignInput, CampaignResult } from './useSendCampaign'
