import type { Service } from '../types'

interface ServiceRowProps {
  service: Service
  checked: boolean
  onToggle: () => void
}

// A single selectable service in the category list.
export function ServiceRow({ service, checked, onToggle }: ServiceRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        'flex w-full items-center justify-between rounded-2xl px-6 py-5 text-left transition ' +
        (checked ? 'bg-brand-600/25 ring-2 ring-brand-400' : 'bg-white/5 hover:bg-white/10')
      }
    >
      <span className="flex items-center gap-4">
        <span
          className={
            'flex h-8 w-8 items-center justify-center rounded-lg border-2 ' +
            (checked ? 'border-brand-400 bg-brand-500 text-white' : 'border-white/30')
          }
        >
          {checked ? '✓' : ''}
        </span>
        <span className="text-xl font-medium text-white/90">{service.name}</span>
      </span>
      <span className="text-lg text-white/50">
        ${service.price} · {service.durationMinutes}m
      </span>
    </button>
  )
}
