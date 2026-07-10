import type { HTMLAttributes } from 'react'

// The standard admin card shell (white panel with a subtle border) — previously
// the `rounded-xl border border-slate-200 bg-white` string repeated ~19×. The
// default padding (p-6) can be overridden by passing padding in className, and
// the base is overridable for table cards that manage their own padding.
export const cardClass = 'rounded-xl border border-slate-200 bg-white'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`${cardClass} p-6 ${className}`} />
}
