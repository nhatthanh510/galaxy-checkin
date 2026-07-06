import { useNavigate } from 'react-router-dom'

// Icon-only back arrow, placed to the left of a step's title.
export function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="Go back"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-3xl text-white/70 hover:bg-white/10 active:scale-95"
    >
      ‹
    </button>
  )
}
