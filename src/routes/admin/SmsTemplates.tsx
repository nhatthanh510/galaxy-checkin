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
import { useConfirm } from '../../components/useConfirm'
import { TextInput } from '../../components/ui/TextInput'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { Select } from '../../components/ui/Select'

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

  if (isLoading) return <TableSkeleton cols={4} className="min-w-0 max-w-3xl" />
  if (error) return <p className="text-red-600">{error.message}</p>

  if (mode.kind === 'create') return <TemplateForm onDone={() => setMode({ kind: 'list' })} />
  if (mode.kind === 'edit')
    return <TemplateForm template={mode.template} onDone={() => setMode({ kind: 'list' })} />

  return (
    <div className="min-w-0 max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">SMS templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reusable message bodies. Use <code className="rounded bg-slate-100 px-1">{'{{name}}'}</code>{' '}
            and <code className="rounded bg-slate-100 px-1">{'{{reward}}'}</code> placeholders.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: 'create' })}>New template</Button>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Type</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Preview</th>
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
  const { confirm, dialog } = useConfirm()
  const onDelete = async () => {
    if (
      await confirm({
        title: 'Delete template?',
        message: (
          <>
            Delete <span className="font-semibold text-slate-800">{template.name}</span>? This
            cannot be undone.
          </>
        ),
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      del.mutate(template.id)
    }
  }
  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <td className="px-4 py-3 font-medium text-slate-700">
        {template.name}
        {/* Mobile: type + preview under the name (own columns hidden). */}
        <div className="mt-1 space-y-0.5 text-xs font-normal text-slate-400 md:hidden">
          <div className="sm:hidden">{KIND_LABELS[template.kind]}</div>
          <div className="line-clamp-2">{renderTemplate(template.body, PREVIEW_VALUES)}</div>
        </div>
      </td>
      <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{KIND_LABELS[template.kind]}</td>
      <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
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
        {dialog}
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

      <Card className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Template name</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring promo"
            className="mt-1"
          />
        </label>

        <div className="block">
          <span className="text-sm font-medium text-slate-600">Type</span>
          <Select<NotificationKind>
            value={kind}
            onChange={setKind}
            className="mt-1"
            options={[
              { value: 'marketing', label: 'Marketing (used in campaigns)' },
              { value: 'birthday', label: '🎂 Birthday (used by the daily auto-send)' },
            ]}
          />
        </div>

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
          <Button onClick={onSubmit} disabled={pending || !name.trim() || !body.trim()}>
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
          <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          {err && <span className="text-sm text-red-600">{err.message}</span>}
        </div>
      </Card>
    </div>
  )
}
