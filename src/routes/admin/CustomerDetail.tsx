import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useCustomer,
  useUpdateCustomer,
  useLoyaltyProgram,
  useRedeemPoints,
} from '../../lib/queries'
import type { Customer } from '../../types'
import { formatPhone } from '../../lib/phone'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useCustomer(id)

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>
  if (!data) return null

  const { customer, checkins, transactions } = data

  return (
    <div className="max-w-3xl">
      <Link to="/admin/customers" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to customers
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{customer.name}</h1>
      <p className="text-slate-500">{formatPhone(customer.phone)}</p>

      {/* Editable fields — keyed by id so the form re-seeds per customer. */}
      <ProfileForm key={customer.id} customer={customer} />

      {/* Visit history */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Visit history ({checkins.length})</h2>
        {checkins.length === 0 ? (
          <p className="text-sm text-slate-400">No visits yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {checkins.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
                <span className="text-slate-600">{new Date(c.createdAt).toLocaleString()}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Loyalty transactions */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Loyalty transactions ({transactions.length})</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400">No transactions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {transactions.map((t) => (
              <li key={t.id} className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
                <span className="text-slate-600">{t.reason}</span>
                <span className={t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {t.amount >= 0 ? '+' : ''}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Editable profile form, seeded directly from props (no effect). The parent
// gates on load and keys this by customer id so it re-initializes per customer.
function ProfileForm({ customer }: { customer: Customer }) {
  const update = useUpdateCustomer()
  const { data: program } = useLoyaltyProgram()
  const redeem = useRedeemPoints()
  const [name, setName] = useState(customer.name)
  const [points, setPoints] = useState(String(customer.pointsBalance))
  const [saved, setSaved] = useState(false)
  const [redeemedMsg, setRedeemedMsg] = useState<string | null>(null)

  const onSave = async () => {
    setSaved(false)
    await update.mutateAsync({
      id: customer.id,
      name: name.trim(),
      pointsBalance: Number(points) || 0,
    })
    setSaved(true)
  }

  const canRedeem =
    program != null && customer.pointsBalance >= program.pointsPerReward

  const onRedeem = async () => {
    if (!program) return
    setRedeemedMsg(null)
    const result = await redeem.mutateAsync(customer.id)
    setRedeemedMsg(
      `Redeemed ${result.redeemedPoints} points for $${result.rewardAmount} off. New balance: ${result.pointsBalance}.`,
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

      {/* Redeem reward (staff-applied). Enabled only at/over the threshold. */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onRedeem}
            disabled={!canRedeem || redeem.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {redeem.isPending ? 'Redeeming…' : 'Redeem reward'}
          </button>
          <span className="text-sm text-slate-500">
            {program
              ? canRedeem
                ? `Eligible: ${program.pointsPerReward} pts → $${program.rewardAmount} off`
                : `Needs ${program.pointsPerReward} pts (has ${customer.pointsBalance})`
              : 'No active loyalty program'}
          </span>
        </div>
        {redeemedMsg && <p className="mt-2 text-sm text-emerald-600">{redeemedMsg}</p>}
        {redeem.error && <p className="mt-2 text-sm text-red-600">{redeem.error.message}</p>}
      </div>
    </div>
  )
}
