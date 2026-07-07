import { useState } from 'react'
import {
  useSmsTemplates,
  useCreateSmsTemplate,
  useUpdateSmsTemplate,
  useDeleteSmsTemplate,
  type SmsTemplateInput,
} from '../../lib/queries'
import type { NotificationKind, SmsTemplate } from '../../types'
import { renderTemplate, smsSegments } from '../../lib/sms'

type Mode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; template: SmsTemplate }

const KIND_LABELS: Record<NotificationKind, string> = {
  marketing: 'Marketing',
  birthday: '🎂 Birthday (auto-send)',
  checkin: 'Check-in',
}

// Sample values for the live preview.
const PREVIEW_VALUES = { name: 'Alex', reward: '20% off' }

// Admin: manage reusable SMS templates. Marketing templates feed the campaign
// picker; the birthday template is used by the daily auto-send.
export function SmsTemplates() {
  const { data: templates, isLoading, error } = useSmsTemplates()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  if (isLoading) return <p className="text-slate-500">Loading…</p>
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') return <TemplateForm onDone={() => setMode({ kind: 'list' })} />
  if (mode.kind === 'edit')
    return <TemplateForm template={mode.template} onDone={() => setMode({ kind: 'list' })} />

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SMS templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reusable message bodies. Use <code className="rounded bg-slate-100 px-1">{'{{name}}'}</code>{' '}
            and <code className="rounded bg-slate-100 px-1">{'{{reward}}'}</code> placeholders.
          </p>
        </div>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          New template
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Preview</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(templates ?? []).map((t) => (
              <TemplateRow key={t.id} template={t} onEdit={() => setMode({ kind: 'edit', template: t })} />
            ))}
            {templates?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No templates yet. Create one to send a campaign.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TemplateRow({ template, onEdit }: { template: SmsTemplate; onEdit: () => void }) {
  const del = useDeleteSmsTemplate()
  const onDelete = () => {
    if (window.confirm(`Delete "${template.name}"?`)) del.mutate(template.id)
  }
  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <td className="px-4 py-3 font-medium text-slate-700">{template.name}</td>
      <td className="px-4 py-3 text-slate-600">{KIND_LABELS[template.kind]}</td>
      <td className="px-4 py-3 text-slate-500">
        {renderTemplate(template.body, PREVIEW_VALUES)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <button onClick={onEdit} className="text-sm text-brand-600 hover:text-brand-800">
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={del.isPending}
          className="ml-3 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

function TemplateForm({ template, onDone }: { template?: SmsTemplate; onDone: () => void }) {
  const create = useCreateSmsTemplate()
  const update = useUpdateSmsTemplate()
  const isEdit = Boolean(template)

  const [name, setName] = useState(template?.name ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [kind, setKind] = useState<NotificationKind>(template?.kind ?? 'marketing')

  const pending = create.isPending || update.isPending
  const err = create.error || update.error

  const preview = renderTemplate(body, PREVIEW_VALUES)
  const segments = smsSegments(preview)

  const onSubmit = async () => {
    const input: SmsTemplateInput = { name: name.trim(), body: body.trim(), kind }
    if (isEdit && template) await update.mutateAsync({ id: template.id, ...input })
    else await create.mutateAsync(input)
    onDone()
  }

  return (
    <div className="max-w-xl">
      <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to templates
      </button>
      <h1 className="mt-2 text-2xl font-bold">{isEdit ? 'Edit template' : 'New template'}</h1>

      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Template name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring promo"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as NotificationKind)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          >
            <option value="marketing">Marketing (used in campaigns)</option>
            <option value="birthday">🎂 Birthday (used by the daily auto-send)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Hi {{name}}, enjoy {{reward}} this week at Galaxy Nails!"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Placeholders: <code>{'{{name}}'}</code>, <code>{'{{reward}}'}</code> (active birthday reward).
          </span>
        </label>

        {body.trim() && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Preview ({preview.length} chars · {segments} SMS)
            </p>
            <p className="text-slate-700">{preview}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onSubmit}
            disabled={pending || !name.trim() || !body.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
          <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          {err && <span className="text-sm text-red-600">{err.message}</span>}
        </div>
      </div>
    </div>
  )
}
