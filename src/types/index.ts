// Shared domain (camelCase) types. These mirror the Supabase schema in
// supabase/migrations/*. The DB uses snake_case; hooks map rows to these shapes
// via src/lib/queries/mappers.ts. DB row types live at the bottom of this file.

import type { CustomerTier } from '../lib/tier'

export type { CustomerTier }

export interface Customer {
  id: string
  phone: string // primary lookup key, digits only
  name: string
  visitCount: number
  pointsBalance: number // current redeemable points
  lifetimePoints: number // total points earned over history, before redemptions
  tier: CustomerTier // persisted, activity-maintained tier (decays with inactivity)
  tierLocked: boolean // admin pin: exempt from the automatic decay/upgrade flow
  lastVisitAt: string | null // ISO timestamp of most recent visit, or null
  lastVisitBranchName: string | null // branch of the most recent visit (null if none/branchless)
  birthday: string | null // "YYYY-MM-DD" or null
  birthdayRedeemedYear: number | null // year the birthday benefit was last claimed
  marketingConsent: boolean // opted in to marketing SMS
  notes: string // staff-only freeform notes (allergies, prefs); never shown on kiosk
}

export interface ServiceGroup {
  id: string
  name: string
  active: boolean
}

export interface Service {
  id: string
  name: string
  category: string
  groupId: string | null
  price: number // in dollars
  durationMinutes: number
  active: boolean
}

// A physical salon branch (e.g. Kings Meadows, Brisbane). Belongs to a *visit*,
// not a customer — each check-in stamps where it happened. Admins manage these
// in /admin/branches; a kiosk tablet stores its branch `slug` in localStorage.
export interface Branch {
  id: string
  name: string
  slug: string // stable kebab-case id the tablet stores
  active: boolean
}

export type CheckinStatus = 'waiting' | 'in_service' | 'completed' | 'cancelled'

export interface Checkin {
  id: string
  customerId: string
  serviceIds: string[]
  status: CheckinStatus
  createdAt: string // ISO timestamp
}

// SMS marketing --------------------------------------------------------------

export type NotificationKind = 'checkin' | 'marketing' | 'birthday'

// A reusable, admin-authored SMS body. {{name}} / {{reward}} placeholders are
// interpolated at send time.
export interface SmsTemplate {
  id: string
  name: string
  body: string
  kind: NotificationKind
  createdAt: string
  updatedAt: string
}

export interface SmsTemplateRow {
  id: string
  name: string
  body: string
  kind: NotificationKind
  created_at: string
  updated_at: string
}

export type RewardType = 'fixed' | 'percent'

// How a promotion becomes claimable (the reward itself — reward_type/value — is
// orthogonal). Birthday is just a date_window trigger anchored on the birthday.
//   'points'      — customer has >= pointsPerReward points
//   'date_window' — today is within the anchor-date window, once per year
//   'always'      — any visit (standing promo / welcome offer)
export type PromotionTrigger = 'points' | 'date_window' | 'always'

// Which customer date a date_window trigger anchors on ('birthday' for now).
export type PromotionDateAnchor = 'birthday'

export interface LoyaltyProgram {
  id: string
  name: string // e.g. "10 Point"
  description: string // e.g. "10 points get $10 off"
  triggerType: PromotionTrigger // points | date_window | always
  dateAnchor: PromotionDateAnchor | null // set when triggerType = 'date_window'
  windowBeforeDays: number // date_window: days before the anchor date
  windowAfterDays: number // date_window: days after the anchor date
  pointsPerReward: number // redemption threshold (points trigger; 0 otherwise)
  rewardType: RewardType // 'fixed' = $ off, 'percent' = % off
  rewardValue: number // dollars (fixed) or percent (percent)
  active: boolean
}

export interface LoyaltyTransaction {
  id: string
  customerId: string
  checkinId: string | null
  amount: number // signed: positive = earned, negative = redeemed
  reason: string
  createdAt: string // ISO timestamp
}

// Payload the kiosk flow hands to useCreateCheckin. The customer is created
// first when `customerId` is null (a new phone number).
export interface CreateCheckinInput {
  phone: string
  name: string
  customerId: string | null
  serviceIds: string[]
  birthday: string | null // "YYYY-MM-DD" or null
  consent: boolean // marketing-contact consent (not required to check in)
  // Award the +1 check-in point? False when the customer redeemed a points
  // reward this visit (a redeemed visit doesn't earn). Defaults to true.
  awardPoint?: boolean
  // Which branch this tablet is assigned to (null when unassigned — the check-in
  // is then recorded with no branch).
  branchId: string | null
}

// App-wide configurable settings (single row).
export interface AppSettings {
  birthdayDaysBefore: number
  birthdayDaysAfter: number
  // Birthday discount percent by loyalty tier (New / Regular / VIP). The
  // birthday reward's percent off is chosen by the customer's tier, not by the
  // program's reward_value. See src/lib/tier.ts.
  birthdayPercentNew: number
  birthdayPercentRegular: number
  birthdayPercentVip: number
  // Tier maintenance: a customer keeps a tier only while they visit enough
  // within a rolling window. Fewer than *MinVisits* check-ins in the last
  // *WindowMonths* months drops them one tier level per monthly review.
  tierWindowMonths: number
  tierVipMinVisits: number
  tierRegularMinVisits: number
}

// Tier change audit --------------------------------------------------------

// Where a tier change came from: the monthly review (usually a decay), a
// check-in recompute (usually an upgrade / recovery), or a manual admin set.
export type TierChangeSource = 'review' | 'checkin' | 'manual'

// One logged automatic tier movement, with the customer resolved for display.
export interface TierChange {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  fromTier: CustomerTier
  toTier: CustomerTier
  source: TierChangeSource
  visitsInWindow: number | null
  createdAt: string // ISO timestamp
}

// One projected change from a dry-run review preview (before it's applied).
export interface TierReviewPreviewItem {
  customerId: string
  name: string
  phone: string
  fromTier: CustomerTier
  toTier: CustomerTier
  visitsInWindow: number | null
  lastVisitAt: string | null
}

export interface TierChangeRow {
  id: string
  customer_id: string
  from_tier: CustomerTier
  to_tier: CustomerTier
  source: TierChangeSource
  visits_in_window: number | null
  created_at: string
  // Embedded FK join to the customer (name + phone), when the select requests it.
  customer: { name: string; phone: string } | null
}

// One row of a customer's visit history, with resolved service names.
export interface CheckinHistoryItem {
  id: string
  status: CheckinStatus
  createdAt: string
  serviceNames: string[]
  branchName: string | null // where the visit happened (null = unassigned)
}

export interface CreateCheckinResult {
  checkin: Checkin
  customer: Customer
}

// ---------------------------------------------------------------------------
// DB row shapes (snake_case, as returned by Supabase). Mapped to the camelCase
// domain types above by src/lib/queries/mappers.ts.
// ---------------------------------------------------------------------------

export interface CustomerRow {
  id: string
  phone: string
  name: string
  visit_count: number
  points_balance: number
  lifetime_points?: number
  tier?: CustomerTier
  tier_locked?: boolean
  last_visit_at?: string | null
  birthday: string | null
  birthday_redeemed_year: number | null
  marketing_consent?: boolean
  notes?: string
  created_at?: string
  // Embedded FK join to the last-visit branch (name only). Present only when the
  // select requests it; a branchless/absent last visit yields null.
  last_visit_branch?: { name: string } | null
}

export interface AppSettingsRow {
  birthday_days_before: number
  birthday_days_after: number
  birthday_percent_new: number
  birthday_percent_regular: number
  birthday_percent_vip: number
  tier_window_months: number
  tier_vip_min_visits: number
  tier_regular_min_visits: number
}

export interface ServiceRow {
  id: string
  name: string
  category: string
  group_id: string | null
  price: number
  duration_minutes: number
  active?: boolean
}

export interface ServiceGroupRow {
  id: string
  name: string
  active: boolean
}

export interface LoyaltyProgramRow {
  id: string
  name: string
  description: string
  points_per_reward: number
  reward_type: RewardType
  reward_value: number
  reward_amount?: number // legacy column, kept in sync
  trigger_type?: PromotionTrigger
  date_anchor?: PromotionDateAnchor | null
  window_before_days?: number
  window_after_days?: number
  active: boolean
}

export interface CheckinRow {
  id: string
  customer_id: string
  status: CheckinStatus
  created_at: string
  branch_id?: string | null
}

export interface BranchRow {
  id: string
  name: string
  slug: string
  active: boolean
  created_at?: string
}

export interface LoyaltyTransactionRow {
  id: string
  customer_id: string
  checkin_id: string | null
  amount: number
  reason: string
  created_at: string
}

// Result row of the create_checkin RPC.
export interface CreateCheckinRpcRow {
  checkin_id: string
  customer_id: string
  customer_name: string
  points_balance: number
  visit_count: number
  lifetime_points: number
  tier: CustomerTier
}
