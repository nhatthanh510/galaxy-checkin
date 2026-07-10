import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeleteCustomer } from '../../lib/queries'
import type { Customer } from '../../types'
import { formatPhone } from '../../lib/phone'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button } from '../../components/ui/Button'

// Admin-only: permanently delete a customer and all their history.
export function DangerZone({ customer }: { customer: Customer }) {
  const navigate = useNavigate()
  const del = useDeleteCustomer()
  const [confirming, setConfirming] = useState(false)

  const onConfirm = () => {
    del.mutate(customer.id, {
      onSuccess: () => navigate('/admin/customers'),
    })
  }

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-700">Danger zone</h2>
      <p className="mt-1 text-sm text-red-600">
        Deleting a customer also removes their visit history and loyalty
        transactions. This cannot be undone.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="danger"
          onClick={() => setConfirming(true)}
          disabled={del.isPending}
        >
          {del.isPending ? 'Deleting…' : 'Delete customer'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete customer?"
        message={
          <>
            This permanently removes{' '}
            <span className="font-semibold text-slate-800">{customer.name}</span> (
            {formatPhone(customer.phone)}) along with their visit history and loyalty
            transactions. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        busy={del.isPending}
        error={del.error?.message ?? null}
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
