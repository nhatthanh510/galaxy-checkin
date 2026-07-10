import type { InputHTMLAttributes } from 'react'

// The standard admin text/number input styling — previously copy-pasted ~20×.
// Exported so bespoke inputs (e.g. a pink-focus variant) can still compose it.
export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'

// A styled admin input. Forwards all native input props; extra className is
// appended so callers can tweak per-instance (e.g. mt-1).
export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />
}
