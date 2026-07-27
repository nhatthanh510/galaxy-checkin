import { Link, useParams } from 'react-router-dom'
import { useCustomer, useSettings } from '../../lib/queries'
import { formatPhone } from '../../lib/phone'
import {
  birthdayPercentForTierName,
  customerTier,
  tierBadge,
  tierName,
  tierRank,
} from '../../lib/tier'
import { birthdayStatus, birthdayStatusBadge } from '../../lib/birthday'
import { ProfileForm } from './CustomerProfileForm'
import { CustomerTierControl } from './CustomerTierControl'
import { VisitHistory, LoyaltyTransactions } from './CustomerTables'
import { DangerZone } from './CustomerDangerZone'
import { FormSkeleton } from '../../components/ui/Skeleton'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useCustomer(id)
  const { data: settings } = useSettings()

  if (isLoading) return <FormSkeleton fields={4} />
  if (error) return <p className="text-red-600">{error.message}</p>
  if (!data) return null

  const { customer, checkins, transactions } = data
  const tier = customer.tier
  const detailTier = tierBadge(tier)
  // The customer's stored tier sitting BELOW the tier their lifetime points would
  // earn means they've been downgraded for inactivity (migration 0017). Surface
  // it so staff understand why an otherwise high-points customer shows a lower
  // badge — and get their VIP/Regular back by visiting again.
  const earnedTier = customerTier(customer.lifetimePoints)
  // Only an *automatic* decay (not a manual lock) shows the inactivity hint.
  const downgraded = !customer.tierLocked && tierRank(tier) < tierRank(earnedTier)
  // The birthday discount this customer gets, by tier — so staff/admin know the
  // exact percent (matches what the kiosk shows and the birthday SMS sends).
  const birthdayPct = settings
    ? birthdayPercentForTierName(tier, {
        new: settings.birthdayPercentNew,
        regular: settings.birthdayPercentRegular,
        vip: settings.birthdayPercentVip,
      })
    : null
  const tierLabel = tierName(tier)
  const bdayBadge = settings
    ? birthdayStatusBadge(
        birthdayStatus(
          customer.birthday,
          customer.birthdayRedeemedYear,
          new Date(),
          settings.birthdayDaysBefore,
          settings.birthdayDaysAfter,
        ),
      )
    : null

  return (
    <div className="max-w-3xl">
      <Link to="/admin/customers" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to customers
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        {detailTier && (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${detailTier.className}`}
          >
            {detailTier.label}
          </span>
        )}
        {downgraded && (
          <span
            className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-200"
            title="Tier lowered because recent visits fell below the maintenance threshold. Visiting more restores it."
          >
            ↓ Lowered for inactivity — earned {tierName(earnedTier)}
          </span>
        )}
        {customer.tierLocked && (
          <span
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
            title="An admin pinned this tier; the automatic decay/upgrade flow skips this customer."
          >
            🔒 Tier locked
          </span>
        )}
        {bdayBadge && (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${bdayBadge.className}`}
          >
            {bdayBadge.label}
          </span>
        )}
        {birthdayPct != null && (
          <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-medium text-pink-700">
            🎂 {birthdayPct}% off birthday ({tierLabel} tier)
          </span>
        )}
      </div>
      <p className="text-slate-500">{formatPhone(customer.phone)}</p>

      {/* Editable fields — keyed by id so the form re-seeds per customer. */}
      <ProfileForm key={customer.id} customer={customer} />

      <CustomerTierControl
        key={`tier-${customer.id}`}
        customer={customer}
        checkins={checkins}
        settings={settings}
      />

      <VisitHistory checkins={checkins} />
      <LoyaltyTransactions transactions={transactions} />
      <DangerZone customer={customer} />
    </div>
  )
}
