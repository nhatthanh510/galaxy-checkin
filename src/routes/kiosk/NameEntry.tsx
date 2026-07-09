import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { BackButton } from '../../components/BackButton'
import { BirthdayDropdowns } from '../../components/BirthdayDropdowns'
import {
  dateStringToParts,
  partsToDateString,
  type BirthdayParts,
} from '../../lib/birthday'
import { useKioskFlow } from './useKioskFlow'

// Step 2 (new customers only): capture the full name + (optional) birthday.
export function NameEntry() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const canContinue = flow.name.trim().length > 0
  // Hold birthday as PARTS locally so a partial selection (e.g. day only) sticks.
  // The flow's date string stays null until both day+month are chosen.
  const [birthdayParts, setBirthdayParts] = useState<BirthdayParts>(() =>
    dateStringToParts(flow.birthday),
  )

  const onBirthdayChange = (parts: BirthdayParts) => {
    setBirthdayParts(parts)
    flow.setBirthday(partsToDateString(parts))
  }

  const onNext = () => {
    if (!canContinue) return
    navigate('/kiosk/services')
  }

  return (
    <KioskLayout>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="flex-1 text-center text-4xl font-black tracking-wide text-white">
            ENTER NAME
          </h1>
          {/* Spacer to keep the title visually centered opposite the arrow. */}
          <div className="h-12 w-12 shrink-0" aria-hidden />
        </div>
        <p className="mt-3 text-center text-xl text-white/60">Please enter your full name</p>

        <input
          autoFocus
          value={flow.name}
          onChange={(e) => flow.setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onNext()
          }}
          placeholder="Your name"
          className="mt-8 w-full rounded-2xl bg-black/40 px-8 py-6 text-3xl text-white placeholder:text-white/25 outline-none ring-2 ring-transparent focus:ring-brand-500"
        />

        <div className="mt-8 rounded-2xl border border-pink-400/40 bg-pink-500/10 p-5">
          <p className="text-xl font-bold text-pink-200">
            🎂 Add your birthday for a special birthday discount!
          </p>
          <p className="mb-4 mt-1 text-base text-pink-100/70">
            Optional — we may have a little something for you around your birthday.
          </p>
          <BirthdayDropdowns
            value={birthdayParts}
            onChange={onBirthdayChange}
            variant="dark"
          />
        </div>

        <div className="mt-10 flex justify-center">
          <NextButton onClick={onNext} disabled={!canContinue} className="w-full max-w-sm">
            NEXT
          </NextButton>
        </div>
      </div>
    </KioskLayout>
  )
}
