import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const BASE = 'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-500',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

// The standard admin button — previously copy-pasted with slightly inconsistent
// padding and disabled styling. `variant` picks the color; extra className is
// appended for per-instance tweaks. Defaults to type="button" so it doesn't
// accidentally submit a surrounding form.
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button {...props} type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} />
  )
}
