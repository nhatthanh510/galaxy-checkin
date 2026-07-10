import type { LoyaltyProgram } from '../../types'
import { formatReward } from '../../lib/reward'
import { Card } from '../../components/ui/Card'
import { TRIGGER_LABELS } from './loyaltyLabels'

export function ProgramView({ program, onBack }: { program: LoyaltyProgram; onBack: () => void }) {
  return (
    <div className="max-w-xl">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to programs
      </button>
      <h1 className="mt-2 text-2xl font-bold">{program.name}</h1>
      <Card className="mt-4 space-y-3 text-sm">
        <Field label="Description" value={program.description} />
        <Field label="Trigger" value={TRIGGER_LABELS[program.triggerType]} />
        {program.triggerType === 'points' && (
          <Field label="Points per reward" value={String(program.pointsPerReward)} />
        )}
        {program.triggerType === 'date_window' && (
          <Field
            label="Claim window"
            value={`${program.windowBeforeDays} days before → ${program.windowAfterDays} days after birthday`}
          />
        )}
        {program.triggerType === 'date_window' ? (
          <Field
            label="Reward"
            value="Percent off by customer tier — set on the Settings page"
          />
        ) : (
          <Field
            label="Reward"
            value={formatReward(program.rewardType, program.rewardValue)}
          />
        )}
        <Field label="Status" value={program.active ? 'Active' : 'Inactive'} />
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  )
}
