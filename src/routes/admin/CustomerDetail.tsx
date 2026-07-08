import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useCustomer,
  useUpdateCustomer,
  useActiveLoyaltyPrograms,
  useRedeemPoints,
  useClaimBirthday,
  useSettings,
} from '../../lib/queries'
import type {
  CheckinHistoryItem,
  Customer,
  LoyaltyProgram,
  LoyaltyTransaction,
} from '../../types'
import { formatPhone } from '../../lib/phone'
import { formatReward } from '../../lib/reward'
import { customerTier, tierBadge } from '../../lib/tier'
import { Pagination } from '../../components/Pagination'
import { usePagination } from '../../components/usePagination'
import {
  BirthdayDropdowns,
} from '../../components/BirthdayDropdowns'
import {
  birthdayStatus,
  birthdayStatusBadge,
  dateStringToParts,
  formatBirthday,
  partsToDateString,
  shouldRemindBirthday,
} from '../../lib/birthday'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useCustomer(id)
  const { data: settings } = useSettings()

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>
  if (!data) return null

  const { customer, checkins, transactions } = data
  const tier = customerTier(customer.lifetimePoints)
  const detailTier = tier ? tierBadge(tier) : null
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
      </div>
      <p className="text-slate-500">{formatPhone(customer.phone)}</p>

      {/* Editable fields — keyed by id so the form re-seeds per customer. */}
      <ProfileForm key={customer.id} customer={customer} />

      <VisitHistory checkins={checkins} />
      <LoyaltyTransactions transactions={transactions} />
    </div>
  )
}

// Paginated visit-history table.
function VisitHistory({ checkins }: { checkins: CheckinHistoryItem[] }) {
  const { page, pageCount, pageItems, setPage, canPrev, canNext } = usePagination(checkins, 10)

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 p-4 text-lg font-semibold">
        Visit history ({checkins.length})
      </h2>
      {checkins.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">No visits yet.</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Services</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => (
                <VisitRow key={c.id} visit={c} />
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageCount={pageCount}
            canPrev={canPrev}
            canNext={canNext}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}

// Paginated loyalty-transactions table.
function LoyaltyTransactions({ transactions }: { transactions: LoyaltyTransaction[] }) {
  const { page, pageCount, pageItems, setPage, canPrev, canNext } = usePagination(
    transactions,
    10,
  )

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 p-4 text-lg font-semibold">
        Loyalty transactions ({transactions.length})
      </h2>
      {transactions.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">No transactions yet.</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{t.reason}</td>
                  <td
                    className={
                      'px-4 py-2 text-right font-medium ' +
                      (t.amount >= 0 ? 'text-emerald-600' : 'text-red-600')
                    }
                  >
                    {t.amount >= 0 ? '+' : ''}
                    {t.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageCount={pageCount}
            canPrev={canPrev}
            canNext={canNext}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}

// Editable profile form, seeded directly from props (no effect). The parent
// gates on load and keys this by customer id so it re-initializes per customer.
function ProfileForm({ customer }: { customer: Customer }) {
  const update = useUpdateCustomer()
  const { data: programs } = useActiveLoyaltyPrograms()
  const { data: settings } = useSettings()
  const redeem = useRedeemPoints()
  const claimBirthday = useClaimBirthday()
  const [name, setName] = useState(customer.name)
  const [points, setPoints] = useState(String(customer.pointsBalance))
  const [lifetimePoints, setLifetimePoints] = useState(String(customer.lifetimePoints))
  const [birthday, setBirthday] = useState(dateStringToParts(customer.birthday))
  const [saved, setSaved] = useState(false)
  const [redeemedMsg, setRedeemedMsg] = useState<string | null>(null)
  const [bdayClaimed, setBdayClaimed] = useState(false)
  // Live balance for eligibility (updates after each redeem without a refetch).
  const [balance, setBalance] = useState(customer.pointsBalance)
  const currentYear = new Date().getFullYear()

  // Birthday claim availability: in the window and not yet claimed this year.
  const bdayRemind =
    settings != null &&
    shouldRemindBirthday(
      customer.birthday,
      customer.birthdayRedeemedYear,
      new Date(),
      settings.birthdayDaysBefore,
      settings.birthdayDaysAfter,
    ) &&
    !bdayClaimed

  const onClaimBirthday = async () => {
    await claimBirthday.mutateAsync(customer.id)
    setBdayClaimed(true)
  }

  const onSave = async () => {
    setSaved(false)
    const updated = await update.mutateAsync({
      id: customer.id,
      name: name.trim(),
      pointsBalance: Number(points) || 0,
      birthday: partsToDateString(birthday),
      lifetimePoints: Number(lifetimePoints) || 0,
    })
    // Reflect the saved values so the section recomputes.
    setBalance(updated.pointsBalance)
    setPoints(String(updated.pointsBalance))
    setLifetimePoints(String(updated.lifetimePoints))
    setSaved(true)
  }

  // Points-triggered programs the customer can redeem from admin. Admin requires
  // the balance to be STRICTLY above the threshold (> N, not >= N): staff can't
  // tell whether a point was earned on today's visit, so redeeming is only
  // offered above the threshold. The kiosk uses >= N (reaching the kiosk redeem
  // screen is itself a later check-in). Date-window/standing promos aren't
  // points-redeemable — the birthday claim has its own control below.
  const eligiblePrograms = (programs ?? []).filter(
    (p) => p.triggerType === 'points' && balance > p.pointsPerReward,
  )

  const onRedeem = async (program: LoyaltyProgram) => {
    setRedeemedMsg(null)
    const result = await redeem.mutateAsync({
      customerId: customer.id,
      programId: program.id,
    })
    setBalance(result.pointsBalance)
    setPoints(String(result.pointsBalance))
    setRedeemedMsg(
      `Redeemed ${result.redeemedPoints} points from "${program.name}" for ${formatReward(result.rewardType, result.rewardValue)}. New balance: ${result.pointsBalance}.`,
    )
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Profile</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Points balance</span>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Lifetime points</span>
          <input
            type="number"
            value={lifetimePoints}
            onChange={(e) => setLifetimePoints(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <span className="mt-1 block text-xs text-slate-400">Total earned (drives tier).</span>
        </label>
      </div>
      <div className="mt-4">
        <span className="text-sm font-medium text-slate-600">
          Birthday <span className="font-normal text-slate-400">({formatBirthday(customer.birthday)})</span>
        </span>
        <div className="mt-1">
          <BirthdayDropdowns value={birthday} onChange={setBirthday} variant="light" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={update.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
        {update.error && <span className="text-sm text-red-600">{update.error.message}</span>}
      </div>

      {/* Redeem rewards (staff-applied) — one button per eligible program. */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-600">
          Redeemable rewards <span className="font-normal text-slate-400">({balance} pts)</span>
        </h3>
        {eligiblePrograms.length === 0 ? (
          <p className="text-sm text-slate-400">
            {(programs ?? []).length === 0
              ? 'No active loyalty program.'
              : 'Not enough points for any reward yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {eligiblePrograms.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <button
                  onClick={() => onRedeem(p)}
                  disabled={redeem.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {redeem.isPending ? 'Redeeming…' : `Redeem ${p.name}`}
                </button>
                <span className="text-sm text-slate-500">
                  {p.pointsPerReward} pts → {formatReward(p.rewardType, p.rewardValue)}
                </span>
              </div>
            ))}
          </div>
        )}
        {redeemedMsg && <p className="mt-2 text-sm text-emerald-600">{redeemedMsg}</p>}
        {redeem.error && <p className="mt-2 text-sm text-red-600">{redeem.error.message}</p>}
      </div>

      {/* Birthday discount — mark used this year (hides the reminder). */}
      {bdayRemind && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClaimBirthday}
              disabled={claimBirthday.isPending}
              className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-50"
            >
              {claimBirthday.isPending ? 'Marking…' : '🎂 Mark birthday discount used'}
            </button>
            <span className="text-sm text-slate-500">
              Records the birthday benefit as claimed for {currentYear}.
            </span>
          </div>
          {claimBirthday.error && (
            <p className="mt-2 text-sm text-red-600">{claimBirthday.error.message}</p>
          )}
        </div>
      )}
      {bdayClaimed && (
        <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-pink-600">
          🎉 Birthday discount marked as used for {currentYear}.
        </p>
      )}
    </div>
  )
}

// One row of the visit-history table.
function VisitRow({ visit }: { visit: CheckinHistoryItem }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2 text-slate-600">
        {new Date(visit.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-2 text-slate-600">
        {visit.serviceNames.length > 0 ? visit.serviceNames.join(', ') : '—'}
      </td>
      <td className="px-4 py-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {visit.status}
        </span>
      </td>
    </tr>
  )
}
