import { useNavigate } from 'react-router-dom'
import { NextButton } from '../../components/NextButton'
import { KioskLayout } from '../../components/KioskLayout'
import { TechAvatar } from '../../components/TechAvatar'
import { useTechnicians } from '../../lib/queries'
import { useKioskFlow } from './useKioskFlow'

// Step 4: preferred technician (optional — SKIP or NEXT).
export function TechnicianSelection() {
  const navigate = useNavigate()
  const flow = useKioskFlow()
  const { data: technicians, isLoading } = useTechnicians()

  const goNext = () => navigate('/kiosk/success')

  const pick = (id: string) => {
    // Tapping the selected tech again clears it.
    flow.setTechnician(flow.technicianId === id ? null : id)
  }

  return (
    <KioskLayout>
      <div className="mx-auto w-full max-w-4xl flex-1">
        <h1 className="text-3xl font-black tracking-wide text-white">
          Please choose your preferred staff
        </h1>
        <p className="mt-2 text-lg text-white/60">
          …but if you walk in you might have to wait a little longer.
        </p>

        {isLoading && <p className="mt-8 text-white/50">Loading staff…</p>}

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {(technicians ?? []).map((tech) => (
            <TechAvatar
              key={tech.id}
              technician={tech}
              selected={flow.technicianId === tech.id}
              onClick={() => pick(tech.id)}
            />
          ))}
        </div>

        <div className="mt-10 flex gap-4">
          <NextButton variant="ghost" onClick={goNext} className="flex-1">
            SKIP
          </NextButton>
          <NextButton onClick={goNext} className="flex-1">
            NEXT
          </NextButton>
        </div>
      </div>
    </KioskLayout>
  )
}
