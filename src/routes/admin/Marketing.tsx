import { useMemo, useState } from 'react'
import {
  useCustomers,
  useSmsTemplates,
  useActiveLoyaltyPrograms,
  useSendCampaign,
  type CampaignResult,
} from '../../lib/queries'
import type { Customer, SmsTemplate } from '../../types'
import { formatReward } from '../../lib/reward'
import { formatPhone } from '../../lib/phone'
import { renderTemplate, templateValues, smsSegments } from '../../lib/sms'

// Admin: compose and send a marketing SMS campaign. Recipients are restricted to
// customers who opted in (marketing_consent), per SMS marketing law.
export function Marketing() {
  const { data: customers, isLoading: custLoading } = useCustomers()
  const { data: templates, isLoading: tplLoading } = useSmsTemplates()
  const { data: programs } = useActiveLoyaltyPrograms()
  const send = useSendCampaign()

  const [templateId, setTemplateId] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<CampaignResult | null>(null)

  // Only consented customers are eligible recipients.
  const consented = useMemo(
    () => (customers ?? []).filter((c) => c.marketingConsent),
    [customers],
  )
  const nonConsentedCount = (customers ?? []).length - consented.length

  // Marketing templates only (birthday templates are auto-send).
  const marketingTemplates = (templates ?? []).filter((t) => t.kind === 'marketing')
  const template = marketingTemplates.find((t) => t.id === templateId) ?? null

  // {{reward}} uses the active birthday program's reward if present.
  const birthdayProgram = (programs ?? []).find(
    (p) => p.triggerType === 'date_window' && p.dateAnchor === 'birthday',
  )
  const reward = birthdayProgram
    ? formatReward(birthdayProgram.rewardType, birthdayProgram.rewardValue)
    : 'a treat'

  const recipients = consented.filter((c) => selected.has(c.id))

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allSelected = consented.length > 0 && selected.size === consented.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(consented.map((c) => c.id)))

  const onSend = async () => {
    if (!template || recipients.length === 0) return
    if (
      !window.confirm(
        `Send "${template.name}" to ${recipients.length} customer${recipients.length === 1 ? '' : 's'}?`,
      )
    )
      return
    setResult(null)
    const res = await send.mutateAsync({ template, recipients, reward })
    setResult(res)
    setSelected(new Set())
  }

  if (custLoading || tplLoading) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="min-w-0 max-w-4xl">
      <h1 className="text-2xl font-bold">Marketing SMS</h1>
      <p className="mt-1 text-sm text-slate-500">
        Send a template to opted-in customers. {nonConsentedCount > 0 && (
          <span>{nonConsentedCount} customer(s) without consent are hidden.</span>
        )}
      </p>

      {marketingTemplates.length === 0 ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No marketing templates yet. Create one on the{' '}
          <span className="font-medium">SMS templates</span> page first.
        </div>
      ) : (
        <>
          {/* Template picker + preview */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Template</span>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                <option value="">Select a template…</option>
                {marketingTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {template && <Preview template={template} sample={consented[0]} reward={reward} />}
          </div>

          {/* Recipient picker */}
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="text-lg font-semibold">
                Recipients{' '}
                <span className="font-normal text-slate-400">
                  ({selected.size} of {consented.length} selected)
                </span>
              </h2>
              <button
                onClick={toggleAll}
                disabled={consented.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            {consented.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">
                No customers have opted in to marketing SMS.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-auto">
                {consented.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="flex-1 text-sm text-slate-700">{c.name}</span>
                    <span className="text-sm text-slate-400">{formatPhone(c.phone)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Send */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onSend}
              disabled={!template || recipients.length === 0 || send.isPending}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {send.isPending
                ? `Sending… `
                : `Send to ${recipients.length} customer${recipients.length === 1 ? '' : 's'}`}
            </button>
            {send.error && <span className="text-sm text-red-600">{send.error.message}</span>}
            {result && (
              <span className="text-sm text-emerald-600">
                Sent {result.sent}/{result.total}
                {result.failed > 0 && <span className="text-red-600"> · {result.failed} failed</span>}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Preview({
  template,
  sample,
  reward,
}: {
  template: SmsTemplate
  sample: Customer | undefined
  reward: string
}) {
  const text = renderTemplate(
    template.body,
    sample ? templateValues(sample, reward) : { name: 'Alex', reward },
  )
  return (
    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Preview ({text.length} chars · {smsSegments(text)} SMS each)
      </p>
      <p className="text-slate-700">{text}</p>
    </div>
  )
}
