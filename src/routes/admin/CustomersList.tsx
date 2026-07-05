import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../../lib/queries'
import { downloadCsv, toCsv } from '../../lib/csv'
import { formatPhone } from '../../lib/phone'

// CSV column order shared by export + import.
export const CSV_HEADERS = ['phone', 'name', 'points_balance', 'visit_count'] as const

export function CustomersList() {
  const { data: customers, isLoading, error } = useCustomers()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const list = customers ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, '')),
    )
  }, [customers, search])

  const onExport = () => {
    const rows: (string | number)[][] = [
      [...CSV_HEADERS],
      ...(customers ?? []).map((c) => [c.phone, c.name, c.pointsBalance, c.visitCount]),
    ]
    downloadCsv('customers.csv', toCsv(rows))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/customers/import"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            Import CSV
          </Link>
          <button
            onClick={onExport}
            disabled={!customers?.length}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone…"
        className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
      />

      {isLoading && <p className="text-slate-500">Loading customers…</p>}
      {error && <p className="text-red-600">{error.message}</p>}

      {!isLoading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Visits</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/customers/${c.id}`} className="font-medium text-purple-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.pointsBalance}</td>
                  <td className="px-4 py-3 text-slate-600">{c.visitCount}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
