import type { Technician } from '../types'

interface TechAvatarProps {
  technician: Technician
  selected: boolean
  onClick: () => void
}

// Technician tile: photo when available, else a purple circle with the initial.
export function TechAvatar({ technician, selected, onClick }: TechAvatarProps) {
  const initial = technician.name.charAt(0).toUpperCase()
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex flex-col items-center gap-3 rounded-2xl p-5 transition ' +
        (selected ? 'bg-purple-600/30 ring-2 ring-purple-400' : 'bg-white/5 hover:bg-white/10')
      }
    >
      {technician.photoUrl ? (
        <img
          src={technician.photoUrl}
          alt={technician.name}
          className="h-24 w-24 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-600 text-4xl font-bold text-white">
          {initial}
        </div>
      )}
      <span className="text-lg font-medium text-white/90">{technician.name}</span>
    </button>
  )
}
