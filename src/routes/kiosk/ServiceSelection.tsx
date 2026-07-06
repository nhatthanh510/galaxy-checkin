import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { ServiceRow } from '../../components/ServiceRow'
import { useServices, useServiceGroups } from '../../lib/queries'
import type { Service, ServiceGroup } from '../../types'
import { useKioskFlow } from './useKioskFlow'

// Step 3: service selection (optional — SKIP or NEXT). For a known customer this
// is the first screen after phone entry, so we greet them; the unified
// PromotionsLink (in the KioskLayout header) handles all reward actions.
export function ServiceSelection() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const { data: services, isLoading } = useServices()
  const { data: groups } = useServiceGroups()

  // Group services by the group entity (falling back to "Other" for ungrouped).
  const grouped = useMemo(
    () => groupByServiceGroup(services ?? [], groups ?? []),
    [services, groups],
  )

  const customer = flow.customer
  const noServices = !isLoading && (services ?? []).length === 0

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
        {noServices && (
          <p className="mt-8 text-white/50">
            No services to choose right now — tap NEXT to continue.
          </p>
        )}

        <div className="mt-6 space-y-8">
          {grouped.map(({ groupName, items }) => (
            <div key={groupName}>
              <h2 className="mb-3 text-xl font-bold text-brand-300">{groupName}</h2>
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

// Group services by their service_group (via groupId), preserving the group
// order. Ungrouped services fall under "Other". Renaming a group in admin
// updates the kiosk heading automatically (single source of truth).
function groupByServiceGroup(
  services: Service[],
  groups: ServiceGroup[],
): { groupName: string; items: Service[] }[] {
  const nameById = new Map(groups.map((g) => [g.id, g.name]))
  const buckets = new Map<string, Service[]>()
  for (const svc of services) {
    const key = (svc.groupId && nameById.get(svc.groupId)) || svc.category || 'Other'
    const list = buckets.get(key) ?? []
    list.push(svc)
    buckets.set(key, list)
  }
  return Array.from(buckets, ([groupName, items]) => ({ groupName, items }))
}
