import { useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCustomers, useUpsertCustomers, type ImportCustomer } from '../../lib/queries'
import { CSV_HEADERS, parseCsv } from '../../lib/csv'
import { normalizePhone } from '../../lib/phone'

interface PreviewRow {
  row: ImportCustomer
  status: 'new' | 'update' | 'error'
  error?: string
}

// Parse + validate CSV rows against the known header order, flagging each row as
// new / update (matched by phone) / error.
function buildPreview(text: string, existingPhones: Set<string>): PreviewRow[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []

  // Skip a header row if present (first cell equals the first header).
  const start = rows[0][0]?.trim().toLowerCase() === CSV_HEADERS[0] ? 1 : 0

  return rows.slice(start).map((cells): PreviewRow => {
    const [rawPhone = '', name = '', points = '0', visits = '0'] = cells
    const phone = normalizePhone(rawPhone)

    if (phone.length !== 10) {
      return {
        status: 'error',
        error: `Invalid phone "${rawPhone}"`,
        row: { phone, name: name.trim(), pointsBalance: 0, visitCount: 0 },
      }
    }
    if (!name.trim()) {
      return {
        status: 'error',
        error: 'Missing name',
        row: { phone, name: '', pointsBalance: 0, visitCount: 0 },
      }
    }

    const pointsBalance = Number(points)
    const visitCount = Number(visits)
    if (Number.isNaN(pointsBalance) || Number.isNaN(visitCount)) {
      return {
        status: 'error',
        error: 'Points/visits must be numbers',
        row: { phone, name: name.trim(), pointsBalance: 0, visitCount: 0 },
      }
    }

    return {
      status: existingPhones.has(phone) ? 'update' : 'new',
      row: { phone, name: name.trim(), pointsBalance, visitCount },
    }
  })
}

export function CustomerImport() {
  const navigate = useNavigate()
  const { data: customers } = useCustomers()
  const upsert = useUpsertCustomers()
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [fileName, setFileName] = useState('')

  const existingPhones = useMemo(
    () => new Set((customers ?? []).map((c) => c.phone)),
    [customers],
  )

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setPreview(buildPreview(text, existingPhones))
  }

  const valid = (preview ?? []).filter((p) => p.status !== 'error')
  const errors = (preview ?? []).filter((p) => p.status === 'error')
  const newCount = valid.filter((p) => p.status === 'new').length
  const updateCount = valid.filter((p) => p.status === 'update').length

  const onConfirm = async () => {
    await upsert.mutateAsync(valid.map((p) => p.row))
    navigate('/admin/customers')
  }

  return (
    <div className="max-w-4xl">
      <Link to="/admin/customers" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to customers
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Import customers</h1>
      <p className="mt-1 text-sm text-slate-500">
        CSV columns: <code className="rounded bg-slate-200 px-1">{CSV_HEADERS.join(', ')}</code>.
        A header row is optional. Rows are matched to existing customers by phone.
      </p>

      <div className="mt-6">
        <label className="inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
        {fileName && <span className="ml-3 text-sm text-slate-500">{fileName}</span>}
      </div>

      {preview && (
        <>
          <div className="mt-6 flex gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              {newCount} new
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
              {updateCount} update
            </span>
            {errors.length > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                {errors.length} errors (skipped)
              </span>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Points</th>
                  <th className="px-4 py-2 font-medium">Visits</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <StatusBadge status={p.status} error={p.error} />
                    </td>
                    <td className="px-4 py-2 text-slate-600">{p.row.phone || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{p.row.name || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{p.row.pointsBalance}</td>
                    <td className="px-4 py-2 text-slate-600">{p.row.visitCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={onConfirm}
              disabled={valid.length === 0 || upsert.isPending}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {upsert.isPending ? 'Importing…' : `Import ${valid.length} rows`}
            </button>
            {upsert.error && <span className="text-sm text-red-600">{upsert.error.message}</span>}
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status, error }: { status: PreviewRow['status']; error?: string }) {
  if (status === 'error') {
    return <span className="text-red-600" title={error}>error: {error}</span>
  }
  if (status === 'update') {
    return <span className="text-blue-600">update</span>
  }
  return <span className="text-emerald-600">new</span>
}
