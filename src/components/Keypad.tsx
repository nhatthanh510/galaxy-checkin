interface KeypadProps {
  onDigit: (digit: string) => void
  onDelete: () => void
  onClear: () => void
}

// On-screen numeric keypad. Bottom row: Clear (C) · 0 · Delete (⌫). Big targets.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ onDigit, onDelete, onClear }: KeypadProps) {
  const keyClass =
    'h-20 rounded-2xl bg-white/5 text-3xl font-semibold text-white ' +
    'hover:bg-white/10 active:scale-[0.97] transition'

  return (
    <div className="grid grid-cols-3 gap-4">
      {KEYS.map((k) => (
        <button key={k} type="button" className={keyClass} onClick={() => onDigit(k)}>
          {k}
        </button>
      ))}
      <button
        type="button"
        className={`${keyClass} text-2xl text-white/70`}
        onClick={onClear}
        aria-label="Clear all"
      >
        Clear
      </button>
      <button type="button" className={keyClass} onClick={() => onDigit('0')}>
        0
      </button>
      <button
        type="button"
        className={`${keyClass} text-2xl`}
        onClick={onDelete}
        aria-label="Delete"
      >
        ⌫
      </button>
    </div>
  )
}
