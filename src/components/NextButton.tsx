import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost'

interface NextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: Variant
}

// Large, high-contrast touch target for the kiosk.
export function NextButton({
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...rest
}: NextButtonProps) {
  const base =
    'min-h-16 px-10 rounded-2xl text-2xl font-bold tracking-wide transition-colors ' +
    'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none'
  const variants: Record<Variant, string> = {
    primary: 'bg-purple-600 text-white hover:bg-purple-500',
    ghost: 'bg-white/5 text-white/80 hover:bg-white/10',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
