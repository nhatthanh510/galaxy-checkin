import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { useKioskFlow } from './useKioskFlow'

// Step 2 (new customers only): capture the full name.
export function NameEntry() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const canContinue = flow.name.trim().length > 0

  const onNext = () => {
    if (!canContinue) return
    navigate('/kiosk/services')
  }

  return (
    <KioskLayout>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <h1 className="text-center text-4xl font-black tracking-wide text-white">
          ENTER NAME
        </h1>
        <p className="mt-3 text-center text-xl text-white/60">Please enter your full name</p>

        <input
          autoFocus
          value={flow.name}
          onChange={(e) => flow.setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onNext()
          }}
          placeholder="Your name"
          className="mt-10 w-full rounded-2xl bg-black/40 px-8 py-6 text-3xl text-white placeholder:text-white/25 outline-none ring-2 ring-transparent focus:ring-brand-500"
        />

        <div className="mt-10 flex justify-center">
          <NextButton onClick={onNext} disabled={!canContinue} className="w-full max-w-sm">
            NEXT
          </NextButton>
        </div>
      </div>
    </KioskLayout>
  )
}
