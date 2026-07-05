interface KeypadProps {
  onDigit: (digit: string) => void
  onDelete: () => void
}

// On-screen numeric keypad: 1–9, then 0 and delete. Big touch targets.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ onDigit, onDelete }: KeypadProps) {
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
      <div aria-hidden />
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
