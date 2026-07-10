import { Link, useParams } from 'react-router-dom'
import { useCustomer, useSettings } from '../../lib/queries'
import { formatPhone } from '../../lib/phone'
import { birthdayPercentForTier, customerTier, tierBadge, tierName } from '../../lib/tier'
import { birthdayStatus, birthdayStatusBadge } from '../../lib/birthday'
import { ProfileForm } from './CustomerProfileForm'
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
  const tier = customerTier(customer.lifetimePoints)
  const detailTier = tierBadge(tier)
  // The birthday discount this customer gets, by tier — so staff/admin know the
  // exact percent (matches what the kiosk shows and the birthday SMS sends).
  const birthdayPct = settings
    ? birthdayPercentForTier(customer.lifetimePoints, {
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

      <VisitHistory checkins={checkins} />
      <LoyaltyTransactions transactions={transactions} />
      <DangerZone customer={customer} />
    </div>
  )
}
