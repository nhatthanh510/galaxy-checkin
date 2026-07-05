interface ConsentCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

// Consent checkbox + Terms/Privacy copy shown at the bottom of the phone screen.
export function ConsentCheckbox({ checked, onChange }: ConsentCheckboxProps) {
  return (
    <label className="flex items-start gap-4 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-7 w-7 shrink-0 accent-brand-600"
      />
      <span className="text-sm leading-relaxed text-white/60">
        By checking this box and clicking NEXT, you give Galaxy Nail Spa consent to contact
        you at the phone number provided, including for marketing messages. Consent is not
        required to check in. Message and data rates may apply. See our{' '}
        <span className="underline">Terms</span> and{' '}
        <span className="underline">Privacy Policy</span>.
      </span>
    </label>
  )
}
