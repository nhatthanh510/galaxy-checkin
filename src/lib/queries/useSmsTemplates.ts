import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationKind, SmsTemplate, SmsTemplateRow } from '../../types'
import { getSupabase } from '../supabase'
import { mapSmsTemplate } from './mappers'

export const smsTemplatesKey = ['sms-templates'] as const

// Admin: list all SMS templates (newest first).
export function useSmsTemplates() {
  return useQuery<SmsTemplate[]>({
    queryKey: smsTemplatesKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('sms_template')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data as SmsTemplateRow[]).map(mapSmsTemplate)
    },
  })
}

export interface SmsTemplateInput {
  name: string
  body: string
  kind: NotificationKind
}

function toRow(input: SmsTemplateInput) {
  return { name: input.name, body: input.body, kind: input.kind }
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: smsTemplatesKey })
}

export function useCreateSmsTemplate() {
  const invalidate = useInvalidate()
  return useMutation<SmsTemplate, Error, SmsTemplateInput>({
    mutationFn: async (input) => {
      const { data, error } = await getSupabase()
        .from('sms_template')
        .insert(toRow(input))
        .select('*')
        .single()
      if (error) throw error
      return mapSmsTemplate(data as SmsTemplateRow)
    },
    onSuccess: invalidate,
  })
}

export function useUpdateSmsTemplate() {
  const invalidate = useInvalidate()
  return useMutation<SmsTemplate, Error, { id: string } & SmsTemplateInput>({
    mutationFn: async ({ id, ...input }) => {
      const { data, error } = await getSupabase()
        .from('sms_template')
        .update({ ...toRow(input), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return mapSmsTemplate(data as SmsTemplateRow)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteSmsTemplate() {
  const invalidate = useInvalidate()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await getSupabase().from('sms_template').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
