import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { ServiceRow } from '../../components/ServiceRow'
import { useServices } from '../../lib/queries'
import type { Service } from '../../types'
import { useKioskFlow } from './useKioskFlow'

// Step 3: service selection (optional — SKIP or NEXT). For a known customer this
// is the first screen after phone entry, so we greet them; the unified
// PromotionsLink (in the KioskLayout header) handles all reward actions.
export function ServiceSelection() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const { data: services, isLoading } = useServices()

  const grouped = useMemo(() => groupByCategory(services ?? []), [services])

  const customer = flow.customer

  const goNext = () => navigate('/kiosk/technician')

  return (
    <KioskLayout>
      <div className="mx-auto w-full max-w-3xl flex-1">
        {customer && (
          <div className="mb-6">
            <p className="text-2xl font-semibold text-white">
              Welcome back, {customer.name}! 👋
            </p>
            <p className="mt-1 text-lg text-white/70">
              You have{' '}
              <span className="font-bold text-brand-300">{customer.pointsBalance}</span>{' '}
              {customer.pointsBalance === 1 ? 'point' : 'points'}.
            </p>
            {/* Reward actions (redeem points, claim birthday) live in the
                unified "rewards available" link in the header. */}
          </div>
        )}

        <h1 className="text-3xl font-black tracking-wide text-white">
          What services do you want to choose?
        </h1>

        {isLoading && <p className="mt-8 text-white/50">Loading services…</p>}

        <div className="mt-6 space-y-8">
          {grouped.map(({ category, items }) => (
            <div key={category}>
              <h2 className="mb-3 text-xl font-bold text-brand-300">{category}</h2>
              <div className="space-y-3">
                {items.map((svc) => (
                  <ServiceRow
                    key={svc.id}
                    service={svc}
                    checked={flow.selectedServiceIds.includes(svc.id)}
                    onToggle={() => flow.toggleService(svc.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex gap-4">
          <NextButton variant="ghost" onClick={goNext} className="flex-1">
            SKIP
          </NextButton>
          <NextButton onClick={goNext} className="flex-1">
            NEXT
          </NextButton>
        </div>
      </div>
    </KioskLayout>
  )
}

function groupByCategory(services: Service[]): { category: string; items: Service[] }[] {
  const map = new Map<string, Service[]>()
  for (const svc of services) {
    const list = map.get(svc.category) ?? []
    list.push(svc)
    map.set(svc.category, list)
  }
  return Array.from(map, ([category, items]) => ({ category, items }))
}
