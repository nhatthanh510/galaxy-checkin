import { useEffect, useState } from 'react'
import { useLoyaltyProgram, useUpdateLoyaltyProgram } from '../../lib/queries'

// Admin settings page: edit the loyalty program the kiosk shows on the phone
// screen. Changes are reflected on the kiosk on its next load.
export function LoyaltySettings() {
  const { data: program, isLoading, error } = useLoyaltyProgram()
  const update = useUpdateLoyaltyProgram()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pointsPerReward, setPointsPerReward] = useState('10')
  const [rewardAmount, setRewardAmount] = useState('10')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (program) {
      setName(program.name)
      setDescription(program.description)
      setPointsPerReward(String(program.pointsPerReward))
      setRewardAmount(String(program.rewardAmount))
    }
  }, [program])

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>
  if (!program) {
    return (
      <p className="text-slate-500">
        No active loyalty program found. Seed one in the database first.
      </p>
    )
  }

  const onSave = async () => {
    setSaved(false)
    await update.mutateAsync({
      id: program.id,
      name: name.trim(),
      description: description.trim(),
      pointsPerReward: Number(pointsPerReward) || 0,
      rewardAmount: Number(rewardAmount) || 0,
    })
    setSaved(true)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Loyalty settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        This is the program card shown on the kiosk phone-entry screen and the redeem
        threshold used for the reminder banner.
      </p>

      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Program name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="10 Point"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="10 points get $10 off"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Points per reward</span>
            <input
              type="number"
              value={pointsPerReward}
              onChange={(e) => setPointsPerReward(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Reward amount ($)</span>
            <input
              type="number"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={update.isPending}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved</span>}
          {update.error && <span className="text-sm text-red-600">{update.error.message}</span>}
        </div>
      </div>
    </div>
  )
}
