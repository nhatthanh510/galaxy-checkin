interface KeypadProps {
  onDigit: (digit: string) => void
  onDelete: () => void
  onClear: () => void
}

// On-screen numeric keypad. Bottom row: Clear (C) · 0 · Delete (⌫). Big targets.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ onDigit, onDelete, onClear }: KeypadProps) {
  // Big touch targets on tablet (sm+). On phones the buttons/text shrink so the
  // whole keypad + NEXT fit without scrolling, and on a short-height desktop
  // (14" laptop) they shrink too. Tablet size is the sm: baseline.
  const keyClass =
    'h-16 rounded-2xl bg-white/5 text-2xl font-semibold text-white ' +
    'hover:bg-white/10 active:scale-[0.97] transition sm:h-20 sm:text-3xl short-desktop:h-16'

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 short-desktop:gap-3">
      {KEYS.map((k) => (
        <button key={k} type="button" className={keyClass} onClick={() => onDigit(k)}>
          {k}
        </button>
      ))}
      <button
        type="button"
        className={`${keyClass} text-lg text-white/70 sm:text-2xl`}
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
        className={`${keyClass} text-xl sm:text-2xl`}
        onClick={onDelete}
        aria-label="Delete"
      >
        ⌫
      </button>
    </div>
  )
}
