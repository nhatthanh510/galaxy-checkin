import type { CheckinHistoryItem, LoyaltyTransaction } from '../../types'
import { Pagination } from '../../components/Pagination'
import { usePagination } from '../../components/usePagination'

// Paginated visit-history table.
export function VisitHistory({ checkins }: { checkins: CheckinHistoryItem[] }) {
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
                <th className="px-4 py-2 font-medium">Branch</th>
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
export function LoyaltyTransactions({ transactions }: { transactions: LoyaltyTransaction[] }) {
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

// One row of the visit-history table.
function VisitRow({ visit }: { visit: CheckinHistoryItem }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2 text-slate-600">
        {new Date(visit.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-2 text-slate-600">
        {visit.branchName ? (
          <span className="whitespace-nowrap">📍 {visit.branchName}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
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
