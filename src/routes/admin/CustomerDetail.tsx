import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCustomer, useUpdateCustomer } from '../../lib/queries'
import { formatPhone } from '../../lib/phone'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useCustomer(id)
  const update = useUpdateCustomer()

  const [name, setName] = useState('')
  const [points, setPoints] = useState('0')
  const [saved, setSaved] = useState(false)

  // Seed the form once the customer loads.
  useEffect(() => {
    if (data?.customer) {
      setName(data.customer.name)
      setPoints(String(data.customer.pointsBalance))
    }
  }, [data?.customer])

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>
  if (!data) return null

  const { customer, checkins, transactions } = data

  const onSave = async () => {
    setSaved(false)
    await update.mutateAsync({
      id: customer.id,
      name: name.trim(),
      pointsBalance: Number(points) || 0,
    })
    setSaved(true)
  }

  return (
    <div className="max-w-3xl">
      <Link to="/admin/customers" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to customers
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{customer.name}</h1>
      <p className="text-slate-500">{formatPhone(customer.phone)}</p>

      {/* Editable fields */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Points balance</span>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={update.isPending}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved</span>}
          {update.error && <span className="text-sm text-red-600">{update.error.message}</span>}
        </div>
      </div>

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
