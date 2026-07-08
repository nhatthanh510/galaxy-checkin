// Shared domain (camelCase) types. These mirror the Supabase schema in
// supabase/migrations/*. The DB uses snake_case; hooks map rows to these shapes
// via src/lib/queries/mappers.ts. DB row types live at the bottom of this file.

export interface Customer {
  id: string
  phone: string // primary lookup key, digits only
  name: string
  visitCount: number
  pointsBalance: number // current redeemable points
  lifetimePoints: number // total points earned over history, before redemptions
  lastVisitAt: string | null // ISO timestamp of most recent visit, or null
  birthday: string | null // "YYYY-MM-DD" or null
  birthdayRedeemedYear: number | null // year the birthday benefit was last claimed
  marketingConsent: boolean // opted in to marketing SMS
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
}

// App-wide configurable settings (single row).
export interface AppSettings {
  birthdayDaysBefore: number
  birthdayDaysAfter: number
}

// One row of a customer's visit history, with resolved service names.
export interface CheckinHistoryItem {
  id: string
  status: CheckinStatus
  createdAt: string
  serviceNames: string[]
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
  last_visit_at?: string | null
  birthday: string | null
  birthday_redeemed_year: number | null
  marketing_consent?: boolean
  created_at?: string
}

export interface AppSettingsRow {
  birthday_days_before: number
  birthday_days_after: number
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
}
