import type { Service } from '../types'

interface ServiceRowProps {
  service: Service
  checked: boolean
  onToggle: () => void
}

// A selectable service — the whole row is the tap target (no checkbox). Shows
// just the name; selection is indicated by the highlighted/ringed state.
export function ServiceRow({ service, checked, onToggle }: ServiceRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={
        'rounded-2xl px-6 py-4 text-left text-xl font-medium transition ' +
        (checked
          ? 'bg-brand-600/25 text-white ring-2 ring-brand-400'
          : 'bg-white/5 text-white/90 hover:bg-white/10')
      }
    >
      {service.name}
    </button>
  )
}
